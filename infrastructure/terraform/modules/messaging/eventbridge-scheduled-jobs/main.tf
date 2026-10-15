locals {
  prefix = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
}

# ── EventBridge rule: session reminders ────────────────────────────────────────
resource "aws_cloudwatch_event_rule" "session_reminders" {
  name                = "${local.prefix}-session-reminders"
  schedule_expression = var.session_reminders_schedule
  description         = "Triggers worker to scan APPROVED registrations ~24h before a live session and email reminders"

  tags = {
    Name        = "${local.prefix}-session-reminders-rule"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "session_reminders" {
  rule      = aws_cloudwatch_event_rule.session_reminders.name
  target_id = "SessionRemindersSqs"
  arn       = var.scheduled_jobs_queue_arn

  # The worker's ScheduledConsumer branches on this type field
  input = jsonencode({ type = "SESSION_REMINDERS" })
}

# ── SQS queue policy: allow EventBridge to SendMessage ────────────────────────
data "aws_iam_policy_document" "eventbridge_to_sqs" {
  statement {
    sid    = "AllowEventBridgeSessionReminders"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    actions   = ["sqs:SendMessage"]
    resources = [var.scheduled_jobs_queue_arn]

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudwatch_event_rule.session_reminders.arn]
    }
  }
}

resource "aws_sqs_queue_policy" "eventbridge_to_sqs" {
  queue_url = var.scheduled_jobs_queue_url
  policy    = data.aws_iam_policy_document.eventbridge_to_sqs.json
}
