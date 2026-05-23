locals {
  prefix = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
}

resource "aws_guardduty_detector" "main" {
  enable = true

  tags = {
    Name        = "${local.prefix}-guardduty"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_rule" "guardduty_findings" {
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
  rule      = aws_cloudwatch_event_rule.guardduty_findings.name
  target_id = "guardduty-sns"
  arn       = var.sns_topic_arn
}
