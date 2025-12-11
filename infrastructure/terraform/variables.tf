# Terraform Variables Definition

# ============================================
# General Configuration
# ============================================
variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "cht-platform"
}

variable "environment" {
  description = "Environment name (dev, test, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# ============================================
# Networking Configuration
# ============================================
variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "app_port" {
  description = "Application port"
  type        = number
  default     = 3000
}

# ============================================
# Database Configuration
# ============================================
variable "db_name" {
  description = "Database name"
  type        = string
  default     = "cht_platform"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "postgres"
}

variable "db_master_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

variable "postgres_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.serverless"
}

variable "rds_instance_count" {
  description = "Number of RDS instances"
  type        = number
  default     = 1
}

variable "rds_min_capacity" {
  description = "Minimum Aurora Serverless capacity (ACU)"
  type        = number
  default     = 0.5
}

variable "rds_max_capacity" {
  description = "Maximum Aurora Serverless capacity (ACU)"
  type        = number
  default     = 4
}

variable "rds_backup_retention_period" {
  description = "RDS backup retention period in days"
  type        = number
  default     = 7
}

variable "rds_preferred_backup_window" {
  description = "RDS preferred backup window"
  type        = string
  default     = "03:00-04:00"
}

# ============================================
# Redis Configuration
# ============================================
variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
}

variable "redis_node_type" {
  description = "Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of Redis cache nodes"
  type        = number
  default     = 1
}

# ============================================
# ECS Configuration
# ============================================
variable "ecs_task_cpu" {
  description = "ECS task CPU units"
  type        = string
  default     = "256"
}

variable "ecs_task_memory" {
  description = "ECS task memory in MB"
  type        = string
  default     = "512"
}

variable "docker_image_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
}

variable "ecs_desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
}

variable "ecs_min_capacity" {
  description = "Minimum number of ECS tasks"
  type        = number
  default     = 1
}

variable "ecs_max_capacity" {
  description = "Maximum number of ECS tasks"
  type        = number
  default     = 10
}

variable "ecs_cpu_target_value" {
  description = "Target CPU utilization for autoscaling"
  type        = number
  default     = 70
}

variable "ecs_memory_target_value" {
  description = "Target memory utilization for autoscaling"
  type        = number
  default     = 80
}

variable "enable_container_insights" {
  description = "Enable ECS Container Insights"
  type        = bool
  default     = true
}

variable "cloudwatch_log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

# ============================================
# Storage Configuration
# ============================================
variable "enable_s3_versioning" {
  description = "Enable S3 versioning for uploads bucket"
  type        = bool
  default     = true
}

variable "cors_allowed_origins" {
  description = "CORS allowed origins for S3"
  type        = list(string)
  default     = ["*"]
}

variable "s3_log_retention_days" {
  description = "S3 log retention in days"
  type        = number
  default     = 30
}

variable "create_terraform_state_bucket" {
  description = "Create S3 bucket for Terraform state"
  type        = bool
  default     = false
}

# ============================================
# IAM Configuration
# ============================================
variable "enable_ses" {
  description = "Enable SES email permissions"
  type        = bool
  default     = false
}

# ============================================
# Application Secrets
# ============================================
variable "jwt_secret" {
  description = "JWT secret key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "auth_client_id" {
  description = "Auth provider client ID"
  type        = string
  sensitive   = true
  default     = ""
}

variable "auth_client_secret" {
  description = "Auth provider client secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_secret_key" {
  description = "Stripe secret key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "vimeo_access_token" {
  description = "Vimeo access token"
  type        = string
  sensitive   = true
  default     = ""
}

variable "youtube_api_key" {
  description = "YouTube API key"
  type        = string
  sensitive   = true
  default     = ""
}
