output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.alb.alb_dns_name
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = module.cloudfront.distribution_domain_name
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.db_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = module.elasticache.redis_endpoint
}

output "frontend_bucket" {
  description = "Frontend S3 bucket name"
  value       = module.s3_frontend.bucket_id
}

output "certificates_bucket" {
  description = "Certificates S3 bucket name"
  value       = module.s3_certificates.bucket_id
}

output "email_queue_url" {
  description = "Email SQS queue URL"
  value       = module.sqs.email_queue_url
}

output "payment_queue_url" {
  description = "Payment SQS queue URL"
  value       = module.sqs.payment_queue_url
}

output "cme_queue_url" {
  description = "CME SQS queue URL"
  value       = module.sqs.cme_queue_url
}
