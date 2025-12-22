output "service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.worker.name
}

output "service_id" {
  description = "ECS service ID"
  value       = aws_ecs_service.worker.id
}

output "task_definition_arn" {
  description = "Task definition ARN"
  value       = aws_ecs_task_definition.worker.arn
}

output "security_group_id" {
  description = "Worker security group ID"
  value       = aws_security_group.worker.id
}