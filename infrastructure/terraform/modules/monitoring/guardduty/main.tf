locals {
  prefix = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"

  # GuardDuty severity bands: 0.1–3.9 Low, 4.0–6.9 Medium, 7.0–8.9 High.
  # EventBridge numeric matching: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns-content-based-filtering.html
  finding_event_pattern = {
    source      = ["aws.guardduty"]
    detail-type = ["GuardDuty Finding"]
    detail = merge(
      {
        severity = [{ numeric = [">=", var.min_severity] }]
      },
      length(var.excluded_finding_types) > 0 ? {
        type = [{ "anything-but" = var.excluded_finding_types }]
      } : {},
    )
  }
}

# GuardDuty detector: one per AWS account/region.
resource "aws_guardduty_detector" "main" {
  count  = var.enable_detector ? 1 : 0
  enable = true

  # How often GuardDuty re-publishes *updated* findings (same finding ID) to EventBridge.
  # New finding IDs are still near real-time. Default SIX_HOURS reduces alert churn.
  finding_publishing_frequency = var.finding_publishing_frequency

  tags = {
    Name        = "${local.prefix}-guardduty"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_rule" "guardduty_findings" {
  count       = var.enable_detector ? 1 : 0
  name        = "${local.prefix}-guardduty-findings"
  description = "Route GuardDuty findings (severity >= ${var.min_severity}) to SNS alerts"

  event_pattern = jsonencode(local.finding_event_pattern)

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

  # Human-readable email body instead of raw EventBridge JSON.
  # Template must be a JSON string value (quoted); use \n for line breaks.
  input_transformer {
    input_paths = {
      severity    = "$.detail.severity"
      title       = "$.detail.title"
      type        = "$.detail.type"
      description = "$.detail.description"
      region      = "$.detail.region"
      account     = "$.detail.accountId"
      finding_id  = "$.detail.id"
      count       = "$.detail.service.count"
      first_seen  = "$.detail.service.eventFirstSeen"
      last_seen   = "$.detail.service.eventLastSeen"
    }

    input_template = "\"GuardDuty alert (severity <severity>)\\n\\n<title>\\n\\nType: <type>\\nAccount: <account>\\nRegion: <region>\\nOccurrences: <count>\\nFirst seen: <first_seen>\\nLast seen: <last_seen>\\n\\n<description>\\n\\nConsole: https://console.aws.amazon.com/guardduty/home?region=<region>#/findings?search=id%3D<finding_id>\""
  }
}
