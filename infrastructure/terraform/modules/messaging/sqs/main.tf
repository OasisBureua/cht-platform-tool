resource "aws_sqs_queue" "email_dlq" {
    name                        = "${var.project}-${var.environment}-email-dlq"
    delay_seconds               = 0
    max_message_size            = 262144 # 256 KB
    message_retention_seconds   = 1209600 # 14 days
    receive_wait_time_seconds   = 0

    kms_master_key_id                   = var.kms_key_id
    kms_data_key_reuse_period_seconds   = 300

    tags = {
        Name        = "${var.project}-${var.environment}-email-dlq"
        Environment = var.environment
        Purpose     = "Email dead letter queue"
    }
}

resource "aws_sqs_queue" "email" {
  name                      = "${var.project}-${var.environment}-email-queue"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 345600  # 4 days
  receive_wait_time_seconds = 20      # Long polling
  visibility_timeout_seconds = 300    # 5 minutes
  
  kms_master_key_id       = var.kms_key_id
  kms_data_key_reuse_period_seconds = 300

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.email_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "${var.project}-${var.environment}-email-queue"
    Environment = var.environment
    Purpose     = "Email processing queue"
  }
}

# Payment Queue
resource "aws_sqs_queue" "payment_dlq" {
  name                      = "${var.project}-${var.environment}-payment-dlq"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 1209600
  receive_wait_time_seconds = 0
  
  kms_master_key_id       = var.kms_key_id
  kms_data_key_reuse_period_seconds = 300

  tags = {
    Name        = "${var.project}-${var.environment}-payment-dlq"
    Environment = var.environment
    Purpose     = "Payment dead letter queue"
  }
}

resource "aws_sqs_queue" "payment" {
  name                      = "${var.project}-${var.environment}-payment-queue"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 345600
  receive_wait_time_seconds = 20
  visibility_timeout_seconds = 600  # 10 minutes for payment processing
  
  kms_master_key_id       = var.kms_key_id
  kms_data_key_reuse_period_seconds = 300

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.payment_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "${var.project}-${var.environment}-payment-queue"
    Environment = var.environment
    Purpose     = "Payment processing queue"
  }
}

# CME Queue
resource "aws_sqs_queue" "cme_dlq" {
  name                      = "${var.project}-${var.environment}-cme-dlq"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 1209600
  receive_wait_time_seconds = 0
  
  kms_master_key_id       = var.kms_key_id
  kms_data_key_reuse_period_seconds = 300

  tags = {
    Name        = "${var.project}-${var.environment}-cme-dlq"
    Environment = var.environment
    Purpose     = "CME dead letter queue"
  }
}

resource "aws_sqs_queue" "cme" {
  name                      = "${var.project}-${var.environment}-cme-queue"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 345600
  receive_wait_time_seconds = 20
  visibility_timeout_seconds = 300
  
  kms_master_key_id       = var.kms_key_id
  kms_data_key_reuse_period_seconds = 300

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.cme_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "${var.project}-${var.environment}-cme-queue"
    Environment = var.environment
    Purpose     = "CME certificate generation queue"
  }
}

# CloudWatch Alarms for DLQs
resource "aws_cloudwatch_metric_alarm" "email_dlq" {
  alarm_name          = "${var.project}-${var.environment}-email-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Average"
  threshold           = 0
  alarm_description   = "Alert when messages appear in email DLQ"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.email_dlq.name
  }

  tags = {
    Name        = "${var.project}-${var.environment}-email-dlq-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "payment_dlq" {
  alarm_name          = "${var.project}-${var.environment}-payment-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Average"
  threshold           = 0
  alarm_description   = "Alert when messages appear in payment DLQ"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.payment_dlq.name
  }

  tags = {
    Name        = "${var.project}-${var.environment}-payment-dlq-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "cme_dlq" {
  alarm_name          = "${var.project}-${var.environment}-cme-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Average"
  threshold           = 0
  alarm_description   = "Alert when messages appear in CME DLQ"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.cme_dlq.name
  }

  tags = {
    Name        = "${var.project}-${var.environment}-cme-dlq-alarm"
    Environment = var.environment
  }
}