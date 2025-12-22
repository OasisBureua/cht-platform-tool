output "email_queue_url" {
  description = "Email queue URL"
  value       = aws_sqs_queue.email.url
}

output "email_queue_arn" {
  description = "Email queue ARN"
  value       = aws_sqs_queue.email.arn
}

output "payment_queue_url" {
  description = "Payment queue URL"
  value       = aws_sqs_queue.payment.url
}

output "payment_queue_arn" {
  description = "Payment queue ARN"
  value       = aws_sqs_queue.payment.arn
}

output "cme_queue_url" {
  description = "CME queue URL"
  value       = aws_sqs_queue.cme.url
}

output "cme_queue_arn" {
  description = "CME queue ARN"
  value       = aws_sqs_queue.cme.arn
}

output "email_dlq_arn" {
  description = "Email DLQ ARN"
  value       = aws_sqs_queue.email_dlq.arn
}

output "payment_dlq_arn" {
  description = "Payment DLQ ARN"
  value       = aws_sqs_queue.payment_dlq.arn
}

output "cme_dlq_arn" {
  description = "CME DLQ ARN"
  value       = aws_sqs_queue.cme_dlq.arn
}