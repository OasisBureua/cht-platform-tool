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

# ── EventBridge rule: Bill.com MFA rememberMeId expiry reminder ───────────────
# Bill.com's MFA-trusted session (rememberMeId) always expires 30 days after it
# is set, and there is no way to renew it without a human completing an MFA
# challenge (an OTP is sent to a device). So we cannot fully automate the refresh
# — instead we fire a reminder ~20 days out (10-day buffer) to the alerts topic.
resource "aws_cloudwatch_event_rule" "bill_mfa_reminder" {
  count = var.enable_bill_mfa_reminder ? 1 : 0

  name                = "${local.prefix}-bill-mfa-reminder"
  schedule_expression = var.bill_mfa_reminder_schedule
  description         = "Reminder to refresh the Bill.com MFA rememberMeId before its 30-day expiry"

  tags = {
    Name        = "${local.prefix}-bill-mfa-reminder-rule"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "bill_mfa_reminder" {
  count = var.enable_bill_mfa_reminder ? 1 : 0

  rule      = aws_cloudwatch_event_rule.bill_mfa_reminder[0].name
  target_id = "BillMfaReminderSns"
  arn       = var.alerts_topic_arn

  # Plain-text SNS email body. A quoted input_template makes EventBridge deliver
  # the message as readable text instead of a raw JSON blob. Avoid double quotes
  # inside the body (they must be escaped in the JSON-string template).
  input_transformer {
    input_template = <<-EOT
      "[${local.prefix}] Refresh Bill.com MFA rememberMeId before its 30-day expiry.

      This reminder fires every 20 days so you always have ~10 days of buffer before the
      rememberMeId expires. Bill.com cannot refresh it automatically because the MFA
      challenge sends a one-time code to a human device.

      Action required - regenerate a trusted session and update the secret:
        1. POST /v3/mfa/challenge (send a body, e.g. useBackup=false) and read the OTP sent to the device.
        2. POST /v3/mfa/challenge/validate with challengeId, token, device, rememberMe=true, then copy the returned mfaId (this is the rememberMeId).
        3. Update Secrets Manager key bill_mfa_remember_me_id for ${local.prefix} with the new value; leave bill_mfa_device_name unchanged.
        4. Restart / redeploy the backend so it picks up the refreshed BILL_MFA_REMEMBER_ME_ID.

      Verify: GET /v3/login/session should report mfaStatus=COMPLETE, and pay-now should succeed with no BDC_1361 error."
    EOT
  }
}
