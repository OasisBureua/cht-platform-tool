output "postgres_cluster_id" {
  description = "PostgreSQL cluster ID"
  value       = aws_rds_cluster.postgres.id
}

output "postgres_cluster_endpoint" {
  description = "PostgreSQL cluster endpoint"
  value       = aws_rds_cluster.postgres.endpoint
}

output "postgres_cluster_reader_endpoint" {
  description = "PostgreSQL cluster reader endpoint"
  value       = aws_rds_cluster.postgres.reader_endpoint
}

output "postgres_cluster_port" {
  description = "PostgreSQL cluster port"
  value       = aws_rds_cluster.postgres.port
}

output "postgres_database_name" {
  description = "PostgreSQL database name"
  value       = aws_rds_cluster.postgres.database_name
}

output "postgres_master_username" {
  description = "PostgreSQL master username"
  value       = aws_rds_cluster.postgres.master_username
  sensitive   = true
}

output "redis_primary_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "Redis reader endpoint"
  value       = aws_elasticache_replication_group.redis.reader_endpoint_address
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.redis.port
}

output "redis_configuration_endpoint" {
  description = "Redis configuration endpoint"
  value       = aws_elasticache_replication_group.redis.configuration_endpoint_address
}
