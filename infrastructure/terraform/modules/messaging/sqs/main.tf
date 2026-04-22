locals {
  prefix = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
}

resource "aws_sqs_queue" "email_dlq" {
  name                      = "${local.prefix}-email-dlq"
  delay_seconds             = 0
  max_message_size          = 262144  # 256 KB
  message_retention_seconds = 1209600 # 14 days
  receive_wait_time_seconds = 0

  kms_master_key_id                 = var.kms_key_id
  kms_data_key_reuse_period_seconds = 300

  tags = {
    Name        = "${local.prefix}-email-dlq"
    Environment = var.environment
    Purpose     = "Email dead letter queue"
  }
}

resource "aws_sqs_queue" "email" {
  name                       = "${local.prefix}-email-queue"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 345600 # 4 days
  receive_wait_time_seconds  = 20     # Long polling
  visibility_timeout_seconds = 300    # 5 minutes

  kms_master_key_id                 = var.kms_key_id
  kms_data_key_reuse_period_seconds = 300

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.email_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "${local.prefix}-email-queue"
    Environment = var.environment
    Purpose     = "Email processing queue"
  }
}

# Payment Queue
resource "aws_sqs_queue" "payment_dlq" {
  name                      = "${local.prefix}-payment-dlq"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 1209600
  receive_wait_time_seconds = 0

  kms_master_key_id                 = var.kms_key_id
  kms_data_key_reuse_period_seconds = 300

  tags = {
    Name        = "${local.prefix}-payment-dlq"
    Environment = var.environment
    Purpose     = "Payment dead letter queue"
  }
}

resource "aws_sqs_queue" "payment" {
  name                       = "${local.prefix}-payment-queue"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 345600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 600 # 10 minutes for payment processing (worker)

  kms_master_key_id                 = var.kms_key_id
  kms_data_key_reuse_period_seconds = 300

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.payment_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "${local.prefix}-payment-queue"
    Environment = var.environment
    Purpose     = "Payment processing queue"
  }
}

# CME Queue
resource "aws_sqs_queue" "cme_dlq" {
  name                      = "${local.prefix}-cme-dlq"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 1209600
  receive_wait_time_seconds = 0

  kms_master_key_id                 = var.kms_key_id
  kms_data_key_reuse_period_seconds = 300

  tags = {
    Name        = "${local.prefix}-cme-dlq"
    Environment = var.environment
    Purpose     = "CME dead letter queue"
  }
}

resource "aws_sqs_queue" "cme" {
  name                       = "${local.prefix}-cme-queue"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 345600
  receive_wait_time_seconds  = 20
  visibility_timeout_seconds = 300

  kms_master_key_id                 = var.kms_key_id
  kms_data_key_reuse_period_seconds = 300

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.cme_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "${local.prefix}-cme-queue"
    Environment = var.environment
    Purpose     = "CME certificate generation queue"
  }
}

# CloudWatch Alarms for DLQs
resource "aws_cloudwatch_metric_alarm" "email_dlq" {
  alarm_name          = "${local.prefix}-email-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Average"
  threshold           = 0
  alarm_description   = "Alert when messages appear in email DLQ"
  treat_missing_data  = "notBreaching"

  alarm_actions = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []

  dimensions = {
    QueueName = aws_sqs_queue.email_dlq.name
  }

  tags = {
    Name        = "${local.prefix}-email-dlq-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "payment_dlq" {
  alarm_name          = "${local.prefix}-payment-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Average"
  threshold           = 0
  alarm_description   = "Alert when messages appear in payment DLQ"
  treat_missing_data  = "notBreaching"

  alarm_actions = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []

  dimensions = {
    QueueName = aws_sqs_queue.payment_dlq.name
  }

  tags = {
    Name        = "${local.prefix}-payment-dlq-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "cme_dlq" {
  alarm_name          = "${local.prefix}-cme-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Average"
  threshold           = 0
  alarm_description   = "Alert when messages appear in CME DLQ"
  treat_missing_data  = "notBreaching"

  alarm_actions = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []

  dimensions = {
    QueueName = aws_sqs_queue.cme_dlq.name
  }

  tags = {
    Name        = "${local.prefix}-cme-dlq-alarm"
    Environment = var.environment
  }
}