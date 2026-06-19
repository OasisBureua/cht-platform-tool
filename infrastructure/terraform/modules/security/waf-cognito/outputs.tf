output "web_acl_id" {
  description = "Regional WAF Web ACL ID"
  value       = aws_wafv2_web_acl.cognito.id
}

output "web_acl_arn" {
  description = "Regional WAF Web ACL ARN"
  value       = aws_wafv2_web_acl.cognito.arn
}

output "web_acl_name" {
  description = "Regional WAF Web ACL name"
  value       = aws_wafv2_web_acl.cognito.name
}
