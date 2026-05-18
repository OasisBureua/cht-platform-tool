locals {
  prefix = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
}

resource "aws_s3_bucket" "session_assets" {
  bucket = "${local.prefix}-session-assets"

  tags = {
    Name        = "${local.prefix}-session-assets"
    Environment = var.environment
    Purpose     = "Public session hero banner images for webinars and meetings"
  }
}

resource "aws_s3_bucket_public_access_block" "session_assets" {
  bucket = aws_s3_bucket.session_assets.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_server_side_encryption_configuration" "session_assets" {
  bucket = aws_s3_bucket.session_assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "session_assets" {
  bucket = aws_s3_bucket.session_assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_policy" "session_assets_public_read_prefix" {
  bucket = aws_s3_bucket.session_assets.id

  depends_on = [aws_s3_bucket_public_access_block.session_assets]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadSessionHeroes"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.session_assets.arn}/session-heroes/*"
      }
    ]
  })
}
