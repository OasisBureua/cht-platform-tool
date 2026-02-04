output "alb_arn" {
  description = "ALB ARN"
  value       = aws_lb.main.arn
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "ALB zone ID"
  value       = aws_lb.main.zone_id
}

output "alb_security_group_id" {
  description = "ALB security group ID"
  value       = aws_security_group.alb.id
}

output "backend_target_group_arn" {
  description = "Backend target group ARN"
  value       = aws_lb_target_group.backend.arn
}

output "http_listener_arn" {
  description = "HTTP listener ARN"
  value       = coalesce(
    try(aws_lb_listener.http_redirect[0].arn, ""),
    try(aws_lb_listener.http_forward[0].arn, "")
  )
}

output "https_listener_arn" {
  description = "HTTPS listener ARN"
  value       = var.certificate_arn != "" ? aws_lb_listener.https[0].arn : ""
}