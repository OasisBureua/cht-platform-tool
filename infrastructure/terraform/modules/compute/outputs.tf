output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.platform.repository_url
}

output "ecr_repository_name" {
  description = "ECR repository name"
  value       = aws_ecr_repository.platform.name
}

output "ecr_repository_arn" {
  description = "ECR repository ARN"
  value       = aws_ecr_repository.platform.arn
}

output "backend_cluster_id" {
  description = "Backend ECS cluster ID"
  value       = aws_ecs_cluster.backend.id
}

output "backend_cluster_name" {
  description = "Backend ECS cluster name"
  value       = aws_ecs_cluster.backend.name
}

output "backend_cluster_arn" {
  description = "Backend ECS cluster ARN"
  value       = aws_ecs_cluster.backend.arn
}

output "backend_service_name" {
  description = "Backend ECS service name"
  value       = aws_ecs_service.backend.name
}

output "backend_service_id" {
  description = "Backend ECS service ID"
  value       = aws_ecs_service.backend.id
}

output "backend_log_group_name" {
  description = "Backend CloudWatch log group name"
  value       = aws_cloudwatch_log_group.backend.name
}

output "backend_log_group_arn" {
  description = "Backend CloudWatch log group ARN"
  value       = aws_cloudwatch_log_group.backend.arn
}
