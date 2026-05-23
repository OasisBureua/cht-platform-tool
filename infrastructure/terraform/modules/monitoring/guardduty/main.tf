locals {
  prefix                   = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
  manage_account_resources = var.environment == "platform"
}

# GuardDuty detector is one per AWS account/region — platform only.
resource "aws_guardduty_detector" "main" {
  count  = local.manage_account_resources ? 1 : 0
  enable = true

  tags = {
    Name        = "${local.prefix}-guardduty"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_rule" "guardduty_findings" {
  count       = local.manage_account_resources ? 1 : 0
  name        = "${local.prefix}-guardduty-findings"
  description = "Route GuardDuty findings to SNS alerts"

  event_pattern = jsonencode({
    source      = ["aws.guardduty"]
    detail-type = ["GuardDuty Finding"]
  })

  tags = {
    Name        = "${local.prefix}-guardduty-findings"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "guardduty_sns" {
  count     = local.manage_account_resources ? 1 : 0
  rule      = aws_cloudwatch_event_rule.guardduty_findings[0].name
  target_id = "guardduty-sns"
  arn       = var.sns_topic_arn
}
