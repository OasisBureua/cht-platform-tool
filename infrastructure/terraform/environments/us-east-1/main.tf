terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "cht-platform-terraform-state" # Create with: aws s3 mb s3://cht-platform-terraform-state
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

locals {
  resource_prefix = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
}

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

  project                = var.project
  environment            = var.environment
  vpc_cidr               = "10.0.0.0/16"
  availability_zones     = ["us-east-1a", "us-east-1b"]
  enable_nat_gateway     = true
  enable_flow_logs       = true
  cloudwatch_kms_key_arn = module.kms.cloudwatch_kms_key_arn
}

# ============================================
# Worker Security Group (created early for RDS access - avoids circular dep)
# ============================================
resource "aws_security_group" "worker" {
  name        = "${local.resource_prefix}-worker-sg"
  description = "Security group for worker ECS tasks"
  vpc_id      = module.vpc.vpc_id

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${local.resource_prefix}-worker-sg"
    Environment = var.environment
  }
}

# ============================================
# Database - RDS PostgreSQL
# ============================================
module "rds" {
  source = "../../modules/database/rds"

  project                 = var.project
  environment             = var.environment
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  allowed_security_groups = [module.ecs_backend.security_group_id, aws_security_group.worker.id]
  kms_key_arn             = module.kms.rds_kms_key_arn
  instance_class          = var.rds_instance_class
  allocated_storage       = var.rds_allocated_storage
  multi_az                = var.rds_multi_az
  backup_retention_period = var.rds_backup_retention
}

# ============================================
# Cache - ElastiCache Redis
# ============================================
module "elasticache" {
  source = "../../modules/cache/elasticache"

  project                 = var.project
  environment             = var.environment
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  allowed_security_groups = [module.ecs_backend.security_group_id]
  kms_key_arn             = module.kms.elasticache_kms_key_arn
  cloudwatch_kms_key_arn  = module.kms.cloudwatch_kms_key_arn
  node_type               = var.redis_node_type
  num_cache_nodes         = var.redis_num_nodes
}

# ============================================
# Storage - S3 Buckets
# ============================================
module "s3_frontend" {
  source = "../../modules/storage/s3-frontend"

  project     = var.project
  environment = var.environment
}

module "s3_certificates" {
  source = "../../modules/storage/s3-certificates"

  project         = var.project
  environment     = var.environment
  kms_key_id      = module.kms.s3_kms_key_id
  allowed_origins = ["https://${var.domain_name}"]
}

# ============================================
# Messaging - SNS Alerts
# ============================================
module "sns_alerts" {
  source = "../../modules/messaging/sns-alerts"

  project                   = var.project
  environment               = var.environment
  kms_key_id                = module.kms.sns_kms_key_id
  aws_account_id            = data.aws_caller_identity.current.account_id
  alarm_notification_emails = var.alarm_notification_emails
}

# ============================================
# Messaging - SQS Queues
# ============================================
module "sqs" {
  source = "../../modules/messaging/sqs"

  project       = var.project
  environment   = var.environment
  kms_key_id    = module.kms.sqs_kms_key_id
  sns_topic_arn = module.sns_alerts.topic_arn
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

  supabase_url                       = var.supabase_url
  supabase_anon_key                  = var.supabase_anon_key
  gotrue_jwt_secret                  = var.gotrue_jwt_secret
  mediahub_base_url                  = var.mediahub_base_url
  mediahub_api_key                   = var.mediahub_api_key
  youtube_api_key                    = var.youtube_api_key
  youtube_playlist_ids               = var.youtube_playlist_ids
  zoom_account_id                    = var.zoom_account_id
  zoom_client_id                     = var.zoom_client_id
  zoom_client_secret                 = var.zoom_client_secret
  zoom_webhook_secret                = var.zoom_webhook_secret
  zoom_sdk_key                       = var.zoom_sdk_key
  zoom_sdk_secret                    = var.zoom_sdk_secret
  jotform_api_key                    = var.jotform_api_key
  jotform_webinar_default_intake_url = var.jotform_webinar_default_intake_url
  bill_dev_key                       = var.bill_dev_key
  bill_username                      = var.bill_username
  bill_password                      = var.bill_password
  bill_org_id                        = var.bill_org_id
  bill_funding_account_id            = var.bill_funding_account_id
  bill_webhook_secret                = var.bill_webhook_secret
  admin_bootstrap_secret             = var.admin_bootstrap_secret
  hubspot_access_token               = var.hubspot_access_token
}

# ============================================
# Security - IAM Roles
# ============================================
module "iam" {
  source = "../../modules/security/iam"

