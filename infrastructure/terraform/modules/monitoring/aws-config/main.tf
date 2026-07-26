locals {
  prefix                   = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
  manage_account_resources = var.environment == "platform"
}

# AWS Config recorder is one per AWS account/region, platform only.
resource "aws_s3_bucket" "config" {
  count  = local.manage_account_resources ? 1 : 0
  bucket = "${local.prefix}-aws-config-${var.aws_account_id}"

  tags = {
    Name        = "${local.prefix}-aws-config"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "config" {
  count  = local.manage_account_resources ? 1 : 0
  bucket = aws_s3_bucket.config[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "config" {
  count  = local.manage_account_resources ? 1 : 0
  bucket = aws_s3_bucket.config[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.s3_kms_key_arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "config" {
  count  = local.manage_account_resources ? 1 : 0
  bucket = aws_s3_bucket.config[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_iam_role" "config" {
  count = local.manage_account_resources ? 1 : 0
  name  = "${local.prefix}-aws-config"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "config.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = {
    Name        = "${local.prefix}-aws-config"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "config" {
  count      = local.manage_account_resources ? 1 : 0
  role       = aws_iam_role.config[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWS_ConfigRole"
}

resource "aws_iam_role_policy" "config_s3" {
  count = local.manage_account_resources ? 1 : 0
  name  = "${local.prefix}-aws-config-s3"
  role  = aws_iam_role.config[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetBucketAcl",
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ]
      Resource = aws_s3_bucket.config[0].arn
    }, {
      Effect = "Allow"
      Action = [
        "s3:PutObject",
        "s3:GetObject"
      ]
      Resource = "${aws_s3_bucket.config[0].arn}/*"
      Condition = {
        StringEquals = {
          "s3:x-amz-acl" = "bucket-owner-full-control"
        }
      }
    }]
  })
}

resource "aws_config_configuration_recorder" "main" {
  count    = local.manage_account_resources ? 1 : 0
  name     = "${local.prefix}-recorder"
  role_arn = aws_iam_role.config[0].arn

  recording_group {
    all_supported                 = true
    include_global_resource_types = true
  }
}

resource "aws_config_delivery_channel" "main" {
  count          = local.manage_account_resources ? 1 : 0
  name           = "${local.prefix}-delivery"
  s3_bucket_name = aws_s3_bucket.config[0].id

  depends_on = [aws_config_configuration_recorder.main]
}

resource "aws_config_configuration_recorder_status" "main" {
  count      = local.manage_account_resources ? 1 : 0
  name       = aws_config_configuration_recorder.main[0].name
  is_enabled = true

  depends_on = [aws_config_delivery_channel.main]
}

resource "aws_config_config_rule" "cloudtrail_enabled" {
  count = local.manage_account_resources ? 1 : 0
  name  = "${local.prefix}-cloudtrail-enabled"

  source {
    owner             = "AWS"
    source_identifier = "CLOUD_TRAIL_ENABLED"
  }

  depends_on = [aws_config_configuration_recorder_status.main]
}

resource "aws_config_config_rule" "s3_public_read" {
  count = local.manage_account_resources ? 1 : 0
  name  = "${local.prefix}-s3-public-read-prohibited"

  source {
    owner             = "AWS"
    source_identifier = "S3_BUCKET_PUBLIC_READ_PROHIBITED"
  }

  depends_on = [aws_config_configuration_recorder_status.main]
}

resource "aws_config_config_rule" "encrypted_volumes" {
  count = local.manage_account_resources ? 1 : 0
  name  = "${local.prefix}-encrypted-volumes"

  source {
    owner             = "AWS"
    source_identifier = "ENCRYPTED_VOLUMES"
  }

  depends_on = [aws_config_configuration_recorder_status.main]
}

resource "aws_config_config_rule" "rds_encrypted" {
  count = local.manage_account_resources ? 1 : 0
  name  = "${local.prefix}-rds-storage-encrypted"

  source {
    owner             = "AWS"
    source_identifier = "RDS_STORAGE_ENCRYPTED"
  }

  depends_on = [aws_config_configuration_recorder_status.main]
}
