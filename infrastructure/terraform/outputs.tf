# Terraform Outputs

# ============================================
# Networking Outputs
# ============================================
output "vpc_id" {
  description = "VPC ID"
  value       = module.networking.vpc_id
}

output "alb_dns_name" {
  description = "Application Load Balancer DNS name"
  value       = module.networking.alb_dns_name
}

output "alb_url" {
  description = "Application Load Balancer URL"
  value       = "http://${module.networking.alb_dns_name}"
}

# ============================================
# Database Outputs
# ============================================
output "postgres_endpoint" {
  description = "PostgreSQL cluster endpoint"
  value       = module.database.postgres_cluster_endpoint
}

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = module.database.redis_primary_endpoint
}

# ============================================
# Compute Outputs
# ============================================
output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = module.compute.ecr_repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.compute.backend_cluster_name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = module.compute.backend_service_name
}

# ============================================
# Storage Outputs
# ============================================
output "uploads_bucket_name" {
  description = "S3 uploads bucket name"
  value       = module.storage.uploads_bucket_name
}

output "logs_bucket_name" {
  description = "S3 logs bucket name"
  value       = module.storage.logs_bucket_name
}

# ============================================
# Secrets Outputs
# ============================================
output "secrets_manager_names" {
  description = "Secrets Manager secret names"
  value = {
    db_password         = module.secrets.db_master_password_secret_name
    app_secrets         = module.secrets.app_secrets_name
    db_connection       = module.secrets.db_connection_string_secret_name
    redis_connection    = module.secrets.redis_connection_string_secret_name
  }
}

# ============================================
# Deployment Information
# ============================================
output "deployment_commands" {
  description = "Commands to deploy the application"
  value = <<-EOT
    # 1. Build and tag Docker image:
    docker build -t ${module.compute.ecr_repository_url}:backend-latest ../../../backend

    # 2. Authenticate Docker to ECR:
    aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${module.compute.ecr_repository_url}

    # 3. Push image to ECR:
    docker push ${module.compute.ecr_repository_url}:backend-latest

    # 4. Update ECS service:
    aws ecs update-service --cluster ${module.compute.backend_cluster_name} --service ${module.compute.backend_service_name} --force-new-deployment --region ${var.aws_region}

    # 5. Access your application:
    ${module.networking.alb_dns_name}
  EOT
}
