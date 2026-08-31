locals {
  prefix                     = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
  api_failover_enabled       = var.api_origin_domain != "" && var.secondary_api_origin_domain != ""
  primary_api_origin_id      = "ALB-API-PRIMARY"
  secondary_api_origin_id    = "ALB-API-SECONDARY"
  api_origin_group_id        = "ALB-API-GROUP"
  # Origin groups only support GET, HEAD, OPTIONS (AWS CloudFront limit). Use the group for
  # /health* and /actuator* failover probes; keep /api* on the primary ALB (mutating methods required).
  health_target_origin_id    = local.api_failover_enabled ? local.api_origin_group_id : local.primary_api_origin_id
  api_target_origin_id = (
    var.route_api_to_secondary && local.api_failover_enabled
    ? local.secondary_api_origin_id
    : local.primary_api_origin_id
  )
  # Ops/metadata paths forwarded to the backend ALB (not the S3 SPA).
  backend_metadata_paths     = ["/health*", "/actuator*"]
}

# SPA viewer-request handler: rewrite deep-link URIs to /index.html so React
# Router can take over. Scoped to the S3 default behavior via function_association
# (NOT the /api/* or /health* behaviors). Replaces the old distribution-wide
# `custom_error_response { error_code = 404 }` which caused new API endpoints to
# return cached HTML for 5 minutes after every fresh ECS task rollover.
#
# Logic:
#   - Path has a file extension (.js, .css, .png, etc.) → pass through to S3 as-is
#   - Path looks like an asset under /assets/ → pass through
#   - Anything else → rewrite request.uri to /index.html
#
# This runs only on the S3 behavior. /api/* requests are routed to the ALB
# before this function would ever execute.
resource "aws_cloudfront_function" "spa_rewrite" {
  name    = "${local.prefix}-spa-rewrite"
  runtime = "cloudfront-js-1.0"
  comment = "SPA deep-link → /index.html rewrite (S3 behavior only)"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      var uri = request.uri;
      // Pass through files that look like static assets (have a real extension).
      if (uri.indexOf('/assets/') === 0) return request;
      var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
      if (lastSegment.indexOf('.') !== -1) return request;
      // SPA route: let React Router handle it.
      request.uri = '/index.html';
      return request;
    }
  EOT
}

