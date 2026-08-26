output "service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.backend.name
}

output "service_id" {
  description = "ECS service ID"
  value       = aws_ecs_service.backend.id
}

output "task_definition_arn" {
  description = "Task definition ARN"
  value       = aws_ecs_task_definition.backend.arn
}

output "security_group_id" {
  description = "Backend security group ID"
  value       = aws_security_group.backend.id
}