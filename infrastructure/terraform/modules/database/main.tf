# Database Module - RDS Aurora PostgreSQL + ElastiCache Redis

# ============================================
# RDS Subnet Group
# ============================================
resource "aws_db_subnet_group" "postgres" {
  name       = "${var.project_name}-postgres-${var.environment}-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "${var.project_name}-postgres-${var.environment}-subnet-group"
    Project     = var.project_name
    Environment = var.environment
    Service     = "database"
    ManagedBy   = "terraform"
  }
}

# ============================================
# Get Database Password from Secrets Manager
# ============================================
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = var.db_password_secret_arn
}

# ============================================
# RDS Aurora PostgreSQL Cluster
# ============================================
resource "aws_rds_cluster" "postgres" {
  cluster_identifier      = "${var.project_name}-postgres-${var.environment}-cluster"
  engine                  = "aurora-postgresql"
  engine_mode             = "provisioned"
  engine_version          = var.postgres_engine_version
  database_name           = var.database_name
  master_username         = var.master_username
  master_password         = data.aws_secretsmanager_secret_version.db_password.secret_string
  
  db_subnet_group_name    = aws_db_subnet_group.postgres.name
  vpc_security_group_ids  = [var.rds_security_group_id]
  
  backup_retention_period = var.backup_retention_period
  preferred_backup_window = var.preferred_backup_window
  
  skip_final_snapshot     = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "${var.project_name}-postgres-${var.environment}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null
  
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  serverlessv2_scaling_configuration {
    max_capacity = var.max_capacity
    min_capacity = var.min_capacity
  }

  tags = {
    Name        = "${var.project_name}-postgres-${var.environment}-cluster"
    Project     = var.project_name
    Environment = var.environment
    Service     = "database"
    Engine      = "postgresql"
    ManagedBy   = "terraform"
  }

  lifecycle {
    ignore_changes = [final_snapshot_identifier]
  }
}

# ============================================
# RDS Aurora PostgreSQL Instance
# ============================================
resource "aws_rds_cluster_instance" "postgres" {
  count              = var.instance_count
  identifier         = "${var.project_name}-postgres-${var.environment}-instance-${count.index + 1}"
  cluster_identifier = aws_rds_cluster.postgres.id
  instance_class     = var.instance_class
  engine             = aws_rds_cluster.postgres.engine
  engine_version     = aws_rds_cluster.postgres.engine_version

  tags = {
    Name        = "${var.project_name}-postgres-${var.environment}-instance-${count.index + 1}"
    Project     = var.project_name
    Environment = var.environment
    Service     = "database"
    ManagedBy   = "terraform"
  }
}

# ============================================
# ElastiCache Subnet Group
# ============================================
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project_name}-redis-${var.environment}-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "${var.project_name}-redis-${var.environment}-subnet-group"
    Project     = var.project_name
    Environment = var.environment
    Service     = "cache"
    ManagedBy   = "terraform"
  }
}

# ============================================
# ElastiCache Redis Replication Group
# ============================================
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${var.project_name}-redis-${var.environment}"
  replication_group_description = "Redis cache for ${var.project_name} ${var.environment}"
  
  engine                     = "redis"
  engine_version             = var.redis_engine_version
  node_type                  = var.redis_node_type
  num_cache_clusters         = var.redis_num_cache_nodes
  port                       = 6379
  
  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [var.redis_security_group_id]
  
  automatic_failover_enabled = var.redis_num_cache_nodes > 1
  multi_az_enabled           = var.redis_num_cache_nodes > 1
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = false
  
  snapshot_retention_limit   = var.environment == "prod" ? 5 : 1
  snapshot_window            = "03:00-05:00"
  maintenance_window         = "mon:05:00-mon:07:00"
  
  auto_minor_version_upgrade = true

  tags = {
    Name        = "${var.project_name}-redis-${var.environment}-cache"
    Project     = var.project_name
    Environment = var.environment
    Service     = "cache"
    Engine      = "redis"
    ManagedBy   = "terraform"
  }
}
