# Get current AWS account and region
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name
}

# ============================================================================
# RDS ENCRYPTION KEY
# ============================================================================

resource "aws_kms_key" "rds" {
  description             = "${var.project_name} RDS encryption key - ${var.environment}"
  deletion_window_in_days = var.deletion_window_days
  enable_key_rotation     = var.enable_key_rotation
  multi_region            = false

  tags = merge(
    var.common_tags,
    {
      Name       = "${var.project_name}-rds-key-${var.environment}"
      Purpose    = "RDS Encryption"
      Compliance = "HIPAA"
    }
  )
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${var.project_name}-rds-${var.environment}"
  target_key_id = aws_kms_key.rds.key_id
}

resource "aws_kms_key_policy" "rds" {
  key_id = aws_kms_key.rds.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow RDS to use the key"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:CreateGrant"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "rds.${local.region}.amazonaws.com"
          }
        }
      }
    ]
  })
}

# ============================================================================
# S3 ENCRYPTION KEY
# ============================================================================

resource "aws_kms_key" "s3" {
  description             = "${var.project_name} S3 encryption key - ${var.environment}"
  deletion_window_in_days = var.deletion_window_days
  enable_key_rotation     = var.enable_key_rotation
  multi_region            = false

  tags = merge(
    var.common_tags,
    {
      Name       = "${var.project_name}-s3-key-${var.environment}"
      Purpose    = "S3 Encryption"
      Compliance = "HIPAA"
    }
  )
}

resource "aws_kms_alias" "s3" {
  name          = "alias/${var.project_name}-s3-${var.environment}"
  target_key_id = aws_kms_key.s3.key_id
}

resource "aws_kms_key_policy" "s3" {
  key_id = aws_kms_key.s3.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow S3 to use the key"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow CloudFront to use key for S3"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_kms_grant" "s3_ecs" {
  count = var.ecs_task_role_arn != "" ? 1 : 0

  name              = "${var.project_name}-s3-ecs-grant-${var.environment}"
  key_id            = aws_kms_key.s3.key_id
  grantee_principal = var.ecs_task_role_arn

  operations = [
    "Decrypt",
    "DescribeKey",
    "GenerateDataKey"
  ]
}

# ============================================================================
# SQS ENCRYPTION KEY
# ============================================================================

resource "aws_kms_key" "sqs" {
  description             = "${var.project_name} SQS encryption key - ${var.environment}"
  deletion_window_in_days = var.deletion_window_days
  enable_key_rotation     = var.enable_key_rotation
  multi_region            = false

  tags = merge(
    var.common_tags,
    {
      Name    = "${var.project_name}-sqs-key-${var.environment}"
      Purpose = "SQS Encryption"
    }
  )
}

resource "aws_kms_alias" "sqs" {
  name          = "alias/${var.project_name}-sqs-${var.environment}"
  target_key_id = aws_kms_key.sqs.key_id
}

resource "aws_kms_key_policy" "sqs" {
  key_id = aws_kms_key.sqs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow SQS to use the key"
        Effect = "Allow"
        Principal = {
          Service = "sqs.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      }
    ]
  })
}

# ============================================================================
# PII FIELD ENCRYPTION KEY
# ============================================================================

resource "aws_kms_key" "pii" {
  description             = "${var.project_name} PII field encryption key - ${var.environment}"
  deletion_window_in_days = var.deletion_window_days
  enable_key_rotation     = var.enable_key_rotation
  multi_region            = false

  tags = merge(
    var.common_tags,
    {
      Name         = "${var.project_name}-pii-key-${var.environment}"
      Purpose      = "PII Field Encryption"
      Compliance   = "HIPAA"
      CriticalData = "true"
    }
  )
}

resource "aws_kms_alias" "pii" {
  name          = "alias/${var.project_name}-pii-${var.environment}"
  target_key_id = aws_kms_key.pii.key_id
}

resource "aws_kms_key_policy" "pii" {
  key_id = aws_kms_key.pii.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Deny deletion by anyone except root"
        Effect = "Deny"
        Principal = "*"
        Action = [
          "kms:ScheduleKeyDeletion",
          "kms:Delete*"
        ]
        Resource = "*"
        Condition = {
          StringNotEquals = {
            "aws:PrincipalArn" = "arn:aws:iam::${local.account_id}:root"
          }
        }
      }
    ]
  })
}

resource "aws_kms_grant" "pii_backend" {
  count = var.backend_task_role_arn != "" ? 1 : 0

  name              = "${var.project_name}-pii-backend-grant-${var.environment}"
  key_id            = aws_kms_key.pii.key_id
  grantee_principal = var.backend_task_role_arn

  operations = [
    "Decrypt",
    "Encrypt",
    "GenerateDataKey",
    "DescribeKey"
  ]
}

resource "aws_kms_grant" "pii_worker" {
  count = var.worker_task_role_arn != "" ? 1 : 0

  name              = "${var.project_name}-pii-worker-grant-${var.environment}"
  key_id            = aws_kms_key.pii.key_id
  grantee_principal = var.worker_task_role_arn

  operations = [
    "Decrypt",
    "DescribeKey"
  ]
}

# ============================================================================
# SECRETS MANAGER ENCRYPTION KEY
# ============================================================================

resource "aws_kms_key" "secrets" {
  description             = "${var.project_name} Secrets Manager encryption key - ${var.environment}"
  deletion_window_in_days = var.deletion_window_days
  enable_key_rotation     = var.enable_key_rotation
  multi_region            = false

  tags = merge(
    var.common_tags,
    {
      Name       = "${var.project_name}-secrets-key-${var.environment}"
      Purpose    = "Secrets Manager Encryption"
      Compliance = "HIPAA"
    }
  )
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/${var.project_name}-secrets-${var.environment}"
  target_key_id = aws_kms_key.secrets.key_id
}

resource "aws_kms_key_policy" "secrets" {
  key_id = aws_kms_key.secrets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow Secrets Manager to use the key"
        Effect = "Allow"
        Principal = {
          Service = "secretsmanager.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      }
    ]
  })
}

# ============================================================================
# CLOUDWATCH LOGS ENCRYPTION KEY
# ============================================================================

resource "aws_kms_key" "cloudwatch" {
  description             = "${var.project_name} CloudWatch Logs encryption key - ${var.environment}"
  deletion_window_in_days = var.deletion_window_days
  enable_key_rotation     = var.enable_key_rotation
  multi_region            = false

  tags = merge(
    var.common_tags,
    {
      Name    = "${var.project_name}-cloudwatch-key-${var.environment}"
      Purpose = "CloudWatch Logs Encryption"
    }
  )
}

resource "aws_kms_alias" "cloudwatch" {
  name          = "alias/${var.project_name}-cloudwatch-${var.environment}"
  target_key_id = aws_kms_key.cloudwatch.key_id
}

resource "aws_kms_key_policy" "cloudwatch" {
  key_id = aws_kms_key.cloudwatch.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${local.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow CloudWatch Logs"
        Effect = "Allow"
        Principal = {
          Service = "logs.${local.region}.amazonaws.com"
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
            "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${local.region}:${local.account_id}:log-group:*"
          }
        }
      }
    ]
  })
}