# Security headers for the SPA / API (no COOP/COEP — those break Stripe Connect
# embedded iframes: "Data layer message channel was not initialized").
resource "aws_cloudfront_response_headers_policy" "security_headers" {
  name    = "${local.prefix}-security-headers"
  comment = "Security headers for ${local.prefix} SPA/API"

  security_headers_config {
    content_type_options {
      override = true
    }
    frame_options {
      # SAMEORIGIN (not DENY): Zoom Meeting SDK runs in a same-origin iframe
      # (/zoom-embed.html). DENY blocks that embed and surfaces as Access Denied.
      frame_option = "SAMEORIGIN"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
    strict_transport_security {
      access_control_max_age_sec = 63072000 # 2 years
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
  }
}

# Zoom Meeting SDK (WASM / SharedArrayBuffer) needs COOP + COEP. Scope to the
# embed document only — applying site-wide breaks Stripe Connect.js data-layer
# iframes on Settings / Payments.
resource "aws_cloudfront_response_headers_policy" "security_headers_zoom" {
  name    = "${local.prefix}-security-headers-zoom"
  comment = "Security headers for ${local.prefix} /zoom-embed.html (COOP/COEP)"

  security_headers_config {
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "SAMEORIGIN"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
    strict_transport_security {
      access_control_max_age_sec = 63072000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
  }

  custom_headers_config {
    items {
      header   = "Cross-Origin-Opener-Policy"
      override = true
      value    = "same-origin"
    }
    items {
      header   = "Cross-Origin-Embedder-Policy"
      override = true
      value    = "credentialless"
    }
  }
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${local.prefix} frontend distribution"
  default_root_object = "index.html"
  price_class         = var.price_class
  aliases             = var.domain_aliases
  web_acl_id          = var.web_acl_id != "" ? var.web_acl_id : null

  origin {
    domain_name = var.s3_bucket_domain_name
    origin_id   = "S3-${var.s3_bucket_id}"

    s3_origin_config {
      origin_access_identity = var.cloudfront_oai_path
    }
  }

  dynamic "origin" {
    for_each = var.api_origin_domain != "" ? [1] : []
    content {
      domain_name = var.api_origin_domain
      origin_id   = local.primary_api_origin_id

      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  dynamic "origin" {
    for_each = local.api_failover_enabled ? [1] : []
    content {
      domain_name = var.secondary_api_origin_domain
      origin_id   = local.secondary_api_origin_id

      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  dynamic "origin_group" {
    for_each = local.api_failover_enabled ? [1] : []
    content {
      origin_id = local.api_origin_group_id

      failover_criteria {
        status_codes = [500, 502, 503, 504]
      }

      member {
        origin_id = local.primary_api_origin_id
      }

      member {
        origin_id = local.secondary_api_origin_id
      }
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${var.s3_bucket_id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    # SPA deep-link rewrite: runs ONLY on the S3 behavior. /api/* and /health*
    # behaviors below don't get this function, so the ALB owns its own 404s.
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_rewrite.arn
    }

    viewer_protocol_policy = "redirect-to-https"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
    # default_ttl=0: if S3 omits Cache-Control (mis-deploy), do not cache at edge for 1h.
    # Explicit object headers still control caching up to max_ttl (hashed assets).
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 86400
    compress               = true
  }

  # Zoom embed only: COOP/COEP for SharedArrayBuffer. Must be ordered before
  # default so /zoom-embed.html does not inherit SPA headers without isolation.
  ordered_cache_behavior {
    path_pattern               = "/zoom-embed.html"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "S3-${var.s3_bucket_id}"
    compress                   = true
    viewer_protocol_policy     = "redirect-to-https"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers_zoom.id

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 86400
  }

  dynamic "ordered_cache_behavior" {
    for_each = var.api_origin_domain != "" ? toset(local.backend_metadata_paths) : toset([])
    content {
      path_pattern               = ordered_cache_behavior.value
      allowed_methods            = ["GET", "HEAD", "OPTIONS"]
      cached_methods             = ["GET", "HEAD"]
      target_origin_id           = local.health_target_origin_id
      compress                   = true
      viewer_protocol_policy     = "redirect-to-https"
      response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
      forwarded_values {
        query_string = true
        headers      = ["Host"]
        cookies {
          forward = "none"
        }
      }
      min_ttl     = 0
      default_ttl = 0
      max_ttl     = 0
    }
  }

  dynamic "ordered_cache_behavior" {
    for_each = var.api_origin_domain != "" ? ["/api*"] : []
    content {
      path_pattern               = ordered_cache_behavior.value
      allowed_methods            = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
      cached_methods             = ["GET", "HEAD"]
      target_origin_id           = local.api_target_origin_id
      compress                   = true
      viewer_protocol_policy     = "redirect-to-https"
      response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id

      forwarded_values {
        query_string = true
        headers      = ["Host", "Authorization", "X-Session-Token", "X-Dev-User-Id"]
        cookies {
          forward = "all"
        }
      }
      min_ttl     = 0
      default_ttl = 0
      max_ttl     = 0
    }
  }

  # SPA deep-link rewrite is handled by aws_cloudfront_function.spa_rewrite on the
  # S3 default behavior. Do NOT add distribution-wide 404/403 → /index.html here;
  # that rewrote /api/* 404s from the ALB and cached HTML for 5 minutes.
  custom_error_response {
    error_code            = 502
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
      locations        = []
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.certificate_arn == "" ? true : false
    acm_certificate_arn            = var.certificate_arn
    ssl_support_method             = var.certificate_arn != "" ? "sni-only" : null
    minimum_protocol_version       = var.certificate_arn != "" ? "TLSv1.2_2021" : null
  }

  tags = {
    Name        = "${local.prefix}-cloudfront"
    Environment = var.environment
  }
}
