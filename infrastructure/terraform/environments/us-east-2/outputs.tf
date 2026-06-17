output "secondary_api_origin_domain" {
  description = "ALB DNS name in us-east-2 for CloudFront API origin failover."
  value       = module.alb.alb_dns_name
}

output "secondary_alb_zone_id" {
  description = "ALB hosted zone ID for diagnostics."
  value       = module.alb.alb_zone_id
}

output "secondary_backend_service_name" {
  description = "DR backend ECS service name."
  value       = module.ecs_backend.service_name
}

output "secondary_worker_service_name" {
  description = "DR worker ECS service name."
  value       = module.ecs_worker.service_name
}

output "dr_database_secret_arn" {
  description = "DR database secret ARN in us-east-2."
  value       = aws_secretsmanager_secret.database.arn
}

output "dr_app_secrets_arn" {
  description = "DR app-secrets ARN in us-east-2."
  value       = aws_secretsmanager_secret.app_secrets.arn
}

output "dr_read_replica_endpoint" {
  description = "DR cross-region read replica endpoint."
  value       = var.enable_db_replica ? aws_db_instance.replica[0].endpoint : null
}

output "dr_read_replica_identifier" {
  description = "DR cross-region read replica identifier."
  value       = var.enable_db_replica ? aws_db_instance.replica[0].id : null
}
