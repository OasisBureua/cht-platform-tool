output "zone_id" {
  description = "Route53 zone ID"
  value       = aws_route53_zone.platform.zone_id
}

output "name_servers" {
  description = "Route53 nameservers (add these to your main DNS)"
  value       = aws_route53_zone.platform.name_servers
}

output "root_fqdn" {
  description = "Root/apex fully qualified domain name (single domain)"
  value       = var.subdomain_zone
}

output "api_fqdn" {
  description = "API FQDN (path-based under root: /api/*)"
  value       = var.subdomain_zone
}

output "app_fqdn" {
  description = "App FQDN (same as root)"
  value       = var.subdomain_zone
}

output "health_check_id" {
  description = "Primary health check ID"
  value       = aws_route53_health_check.primary.id
}

output "zone_name" {
  description = "Zone name"
  value       = aws_route53_zone.platform.name
}