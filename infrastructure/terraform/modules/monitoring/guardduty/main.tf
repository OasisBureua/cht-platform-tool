locals {
  prefix = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
}

# GuardDuty detector — one per AWS account/region.
resource "aws_guardduty_detector" "main" {
  count  = var.enable_detector ? 1 : 0
  enable = true

  tags = {
    Name        = "${local.prefix}-guardduty"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_rule" "guardduty_findings" {
  count       = var.enable_detector ? 1 : 0
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
  count     = var.enable_detector ? 1 : 0
  rule      = aws_cloudwatch_event_rule.guardduty_findings[0].name
  target_id = "guardduty-sns"
  arn       = var.sns_topic_arn
}
