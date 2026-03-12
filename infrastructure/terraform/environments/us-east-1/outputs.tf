# Infrastructure
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.alb.alb_dns_name
}

output "alb_zone_id" {
  description = "ALB zone ID"
  value       = module.alb.alb_zone_id
}

output "cloudfront_domain_name" {
  description = "CloudFront domain"
  value       = module.cloudfront.distribution_domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.cloudfront.distribution_id
}

output "cloudfront_zone_id" {
  description = "CloudFront zone ID"
  value       = module.cloudfront.distribution_hosted_zone_id
}

# Storage
output "frontend_bucket" {
  description = "Frontend S3 bucket"
  value       = module.s3_frontend.bucket_id
}

output "certificates_bucket" {
  description = "Certificates S3 bucket"
  value       = module.s3_certificates.bucket_id
}

# Database
output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.db_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = module.elasticache.redis_endpoint
}

# Alerts
output "sns_alerts_topic_arn" {
  description = "SNS topic ARN for alarm notifications"
  value       = module.sns_alerts.topic_arn
}

# Queues
output "email_queue_url" {
  description = "Email queue URL"
  value       = module.sqs.email_queue_url
}

output "payment_queue_url" {
  description = "Payment queue URL"
  value       = module.sqs.payment_queue_url
}

output "cme_queue_url" {
  description = "CME queue URL"
  value       = module.sqs.cme_queue_url
}

# Route53
output "route53_zone_id" {
  description = "Route53 zone ID"
  value       = module.route53.zone_id
}

output "route53_nameservers" {
  description = "Route53 nameservers - ADD THESE TO YOUR DNS PROVIDER"
  value       = module.route53.name_servers
}

output "platform_url" {
  description = "Platform URL (single domain)"
  value       = "https://${module.route53.root_fqdn}"
}

output "api_url" {
  description = "API URL (path-based: /api/*)"
  value       = "https://${module.route53.root_fqdn}/api"
}

# Cluster
output "cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs_cluster.cluster_name
}

# Next steps
output "next_steps" {
  description = "What to do next"
  value       = <<-EOT
    
    ✅ us-east-1 (Primary) deployed successfully!
    
    📋 Add NS records in your DNS provider (GoDaddy for communityhealth.media):
    
    Type: NS
    Name: testapp
    Value: Add 4 records, one per line:
    ${join("\n    ", module.route53.name_servers)}
    
    This delegates ${var.domain_name} to Route53.
    
    🌐 URL: https://${var.domain_name}
    API:  https://${var.domain_name}/api/*
    
    🧪 Test your deployment:
    curl https://${var.domain_name}/health/ready
    
    💰 Current cost: ~$273/month
    
    📦 Next: Deploy frontend
       cd ../../../frontend
       npm run build
       aws s3 sync dist/ s3://${module.s3_frontend.bucket_id}/
  EOT
}