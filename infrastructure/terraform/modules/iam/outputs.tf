output "ecs_execution_role_arn" {
  description = "ECS execution role ARN"
  value       = aws_iam_role.ecs_execution.arn
}

output "ecs_execution_role_name" {
  description = "ECS execution role name"
  value       = aws_iam_role.ecs_execution.name
}

output "ecs_execution_role_id" {
  description = "ECS execution role ID"
  value       = aws_iam_role.ecs_execution.id
}

output "ecs_task_role_arn" {
  description = "ECS task role ARN"
  value       = aws_iam_role.ecs_task.arn
}

output "ecs_task_role_name" {
  description = "ECS task role name"
  value       = aws_iam_role.ecs_task.name
}

output "ecs_task_role_id" {
  description = "ECS task role ID"
  value       = aws_iam_role.ecs_task.id
}
