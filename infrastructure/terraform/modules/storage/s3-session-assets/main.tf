locals {
  prefix              = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
  replication_enabled = var.enable_replication && var.replication_destination_bucket_arn != ""
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

resource "aws_s3_bucket_versioning" "session_assets" {
  bucket = aws_s3_bucket.session_assets.id

  versioning_configuration {
    status = "Enabled"
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

resource "aws_iam_role" "replication" {
  count = local.replication_enabled ? 1 : 0
  name  = "${local.prefix}-session-assets-replication"

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
  name  = "${local.prefix}-session-assets-replication-policy"
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
          Resource = aws_s3_bucket.session_assets.arn
        },
        {
          Effect = "Allow"
          Action = [
            "s3:GetObjectVersionForReplication",
            "s3:GetObjectVersionAcl",
            "s3:GetObjectVersionTagging"
          ]
          Resource = "${aws_s3_bucket.session_assets.arn}/*"
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

resource "aws_s3_bucket_replication_configuration" "session_assets" {
  count  = local.replication_enabled ? 1 : 0
  bucket = aws_s3_bucket.session_assets.id
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

  depends_on = [aws_s3_bucket_versioning.session_assets]
}
