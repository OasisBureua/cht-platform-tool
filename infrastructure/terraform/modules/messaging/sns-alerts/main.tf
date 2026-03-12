locals {
  prefix = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
}

resource "aws_sns_topic" "alerts" {
  name              = "${local.prefix}-alerts"
  display_name      = "CHT Platform Alarms"
  kms_master_key_id = var.kms_key_id != "" ? var.kms_key_id : null

  tags = {
    Name        = "${local.prefix}-alerts"
    Environment = var.environment
    Purpose     = "CloudWatch and SQS DLQ alarm notifications"
  }
}

resource "aws_sns_topic_policy" "alerts" {
  arn = aws_sns_topic.alerts.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Id      = "AllowCloudWatchAlarms"
    Statement = [
      {
        Sid    = "AllowCloudWatchAlarms"
        Effect = "Allow"
        Principal = {
          Service = "cloudwatch.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.alerts.arn
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = var.aws_account_id
          }
        }
      }
    ]
  })
}

resource "aws_sns_topic_subscription" "email" {
  for_each = toset(var.alarm_notification_emails)

  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = each.value
}