  project     = var.project
  environment = var.environment
  secrets_arns = [
    module.secrets.database_secret_arn,
    module.secrets.redis_secret_arn,
    module.secrets.app_secrets_arn
  ]
  kms_key_arns = [
    module.kms.secrets_kms_key_arn,
    module.kms.sqs_kms_key_arn
  ]
  sqs_queue_arns = [
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

  project                   = var.project
  environment               = var.environment
  enable_container_insights = true
  log_retention_days        = (var.environment == "prod" || var.environment == "platform") ? 7 : 3
  cloudwatch_kms_key_arn    = module.kms.cloudwatch_kms_key_arn
}

# ============================================
# Compute - ECS Backend Service
# ============================================
module "ecs_backend" {
  source = "../../modules/compute/ecs-backend"

  project               = var.project
  environment           = var.environment
  aws_region            = "us-east-1"
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  cluster_id            = module.ecs_cluster.cluster_id
  cluster_name          = module.ecs_cluster.cluster_name
  execution_role_arn    = module.iam.ecs_task_execution_role_arn
  task_role_arn         = module.iam.ecs_task_role_arn
  alb_security_group_id = module.alb.alb_security_group_id
  target_group_arn      = module.alb.backend_target_group_arn
  alb_listener_arn      = module.alb.https_listener_arn
  log_group_name        = module.ecs_cluster.log_group_name
  container_image       = var.backend_image
  database_secret_arn   = module.secrets.database_secret_arn
  redis_secret_arn      = module.secrets.redis_secret_arn
  app_secrets_arn       = module.secrets.app_secrets_arn
  task_cpu              = var.backend_task_cpu
  task_memory           = var.backend_task_memory
  desired_count         = var.backend_desired_count
  min_capacity          = var.backend_min_capacity
  max_capacity          = var.backend_max_capacity
  frontend_url          = "https://${var.domain_name}"
  sqs_email_queue_url   = module.sqs.email_queue_url
  sqs_payment_queue_url = module.sqs.payment_queue_url
  sqs_cme_queue_url     = module.sqs.cme_queue_url
}

# ============================================
# Compute - ECS Worker Service
# ============================================
module "ecs_worker" {
  source = "../../modules/compute/ecs-worker"

  project               = var.project
  environment           = var.environment
  aws_region            = "us-east-1"
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  cluster_id            = module.ecs_cluster.cluster_id
  cluster_name          = module.ecs_cluster.cluster_name
  execution_role_arn    = module.iam.ecs_task_execution_role_arn
  task_role_arn         = module.iam.worker_task_role_arn
  log_group_name        = module.ecs_cluster.log_group_name
  container_image       = var.worker_image
  database_secret_arn   = module.secrets.database_secret_arn
  app_secrets_arn       = module.secrets.app_secrets_arn
  primary_queue_name    = "${local.resource_prefix}-email-queue"
  task_cpu              = var.worker_task_cpu
  task_memory           = var.worker_task_memory
  desired_count         = var.worker_desired_count
  min_capacity          = var.worker_min_capacity
  max_capacity          = var.worker_max_capacity
  security_group_ids    = [aws_security_group.worker.id]
  sqs_email_queue_url   = module.sqs.email_queue_url
  sqs_payment_queue_url = module.sqs.payment_queue_url
  sqs_cme_queue_url     = module.sqs.cme_queue_url
}

# ============================================
# Security - WAF for CloudFront (must be us-east-1)
# ============================================
module "waf_cloudfront" {
  source = "../../modules/security/waf-cloudfront"

  project              = var.project
  environment          = var.environment
  enable_managed_rules = true
  enable_rate_limit    = true
  rate_limit_count     = 2000
  allowed_countries    = [] # Empty = allow all; set e.g. ["US","CA"] to restrict
}

# ============================================
# Networking - CloudFront
# ============================================
module "cloudfront" {
  source = "../../modules/networking/cloudfront"

  project               = var.project
  environment           = var.environment
  s3_bucket_id          = module.s3_frontend.bucket_id
  s3_bucket_domain_name = module.s3_frontend.bucket_domain_name
  cloudfront_oai_path   = module.s3_frontend.cloudfront_oai_path
  certificate_arn       = var.cloudfront_certificate_arn
  domain_aliases        = [var.domain_name]
  api_origin_domain     = module.alb.alb_dns_name
  price_class           = "PriceClass_100"
  web_acl_id            = module.waf_cloudfront.web_acl_arn
}

# ============================================
# Networking - Route53 DNS
# ============================================
module "route53" {
  source = "../../modules/networking/route53"

  project        = var.project
  environment    = var.environment
  subdomain_zone = var.domain_name

  primary_alb_dns            = module.alb.alb_dns_name
  primary_alb_zone_id        = module.alb.alb_zone_id
  primary_cloudfront_dns     = module.cloudfront.distribution_domain_name
  primary_cloudfront_zone_id = module.cloudfront.distribution_hosted_zone_id

  alarm_actions = [module.sns_alerts.topic_arn]
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
  sns_topic_arn  = module.sns_alerts.topic_arn
}
