locals {
  prefix = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
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
      // SPA route — let React Router handle it.
      request.uri = '/index.html';
      return request;
    }
  EOT
}

# Security headers policy - X-Frame-Options, HSTS, etc.
resource "aws_cloudfront_response_headers_policy" "security_headers" {
  name    = "${local.prefix}-security-headers"
  comment = "Security headers for ${local.prefix}"

  security_headers_config {
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
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
      origin_id   = "ALB-API"

      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
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

    # SPA deep-link rewrite — runs ONLY on the S3 behavior. /api/* and /health*
    # behaviors below don't get this function, so the ALB owns its own 404s.
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_rewrite.arn
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  dynamic "ordered_cache_behavior" {
    for_each = var.api_origin_domain != "" ? ["/health*"] : []
    content {
      path_pattern               = ordered_cache_behavior.value
      allowed_methods            = ["GET", "HEAD", "OPTIONS"]
      cached_methods             = ["GET", "HEAD"]
      target_origin_id           = "ALB-API"
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
      target_origin_id           = "ALB-API"
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
