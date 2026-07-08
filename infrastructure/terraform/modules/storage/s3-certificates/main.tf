locals {
  prefix = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
}

resource "aws_s3_bucket" "certificates" {
  bucket = "${local.prefix}-certificates"

  tags = {
    Name        = "${local.prefix}-certificates"
    Environment = var.environment
    Purpose     = "CME certificates storage"
  }
}

resource "aws_s3_bucket_versioning" "certificates" {
  bucket = aws_s3_bucket.certificates.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "certificates" {
  bucket = aws_s3_bucket.certificates.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_id
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "certificates" {
  bucket = aws_s3_bucket.certificates.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle rules - keep certificates for 7 years (compliance)
resource "aws_s3_bucket_lifecycle_configuration" "certificates" {
  bucket = aws_s3_bucket.certificates.id

  rule {
    id     = "archive-old-certificates"
    status = "Enabled"

    filter {}

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 365
      storage_class = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# CORS for pre-signed URLs
resource "aws_s3_bucket_cors_configuration" "certificates" {
  bucket = aws_s3_bucket.certificates.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = var.allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}