# Queue URLs
output "email_queue_url" {
  description = "Email queue URL"
  value       = aws_sqs_queue.email.url
}

output "payment_queue_url" {
  description = "Payment queue URL"
  value       = aws_sqs_queue.payment.url
}

output "cme_queue_url" {
  description = "CME queue URL"
  value       = aws_sqs_queue.cme.url
}

# Queue ARNs
output "email_queue_arn" {
  description = "Email queue ARN"
  value       = aws_sqs_queue.email.arn
}

output "payment_queue_arn" {
  description = "Payment queue ARN"
  value       = aws_sqs_queue.payment.arn
}

output "cme_queue_arn" {
  description = "CME queue ARN"
  value       = aws_sqs_queue.cme.arn
}

# DLQ URLs
output "email_dlq_url" {
  description = "Email DLQ URL"
  value       = aws_sqs_queue.email_dlq.url
}

output "payment_dlq_url" {
  description = "Payment DLQ URL"
  value       = aws_sqs_queue.payment_dlq.url
}

output "cme_dlq_url" {
  description = "CME DLQ URL"
  value       = aws_sqs_queue.cme_dlq.url
}

# IAM Policies
output "backend_sqs_policy_arn" {
  description = "Backend SQS send policy ARN"
  value       = aws_iam_policy.backend_sqs_send.arn
}

output "worker_sqs_policy_arn" {
  description = "Worker SQS consume policy ARN"
  value       = aws_iam_policy.worker_sqs_consume.arn
}

# All Queue URLs (convenience)
output "all_queue_urls" {
  description = "Map of all queue URLs"
  value = {
    email   = aws_sqs_queue.email.url
    payment = aws_sqs_queue.payment.url
    cme     = aws_sqs_queue.cme.url
  }
}