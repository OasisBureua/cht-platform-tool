locals {
  prefix = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.prefix}-redis-subnet"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "${local.prefix}-redis-subnet-group"
    Environment = var.environment
  }
}

# Ingress is added from the root module (after ECS backend SG exists) to avoid
# a Terraform dependency cycle with REDIS_URL on the backend task definition.
resource "aws_security_group" "redis" {
  name        = "${local.prefix}-redis-sg"
  description = "Security group for ElastiCache Redis"
  vpc_id      = var.vpc_id

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${local.prefix}-redis-sg"
    Environment = var.environment
  }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${local.prefix}-redis"
  description          = "Upstream cache (YouTube / Content Hub) for ${var.project} ${var.environment}"

  engine               = "redis"
  engine_version       = var.engine_version
  node_type            = var.node_type
  port                 = var.port
  parameter_group_name = "default.redis7"
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]

  num_cache_clusters         = 1
  automatic_failover_enabled = false
  multi_az_enabled           = false
  at_rest_encryption_enabled = true
  transit_encryption_enabled = false
  auto_minor_version_upgrade = true
  snapshot_retention_limit   = 0

  tags = {
    Name        = "${local.prefix}-redis"
    Environment = var.environment
  }
}
