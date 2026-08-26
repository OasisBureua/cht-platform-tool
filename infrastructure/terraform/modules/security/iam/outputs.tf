output "ecs_task_execution_role_arn" {
  description = "ECS task execution role ARN"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "ecs_task_role_arn" {
  description = "ECS task role ARN (for backend)"
  value       = aws_iam_role.ecs_task.arn
}

output "worker_task_role_arn" {
  description = "Worker task role ARN"
  value       = aws_iam_role.worker_task.arn
}