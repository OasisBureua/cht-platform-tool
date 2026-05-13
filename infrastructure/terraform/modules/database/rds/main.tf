locals {
  prefix = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
}

resource "aws_db_subnet_group" "main" {
  name       = "${local.prefix}-db-subnet"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "${local.prefix}-db-subnet-group"
    Environment = var.environment
  }
}

resource "aws_security_group" "rds" {
  name        = "${local.prefix}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from ECS tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${local.prefix}-rds-sg"
    Environment = var.environment
  }
}

resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_db_parameter_group" "main" {
  name        = "${local.prefix}-postgres"
  family      = "postgres15"
  description = "Custom parameter group for ${var.project} ${var.environment}"

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  tags = {
    Name        = "${local.prefix}-postgres-params"
    Environment = var.environment
  }
}

resource "aws_db_instance" "main" {
  identifier     = "${local.prefix}-db"
  engine         = "postgres"
  engine_version = var.engine_version

  instance_class    = var.instance_class
  allocated_storage = var.allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true
  kms_key_id        = var.kms_key_arn

  db_name  = var.database_name
  username = var.master_username
  password = random_password.db_password.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.main.name

  backup_retention_period = var.backup_retention_period
  backup_window           = "03:00-04:00"
  maintenance_window      = "mon:04:00-mon:05:00"

  multi_az                  = var.multi_az
  publicly_accessible       = false
  deletion_protection       = (var.environment == "prod" || var.environment == "platform") ? true : false
  skip_final_snapshot       = var.environment == "dev" ? true : false
  final_snapshot_identifier = var.environment == "dev" ? null : "${local.prefix}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  performance_insights_enabled    = true
  performance_insights_kms_key_id = var.kms_key_arn

  auto_minor_version_upgrade = true
  copy_tags_to_snapshot      = true

  tags = {
    Name        = "${local.prefix}-db"
    Environment = var.environment
  }

  lifecycle {
    # RDS does not allow changing subnet group or parameter group on existing instances
    ignore_changes = [db_subnet_group_name, parameter_group_name]
  }
}