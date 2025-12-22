terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  backend "s3" {
    bucket         = "cht-platform-terraform-state-dev"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "cht-platform-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Get AWS account ID
data "aws_caller_identity" "current" {}

# KMS Module
module "kms" {
  source = "../../modules/security/kms"

  project        = var.project
  environment    = var.environment
  aws_region     = var.aws_region
  aws_account_id = data.aws_caller_identity.current.account_id
}

# VPC Module
module "vpc" {
  source = "../../modules/networking/vpc"

  project            = var.project
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  enable_nat_gateway = true
  enable_flow_logs   = true
  cloudwatch_kms_key_arn = module.kms.cloudwatch_kms_key_arn
}

# RDS Module
module "rds" {
  source = "../../modules/database/rds"

  project                = var.project
  environment            = var.environment
  vpc_id                 = module.vpc.vpc_id
  private_subnet_ids     = module.vpc.private_subnet_ids
  allowed_security_groups = []  # Will be populated after ECS
  kms_key_arn            = module.kms.rds_kms_key_arn
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  multi_az               = false
  backup_retention_period = 7
}

# ElastiCache Module
module "elasticache" {
  source = "../../modules/cache/elasticache"

  project                = var.project
  environment            = var.environment
  vpc_id                 = module.vpc.vpc_id
  private_subnet_ids     = module.vpc.private_subnet_ids
  allowed_security_groups = []  # Will be populated after ECS
  kms_key_arn            = module.kms.elasticache_kms_key_arn
  cloudwatch_kms_key_arn = module.kms.cloudwatch_kms_key_arn
  node_type              = "cache.t3.micro"
  num_cache_nodes        = 1
}

# S3 Frontend Module
module "s3_frontend" {
  source = "../../modules/storage/s3-frontend"

  project     = var.project
  environment = var.environment
  kms_key_id  = module.kms.s3_kms_key_id
}

# S3 Certificates Module
module "s3_certificates" {
  source = "../../modules/storage/s3-certificates"

  project         = var.project
  environment     = var.environment
  kms_key_id      = module.kms.s3_kms_key_id
  allowed_origins = ["*"]  # Update with your frontend domain
}

# SQS Module
module "sqs" {
  source = "../../modules/messaging/sqs"

  project     = var.project
  environment = var.environment
  kms_key_id  = module.kms.sqs_kms_key_id
}

# Secrets Manager Module
module "secrets" {
  source = "../../modules/security/secrets-manager"

  project     = var.project
  environment = var.environment
  kms_key_id  = module.kms.secrets_kms_key_id

  # Database
  db_username          = module.rds.db_username
  db_password          = module.rds.db_password
  db_endpoint          = module.rds.db_endpoint
  db_port              = module.rds.db_port
  db_name              = module.rds.db_name
  db_connection_string = module.rds.db_connection_string

  # Redis
  redis_endpoint = module.elasticache.redis_endpoint
  redis_port     = module.elasticache.redis_port

  # Application secrets (set via environment variables or AWS Console)
  stripe_secret_key      = var.stripe_secret_key
  stripe_publishable_key = var.stripe_publishable_key
  stripe_webhook_secret  = var.stripe_webhook_secret
  sendgrid_api_key       = var.sendgrid_api_key
  auth0_domain           = var.auth0_domain
  auth0_client_id        = var.auth0_client_id
  auth0_audience         = var.auth0_audience
}

# IAM Module
module "iam" {
  source = "../../modules/security/iam"

  project                 = var.project
  environment             = var.environment
  secrets_arns            = [
    module.secrets.database_secret_arn,
    module.secrets.redis_secret_arn,
    module.secrets.app_secrets_arn
  ]
  kms_key_arns            = [
    module.kms.secrets_kms_key_arn,
    module.kms.sqs_kms_key_arn
  ]
  sqs_queue_arns          = [
    module.sqs.email_queue_arn,
    module.sqs.payment_queue_arn,
    module.sqs.cme_queue_arn
  ]
  certificates_bucket_arn = module.s3_certificates.bucket_arn
}

# ALB Module
module "alb" {
  source = "../../modules/networking/alb"

  project            = var.project
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  certificate_arn    = var.acm_certificate_arn
  enable_access_logs = false
}

# ECS Cluster Module
module "ecs_cluster" {
  source = "../../modules/compute/ecs-cluster"

  project                = var.project
  environment            = var.environment
  enable_container_insights = true
  log_retention_days     = 7
  cloudwatch_kms_key_arn = module.kms.cloudwatch_kms_key_arn
}

# ECS Backend Module
module "ecs_backend" {
  source = "../../modules/compute/ecs-backend"

  project                = var.project
  environment            = var.environment
  aws_region             = var.aws_region
  vpc_id                 = module.vpc.vpc_id
  private_subnet_ids     = module.vpc.private_subnet_ids
  cluster_id             = module.ecs_cluster.cluster_id
  cluster_name           = module.ecs_cluster.cluster_name
  execution_role_arn     = module.iam.ecs_task_execution_role_arn
  task_role_arn          = module.iam.ecs_task_role_arn
  alb_security_group_id  = module.alb.alb_security_group_id
  target_group_arn       = module.alb.backend_target_group_arn
  alb_listener_arn       = module.alb.https_listener_arn
  log_group_name         = module.ecs_cluster.log_group_name
  container_image        = var.backend_image
  database_secret_arn    = module.secrets.database_secret_arn
  redis_secret_arn       = module.secrets.redis_secret_arn
  app_secrets_arn        = module.secrets.app_secrets_arn
  task_cpu               = 256
  task_memory            = 512
  desired_count          = 1
  min_capacity           = 1
  max_capacity           = 2
}

# ECS Worker Module
module "ecs_worker" {
  source = "../../modules/compute/ecs-worker"

  project             = var.project
  environment         = var.environment
  aws_region          = var.aws_region
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  cluster_id          = module.ecs_cluster.cluster_id
  cluster_name        = module.ecs_cluster.cluster_name
  execution_role_arn  = module.iam.ecs_task_execution_role_arn
  task_role_arn       = module.iam.worker_task_role_arn
  log_group_name      = module.ecs_cluster.log_group_name
  container_image     = var.worker_image
  database_secret_arn = module.secrets.database_secret_arn
  app_secrets_arn     = module.secrets.app_secrets_arn
  primary_queue_name  = "${var.project}-${var.environment}-email-queue"
  task_cpu            = 256
  task_memory         = 512
  desired_count       = 1
  min_capacity        = 1
  max_capacity        = 5
}

# CloudFront Module
module "cloudfront" {
  source = "../../modules/networking/cloudfront"

  project                  = var.project
  environment              = var.environment
  s3_bucket_id             = module.s3_frontend.bucket_id
  s3_bucket_domain_name    = module.s3_frontend.bucket_domain_name
  cloudfront_oai_path      = module.s3_frontend.cloudfront_oai_path
  certificate_arn          = var.cloudfront_certificate_arn
  domain_aliases           = var.domain_aliases
  price_class              = "PriceClass_100"
}

# CloudWatch Module
module "cloudwatch" {
  source = "../../modules/monitoring/cloudwatch"

  project        = var.project
  environment    = var.environment
  aws_region     = var.aws_region
  cluster_name   = module.ecs_cluster.cluster_name
  db_instance_id = module.rds.db_instance_id
  alb_arn_suffix = split("/", module.alb.alb_arn)[1]
  log_group_name = module.ecs_cluster.log_group_name
  sns_topic_arn  = var.sns_topic_arn
}
