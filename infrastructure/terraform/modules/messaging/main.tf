# Get current AWS account
data "aws_caller_identity" "current" {}

# ============================================================================
# EMAIL QUEUE AND DLQ
# ============================================================================

resource "aws_sqs_queue" "email_dlq" {
  name                      = "${var.project_name}-email-dlq-${var.environment}"
  message_retention_seconds = 1209600 # 14 days

  tags = merge(
    var.common_tags,
    {
      Name    = "${var.project_name}-email-dlq-${var.environment}"
      JobType = "Email DLQ"
    }
  )
}

resource "aws_sqs_queue" "email" {
  name                       = "${var.project_name}-email-queue-${var.environment}"
  visibility_timeout_seconds = 300     # 5 minutes
  message_retention_seconds  = 345600  # 4 days
  delay_seconds              = 0
  receive_wait_time_seconds  = 20 # Long polling
  max_message_size           = 262144 # 256 KB

  # KMS encryption
  sqs_managed_sse_enabled           = false
  kms_master_key_id                 = var.sqs_kms_key_id
  kms_data_key_reuse_period_seconds = 300

  # Dead Letter Queue
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.email_dlq.arn
    maxReceiveCount     = 3 # Retry 3 times before DLQ
  })

  tags = merge(
    var.common_tags,
    {
      Name     = "${var.project_name}-email-queue-${var.environment}"
      JobType  = "Email"
      Priority = "Medium"
    }
  )
}

resource "aws_cloudwatch_metric_alarm" "email_dlq" {
  alarm_name          = "${var.project_name}-email-dlq-messages-${var.environment}"
  alarm_description   = "Alert when messages appear in Email DLQ"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Average"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.email_dlq.name
  }
}

# ============================================================================
# PAYMENT QUEUE AND DLQ
# ============================================================================

resource "aws_sqs_queue" "payment_dlq" {
  name                      = "${var.project_name}-payment-dlq-${var.environment}"
  message_retention_seconds = 1209600 # 14 days

  tags = merge(
    var.common_tags,
    {
      Name    = "${var.project_name}-payment-dlq-${var.environment}"
      JobType = "Payment DLQ"
    }
  )
}

resource "aws_sqs_queue" "payment" {
  name                       = "${var.project_name}-payment-queue-${var.environment}"
  visibility_timeout_seconds = 600    # 10 minutes (payments take longer)
  message_retention_seconds  = 345600 # 4 days
  delay_seconds              = 0
  receive_wait_time_seconds  = 20
  max_message_size           = 262144

  sqs_managed_sse_enabled           = false
  kms_master_key_id                 = var.sqs_kms_key_id
  kms_data_key_reuse_period_seconds = 300

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.payment_dlq.arn
    maxReceiveCount     = 5 # More retries for payments
  })

  tags = merge(
    var.common_tags,
    {
      Name     = "${var.project_name}-payment-queue-${var.environment}"
      JobType  = "Payment"
      Priority = "High"
    }
  )
}

resource "aws_cloudwatch_metric_alarm" "payment_dlq" {
  alarm_name          = "${var.project_name}-payment-dlq-messages-${var.environment}"
  alarm_description   = "Alert when messages appear in Payment DLQ"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Average"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.payment_dlq.name
  }
}

# ============================================================================
# CME QUEUE AND DLQ
# ============================================================================

resource "aws_sqs_queue" "cme_dlq" {
  name                      = "${var.project_name}-cme-dlq-${var.environment}"
  message_retention_seconds = 1209600 # 14 days

  tags = merge(
    var.common_tags,
    {
      Name    = "${var.project_name}-cme-dlq-${var.environment}"
      JobType = "CME DLQ"
    }
  )
}

resource "aws_sqs_queue" "cme" {
  name                       = "${var.project_name}-cme-queue-${var.environment}"
  visibility_timeout_seconds = 900    # 15 minutes (PDF generation)
  message_retention_seconds  = 345600 # 4 days
  delay_seconds              = 0
  receive_wait_time_seconds  = 20
  max_message_size           = 262144

  sqs_managed_sse_enabled           = false
  kms_master_key_id                 = var.sqs_kms_key_id
  kms_data_key_reuse_period_seconds = 300

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.cme_dlq.arn
    maxReceiveCount     = 3
  })

  tags = merge(
    var.common_tags,
    {
      Name     = "${var.project_name}-cme-queue-${var.environment}"
      JobType  = "CME Certificate"
      Priority = "Medium"
    }
  )
}

resource "aws_cloudwatch_metric_alarm" "cme_dlq" {
  alarm_name          = "${var.project_name}-cme-dlq-messages-${var.environment}"
  alarm_description   = "Alert when messages appear in CME DLQ"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Average"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.cme_dlq.name
  }
}

# ============================================================================
# IAM POLICIES
# ============================================================================

# IAM Policy for Backend (Send Messages)
resource "aws_iam_policy" "backend_sqs_send" {
  name        = "${var.project_name}-backend-sqs-send-${var.environment}"
  description = "Allow backend to send messages to SQS queues"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SendMessagesToQueues"
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:GetQueueUrl",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.email.arn,
          aws_sqs_queue.payment.arn,
          aws_sqs_queue.cme.arn
        ]
      },
      {
        Sid    = "UseKMSKey"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = var.sqs_kms_key_arn
      }
    ]
  })

  tags = var.common_tags
}

# IAM Policy for Worker (Receive/Delete Messages)
resource "aws_iam_policy" "worker_sqs_consume" {
  name        = "${var.project_name}-worker-sqs-consume-${var.environment}"
  description = "Allow worker to receive and delete messages from SQS queues"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ConsumeMessagesFromQueues"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:GetQueueUrl",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = [
          aws_sqs_queue.email.arn,
          aws_sqs_queue.payment.arn,
          aws_sqs_queue.cme.arn
        ]
      },
      {
        Sid    = "DecryptKMSKey"
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = var.sqs_kms_key_arn
      }
    ]
  })

  tags = var.common_tags
}