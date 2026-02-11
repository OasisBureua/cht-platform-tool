terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "cht-platform-terraform-state-dev"
    key            = "us-east-1/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "cht-platform-terraform-locks"
  }
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      Region      = "us-east-1"
      ManagedBy   = "Terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

# ============================================
# Security - KMS Keys
# ============================================
module "kms" {
  source = "../../modules/security/kms"

  project        = var.project
  environment    = var.environment
  aws_region     = "us-east-1"
  aws_account_id = data.aws_caller_identity.current.account_id
}

# ============================================
# Networking - VPC
# ============================================
module "vpc" {
  source = "../../modules/networking/vpc"

  project            = var.project
  environment        = var.environment
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b"]
  enable_nat_gateway = true
  enable_flow_logs   = true
  cloudwatch_kms_key_arn = module.kms.cloudwatch_kms_key_arn
}

# ============================================
# Database - RDS PostgreSQL
# ============================================
module "rds" {
  source = "../../modules/database/rds"

  project                = var.project
  environment            = var.environment
  vpc_id                 = module.vpc.vpc_id
  private_subnet_ids     = module.vpc.private_subnet_ids
  allowed_security_groups = [module.ecs_backend.security_group_id]
  kms_key_arn            = module.kms.rds_kms_key_arn
  instance_class         = var.rds_instance_class
  allocated_storage      = var.rds_allocated_storage
  multi_az               = var.rds_multi_az
  backup_retention_period = var.rds_backup_retention
}

# ============================================
# Cache - ElastiCache Redis
# ============================================
module "elasticache" {
  source = "../../modules/cache/elasticache"

  project                = var.project
  environment            = var.environment
  vpc_id                 = module.vpc.vpc_id
  private_subnet_ids     = module.vpc.private_subnet_ids
  allowed_security_groups = [module.ecs_backend.security_group_id]
  kms_key_arn            = module.kms.elasticache_kms_key_arn
  cloudwatch_kms_key_arn = module.kms.cloudwatch_kms_key_arn
  node_type              = var.redis_node_type
  num_cache_nodes        = var.redis_num_nodes
}

# ============================================
# Storage - S3 Buckets
# ============================================
module "s3_frontend" {
  source = "../../modules/storage/s3-frontend"

  project     = var.project
  environment = var.environment
  kms_key_id  = module.kms.s3_kms_key_id
}

module "s3_certificates" {
  source = "../../modules/storage/s3-certificates"

  project         = var.project
  environment     = var.environment
  kms_key_id      = module.kms.s3_kms_key_id
  allowed_origins = ["https://app.${var.domain_name}"]
}

# ============================================
# Messaging - SQS Queues
# ============================================
module "sqs" {
  source = "../../modules/messaging/sqs"

  project     = var.project
  environment = var.environment
  kms_key_id  = module.kms.sqs_kms_key_id
}

# ============================================
# Security - Secrets Manager
# ============================================
module "secrets" {
  source = "../../modules/security/secrets-manager"

  project     = var.project
  environment = var.environment
  kms_key_id  = module.kms.secrets_kms_key_id

  db_username          = module.rds.db_username
  db_password          = module.rds.db_password
  db_endpoint          = module.rds.db_endpoint
  db_port              = module.rds.db_port
  db_name              = module.rds.db_name
  db_connection_string = module.rds.db_connection_string

  redis_endpoint = module.elasticache.redis_endpoint
  redis_port     = module.elasticache.redis_port

  stripe_secret_key      = var.stripe_secret_key
  stripe_publishable_key = var.stripe_publishable_key
  stripe_webhook_secret  = var.stripe_webhook_secret
  hubspot_smtp_user      = var.hubspot_smtp_user
  hubspot_smtp_password  = var.hubspot_smtp_password
  auth0_domain           = var.auth0_domain
  auth0_client_id        = var.auth0_client_id
  auth0_audience         = var.auth0_audience
}

# ============================================
# Security - IAM Roles
# ============================================
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

# ============================================
# Networking - ALB
# ============================================
module "alb" {
  source = "../../modules/networking/alb"

  project            = var.project
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  certificate_arn    = var.acm_certificate_arn
  enable_access_logs = false
}

# ============================================
# Compute - ECS Cluster
# ============================================
module "ecs_cluster" {
  source = "../../modules/compute/ecs-cluster"

  project                = var.project
  environment            = var.environment
  enable_container_insights = true
  log_retention_days     = var.environment == "prod" ? 7 : 3
  cloudwatch_kms_key_arn = module.kms.cloudwatch_kms_key_arn
}

# ============================================
# Compute - ECS Backend Service
# ============================================
module "ecs_backend" {
  source = "../../modules/compute/ecs-backend"

  project                = var.project
  environment            = var.environment
  aws_region             = "us-east-1"
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
  task_cpu               = var.backend_task_cpu
  task_memory            = var.backend_task_memory
  desired_count          = var.backend_desired_count
  min_capacity           = var.backend_min_capacity
  max_capacity           = var.backend_max_capacity
}

# ============================================
# Compute - ECS Worker Service
# ============================================
module "ecs_worker" {
  source = "../../modules/compute/ecs-worker"

  project             = var.project
  environment         = var.environment
  aws_region          = "us-east-1"
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
  task_cpu            = var.worker_task_cpu
  task_memory         = var.worker_task_memory
  desired_count       = var.worker_desired_count
  min_capacity        = var.worker_min_capacity
  max_capacity        = var.worker_max_capacity
}

# ============================================
# Networking - CloudFront
# ============================================
module "cloudfront" {
  source = "../../modules/networking/cloudfront"

  project                  = var.project
  environment              = var.environment
  s3_bucket_id             = module.s3_frontend.bucket_id
  s3_bucket_domain_name    = module.s3_frontend.bucket_domain_name
  cloudfront_oai_path      = module.s3_frontend.cloudfront_oai_path
  certificate_arn          = var.cloudfront_certificate_arn
  domain_aliases           = []  # Managed by Route53
  price_class              = var.environment == "prod" ? "PriceClass_100" : "PriceClass_100"
}

# ============================================
# Networking - Route53 DNS
# ============================================
module "route53" {
  source = "../../modules/networking/route53"

  project     = var.project
  environment = var.environment
  subdomain_zone = var.domain_name

  primary_alb_dns            = module.alb.alb_dns_name
  primary_alb_zone_id        = module.alb.alb_zone_id
  primary_cloudfront_dns     = module.cloudfront.distribution_domain_name
  primary_cloudfront_zone_id = module.cloudfront.distribution_hosted_zone_id

  alarm_actions = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []
}

# ============================================
# Monitoring - CloudWatch
# ============================================
module "cloudwatch" {
  source = "../../modules/monitoring/cloudwatch"

  project        = var.project
  environment    = var.environment
  aws_region     = "us-east-1"
  cluster_name   = module.ecs_cluster.cluster_name
  db_instance_id = split(":", module.rds.db_endpoint)[0]
  alb_arn_suffix = split("/", module.alb.alb_arn)[3]
  log_group_name = module.ecs_cluster.log_group_name
  sns_topic_arn  = var.sns_topic_arn
}
