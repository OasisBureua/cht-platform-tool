output "zone_id" {
  description = "Route53 zone ID"
  value       = aws_route53_zone.platform.zone_id
}

output "name_servers" {
  description = "Route53 nameservers (add these to your main DNS)"
  value       = aws_route53_zone.platform.name_servers
}

output "api_fqdn" {
  description = "API fully qualified domain name"
  value       = "api.${var.subdomain_zone}"
}

output "app_fqdn" {
  description = "App fully qualified domain name"
  value       = "app.${var.subdomain_zone}"
}

output "health_check_id" {
  description = "Primary health check ID"
  value       = aws_route53_health_check.primary.id
}

output "zone_name" {
  description = "Zone name"
  value       = aws_route53_zone.platform.name
}