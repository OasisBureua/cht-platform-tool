# Cognito → SNS / End User Messaging for SMS MFA and phone verification.
# Wire the pool with scripts/cognito-sync-pool-config.sh (MRR-safe) or the
# Cognito console "Configure SMS" using this role ARN + external ID.

locals {
  sms_external_id = "${local.name_prefix}-cognito-sms"
}

data "aws_iam_policy_document" "cognito_sms_assume" {
  count = var.enable_sms_mfa ? 1 : 0

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["cognito-idp.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values   = [local.sms_external_id]
    }
  }
}

resource "aws_iam_role" "cognito_sms" {
  count = var.enable_sms_mfa ? 1 : 0

  name               = "${local.name_prefix}-cognito-sms"
  assume_role_policy = data.aws_iam_policy_document.cognito_sms_assume[0].json

  tags = {
    Name        = "${local.name_prefix}-cognito-sms"
    Environment = var.environment
    Purpose     = "cognito-sms-mfa"
  }
}

data "aws_iam_policy_document" "cognito_sms_publish" {
  count = var.enable_sms_mfa ? 1 : 0

  statement {
    sid    = "AllowSnsPublishForCognitoSms"
    effect = "Allow"
    actions = [
      "sns:Publish",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "cognito_sms_publish" {
  count = var.enable_sms_mfa ? 1 : 0

  name   = "${local.name_prefix}-cognito-sms-publish"
  role   = aws_iam_role.cognito_sms[0].id
  policy = data.aws_iam_policy_document.cognito_sms_publish[0].json
}
