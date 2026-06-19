data "aws_iam_policy_document" "cognito_mrk" {
  count = var.enable_multi_region_replication ? 1 : 0

  statement {
    sid    = "AllowRootAccount"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }

    actions   = ["kms:*"]
    resources = ["*"]
  }

  statement {
    sid    = "AllowCognitoAndIdentityStore"
    effect = "Allow"

    principals {
      type = "Service"
      identifiers = [
        "cognito-idp.amazonaws.com",
        "identitystore.amazonaws.com",
      ]
    }

    actions = [
      "kms:CreateGrant",
      "kms:Decrypt",
      "kms:DescribeKey",
      "kms:Encrypt",
      "kms:GenerateDataKey*",
      "kms:ReEncrypt*",
    ]

    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_kms_key" "cognito_mrk" {
  count = var.enable_multi_region_replication ? 1 : 0

  description             = "${local.name_prefix} Cognito user pool encryption (multi-Region)"
  deletion_window_in_days = var.kms_deletion_window_in_days
  enable_key_rotation     = true
  multi_region            = true
  policy                  = data.aws_iam_policy_document.cognito_mrk[0].json

  tags = {
    Name        = "${local.name_prefix}-cognito-mrk"
    Environment = var.environment
    Service     = "cognito"
  }
}

resource "aws_kms_alias" "cognito_mrk" {
  count = var.enable_multi_region_replication ? 1 : 0

  name          = "alias/${local.name_prefix}-cognito-mrk"
  target_key_id = aws_kms_key.cognito_mrk[0].key_id
}

resource "aws_kms_replica_key" "cognito_mrk" {
  count = var.enable_multi_region_replication ? 1 : 0

  provider = aws.replica

  description             = "${local.name_prefix} Cognito user pool encryption replica"
  deletion_window_in_days = var.kms_deletion_window_in_days
  primary_key_arn         = aws_kms_key.cognito_mrk[0].arn
  policy                  = data.aws_iam_policy_document.cognito_mrk[0].json

  tags = {
    Name        = "${local.name_prefix}-cognito-mrk-replica"
    Environment = var.environment
    Service     = "cognito"
  }
}
