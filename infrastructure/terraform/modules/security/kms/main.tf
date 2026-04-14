locals {
  prefix = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
}

# KMS Key for RDS Database Encryption
resource "aws_kms_key" "rds" {
    description             = "${local.prefix} RDS encryption key"
    deletion_window_in_days = var.deletion_window_in_days
    enable_key_rotation     = true

    tags = {
        Name        = "${local.prefix}-rds-key"
        Environment = var.environment
        Service     = "rds"
    }
}

resource "aws_kms_alias" "rds" {
    name           = "alias/${local.prefix}-rds"
    target_key_id  = aws_kms_key.rds.id
}

# KMS Key for Elasticache Redis Encryption
resource "aws_kms_key" "elasticache" {
    description             = "${local.prefix} Elasticache encryption key"
    deletion_window_in_days = var.deletion_window_in_days
    enable_key_rotation     = true

    tags = {
        Name        = "${local.prefix}-elasticache-key"
        Environment = var.environment
        Service     = "elasticache"
    }
}

resource "aws_kms_alias" "elasticache" {
  name          = "alias/${local.prefix}-elasticache"
  target_key_id = aws_kms_key.elasticache.key_id
}

resource "aws_kms_key" "s3" {
   description             = "${local.prefix} S3 encryption key"
   deletion_window_in_days = var.deletion_window_in_days
   enable_key_rotation     = true

   tags = {
    Name        = "${local.prefix}-s3-key"
    Environment = var.environment
    Service     = "s3"
  } 
}

resource "aws_kms_alias" "s3" {
    name          = "alias/${local.prefix}-s3"
    target_key_id = aws_kms_key.s3.key_id
}

# KMS Key for Secrets Manager
resource "aws_kms_key" "secrets" {
  description             = "${local.prefix} Secrets Manager encryption key"
  deletion_window_in_days = var.deletion_window_in_days
  enable_key_rotation     = true

  tags = {
    Name        = "${local.prefix}-secrets-key"
    Environment = var.environment
    Service     = "secrets-manager"
  }
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/${local.prefix}-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}

# KMS Key for SQS Queue Encryption
resource "aws_kms_key" "sqs" {
  description             = "${local.prefix} SQS encryption key"
  deletion_window_in_days = var.deletion_window_in_days
  enable_key_rotation     = true

  tags = {
    Name        = "${local.prefix}-sqs-key"
    Environment = var.environment
    Service     = "sqs"
  }
}

resource "aws_kms_alias" "sqs" {
  name          = "alias/${local.prefix}-sqs"
  target_key_id = aws_kms_key.sqs.key_id
}

# KMS Key for CloudWatch Logs Encryption
resource "aws_kms_key" "cloudwatch" {
  description             = "${local.prefix} CloudWatch Logs encryption key"
  deletion_window_in_days = var.deletion_window_in_days
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${var.aws_account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow CloudWatch Logs"
        Effect = "Allow"
        Principal = {
          Service = "logs.${var.aws_region}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:CreateGrant",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          ArnLike = {
            "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:*"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "${local.prefix}-cloudwatch-key"
    Environment = var.environment
    Service     = "cloudwatch"
  }
}

resource "aws_kms_alias" "cloudwatch" {
  name          = "alias/${local.prefix}-cloudwatch"
  target_key_id = aws_kms_key.cloudwatch.key_id
}

# KMS Key for SNS Alerts
resource "aws_kms_key" "sns" {
  description             = "${local.prefix} SNS encryption key"
  deletion_window_in_days = var.deletion_window_in_days
  enable_key_rotation     = true

  tags = {
    Name        = "${local.prefix}-sns-key"
    Environment = var.environment
    Service     = "sns"
  }
}

resource "aws_kms_alias" "sns" {
  name          = "alias/${local.prefix}-sns"
  target_key_id = aws_kms_key.sns.key_id
}