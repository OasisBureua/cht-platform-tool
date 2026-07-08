locals {
  prefix              = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
  replication_enabled = var.enable_replication && var.replication_destination_bucket_arn != ""
}

resource "aws_s3_bucket" "frontend" {
  bucket = "${local.prefix}-frontend"

  tags = {
    Name        = "${local.prefix}-frontend"
    Environment = var.environment
    Purpose     = "Frontend static files"
  }
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Origin Access Identity
resource "aws_cloudfront_origin_access_identity" "frontend" {
  comment = "${local.prefix} frontend OAI"
}

# Bucket policy for CloudFront access
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.frontend.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
      }
    ]
  })
}

# Lifecycle rules
resource "aws_s3_bucket_lifecycle_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    id     = "delete-old-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

resource "aws_iam_role" "replication" {
  count = local.replication_enabled ? 1 : 0
  name  = "${local.prefix}-frontend-replication"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "s3.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "replication" {
  count = local.replication_enabled ? 1 : 0
  name  = "${local.prefix}-frontend-replication-policy"
  role  = aws_iam_role.replication[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Effect = "Allow"
          Action = [
            "s3:GetReplicationConfiguration",
            "s3:ListBucket"
          ]
          Resource = aws_s3_bucket.frontend.arn
        },
        {
          Effect = "Allow"
          Action = [
            "s3:GetObjectVersionForReplication",
            "s3:GetObjectVersionAcl",
            "s3:GetObjectVersionTagging"
          ]
          Resource = "${aws_s3_bucket.frontend.arn}/*"
        },
        {
          Effect = "Allow"
          Action = [
            "s3:ReplicateObject",
            "s3:ReplicateDelete",
            "s3:ReplicateTags",
            "s3:ObjectOwnerOverrideToBucketOwner"
          ]
          Resource = "${var.replication_destination_bucket_arn}/*"
        }
      ],
      var.replication_destination_kms_key_arn != "" ? [
        {
          Effect = "Allow"
          Action = [
            "kms:Decrypt",
            "kms:GenerateDataKey"
          ]
          Resource = var.replication_destination_kms_key_arn
        }
      ] : []
    )
  })
}

resource "aws_s3_bucket_replication_configuration" "frontend" {
  count  = local.replication_enabled ? 1 : 0
  bucket = aws_s3_bucket.frontend.id
  role   = aws_iam_role.replication[0].arn

  rule {
    id     = "replicate-all"
    status = "Enabled"

    filter {}

    destination {
      bucket        = var.replication_destination_bucket_arn
      storage_class = "STANDARD"
      account       = var.replication_destination_account_id != "" ? var.replication_destination_account_id : null

      dynamic "encryption_configuration" {
        for_each = var.replication_destination_kms_key_arn != "" ? [1] : []
        content {
          replica_kms_key_id = var.replication_destination_kms_key_arn
        }
      }
    }

    delete_marker_replication {
      status = "Enabled"
    }
  }

  depends_on = [aws_s3_bucket_versioning.frontend]
}