# Main Terraform Configuration
# This file orchestrates all infrastructure modules

# ============================================
# Secrets Module (Create First)
# ============================================
module "secrets" {
  source = "./modules/secrets"

  project_name = var.project_name
  environment  = var.environment

  # Database credentials
  db_master_password = var.db_master_password
  db_username        = var.db_username
  db_name            = var.db_name

  # Application secrets
  jwt_secret            = var.jwt_secret
  auth_client_id        = var.auth_client_id
  auth_client_secret    = var.auth_client_secret
  stripe_secret_key     = var.stripe_secret_key
  stripe_webhook_secret = var.stripe_webhook_secret
  vimeo_access_token    = var.vimeo_access_token
  youtube_api_key       = var.youtube_api_key
}

# ============================================
# Networking Module
# ============================================
module "networking" {
  source = "./modules/networking"

  project_name       = var.project_name
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  enable_nat_gateway = var.enable_nat_gateway
  app_port           = var.app_port
}

# ============================================
# IAM Module
# ============================================
module "iam" {
  source = "./modules/iam"

  project_name   = var.project_name
  environment    = var.environment
  secrets_arns   = module.secrets.all_secret_arns
  s3_bucket_arns = [module.storage.uploads_bucket_arn, module.storage.logs_bucket_arn]
  enable_ses     = var.enable_ses
}

# ============================================
# Storage Module
# ============================================
module "storage" {
  source = "./modules/storage"

  project_name                   = var.project_name
  environment                    = var.environment
  enable_versioning              = var.enable_s3_versioning
  allowed_origins                = var.cors_allowed_origins
  log_retention_days             = var.s3_log_retention_days
  create_terraform_state_bucket  = var.create_terraform_state_bucket
}

# ============================================
# Database Module
# ============================================
module "database" {
  source = "./modules/database"

  project_name       = var.project_name
  environment        = var.environment
  private_subnet_ids = module.networking.private_subnet_ids

  # Security groups
  rds_security_group_id   = module.networking.rds_postgres_security_group_id
  redis_security_group_id = module.networking.elasticache_redis_security_group_id

  # Database password from Secrets Manager
  db_password_secret_arn = module.secrets.db_master_password_secret_arn

  # PostgreSQL configuration
  postgres_engine_version   = var.postgres_engine_version
  database_name             = var.db_name
  master_username           = var.db_username
  instance_class            = var.rds_instance_class
  instance_count            = var.rds_instance_count
  min_capacity              = var.rds_min_capacity
  max_capacity              = var.rds_max_capacity
  backup_retention_period   = var.rds_backup_retention_period
  preferred_backup_window   = var.rds_preferred_backup_window

  # Redis configuration
  redis_engine_version   = var.redis_engine_version
  redis_node_type        = var.redis_node_type
  redis_num_cache_nodes  = var.redis_num_cache_nodes
}

# ============================================
# Compute Module (ECS + ECR)
# ============================================
module "compute" {
  source = "./modules/compute"

  project_name       = var.project_name
  environment        = var.environment
  aws_region         = var.aws_region
  private_subnet_ids = module.networking.private_subnet_ids

  # Security and networking
  ecs_security_group_id = module.networking.ecs_backend_security_group_id
  target_group_arn      = module.networking.backend_target_group_arn
  alb_listener_arn      = module.networking.http_listener_arn

  # IAM roles
  execution_role_arn = module.iam.ecs_execution_role_arn
  task_role_arn      = module.iam.ecs_task_role_arn

  # Task configuration
  task_cpu               = var.ecs_task_cpu
  task_memory            = var.ecs_task_memory
  container_port         = var.app_port
  image_tag              = var.docker_image_tag
  desired_count          = var.ecs_desired_count
  min_capacity           = var.ecs_min_capacity
  max_capacity           = var.ecs_max_capacity
  cpu_target_value       = var.ecs_cpu_target_value
  memory_target_value    = var.ecs_memory_target_value
  enable_container_insights = var.enable_container_insights
  log_retention_days     = var.cloudwatch_log_retention_days

  # Environment variables (non-sensitive)
  environment_variables = [
    {
      name  = "NODE_ENV"
      value = var.environment
    },
    {
      name  = "PORT"
      value = tostring(var.app_port)
    },
    {
      name  = "POSTGRES_HOST"
      value = module.database.postgres_cluster_endpoint
    },
    {
      name  = "POSTGRES_PORT"
      value = tostring(module.database.postgres_cluster_port)
    },
    {
      name  = "POSTGRES_DB"
      value = module.database.postgres_database_name
    },
    {
      name  = "REDIS_HOST"
      value = module.database.redis_primary_endpoint
    },
    {
      name  = "REDIS_PORT"
      value = tostring(module.database.redis_port)
    }
  ]

  # Secrets (sensitive values from Secrets Manager)
  secrets = [
    {
      name      = "DATABASE_URL"
      valueFrom = "${module.secrets.db_connection_string_secret_arn}:url::"
    },
    {
      name      = "JWT_SECRET"
      valueFrom = "${module.secrets.app_secrets_arn}:JWT_SECRET::"
    },
    {
      name      = "AUTH_CLIENT_ID"
      valueFrom = "${module.secrets.app_secrets_arn}:AUTH_CLIENT_ID::"
    },
    {
      name      = "AUTH_CLIENT_SECRET"
      valueFrom = "${module.secrets.app_secrets_arn}:AUTH_CLIENT_SECRET::"
    },
    {
      name      = "STRIPE_SECRET_KEY"
      valueFrom = "${module.secrets.app_secrets_arn}:STRIPE_SECRET_KEY::"
    },
    {
      name      = "STRIPE_WEBHOOK_SECRET"
      valueFrom = "${module.secrets.app_secrets_arn}:STRIPE_WEBHOOK_SECRET::"
    },
    {
      name      = "VIMEO_ACCESS_TOKEN"
      valueFrom = "${module.secrets.app_secrets_arn}:VIMEO_ACCESS_TOKEN::"
    },
    {
      name      = "YOUTUBE_API_KEY"
      valueFrom = "${module.secrets.app_secrets_arn}:YOUTUBE_API_KEY::"
    }
  ]

  depends_on = [module.secrets, module.database]
}

# ============================================
# Update Secrets with Database Connection Info
# ============================================
module "secrets_update" {
  source = "./modules/secrets"

  project_name = var.project_name
  environment  = var.environment

  # Database credentials
  db_master_password = var.db_master_password
  db_username        = var.db_username
  db_name            = var.db_name
  db_endpoint        = module.database.postgres_cluster_endpoint
  db_port            = module.database.postgres_cluster_port

  # Redis info
  redis_endpoint = module.database.redis_primary_endpoint
  redis_port     = module.database.redis_port

  # Application secrets
  jwt_secret            = var.jwt_secret
  auth_client_id        = var.auth_client_id
  auth_client_secret    = var.auth_client_secret
  stripe_secret_key     = var.stripe_secret_key
  stripe_webhook_secret = var.stripe_webhook_secret
  vimeo_access_token    = var.vimeo_access_token
  youtube_api_key       = var.youtube_api_key

  depends_on = [module.database]
}
