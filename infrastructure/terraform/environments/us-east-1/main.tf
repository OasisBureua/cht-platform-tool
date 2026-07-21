terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket       = "cht-platform-terraform-state" # Create with: aws s3 mb s3://cht-platform-terraform-state
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
    # State key: pass via -backend-config=../backends/us-east-1-{platform|dev}.hcl
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

provider "aws" {
  alias  = "replica"
  region = var.cognito_mrr_replica_region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      Region      = var.cognito_mrr_replica_region
      ManagedBy   = "Terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  resource_prefix          = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
  log_retention_days       = contains(["prod", "platform", "staging"], var.environment) ? 365 : 7
  manage_account_resources = var.environment == "platform"
  elasticache_enabled      = var.enable_elasticache != null ? var.enable_elasticache : var.environment == "dev"
  ecr_repository_names = var.environment == "dev" ? [
    "cht-dev-backend",
    "cht-dev-worker",
    ] : [
    "cht-platform-backend",
    "cht-platform-worker",
  ]
  ecr_replication_repository_names = ["cht-platform-backend", "cht-platform-worker"]
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
  log_retention_days     = local.log_retention_days
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
# Database - RDS PostgreSQL (legacy; removed after Aurora cutover)
# ============================================
module "rds" {
  count  = var.enable_aurora_global && var.decommission_rds ? 0 : 1
  source = "../../modules/database/rds"

  project                 = var.project
  environment             = var.environment
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  allowed_security_groups = [module.ecs_backend.security_group_id, aws_security_group.worker.id]
  kms_key_arn             = module.kms.rds_kms_key_arn
  instance_class          = var.rds_instance_class
  engine_version          = var.rds_engine_version
  allocated_storage       = var.rds_allocated_storage
  multi_az                = var.rds_multi_az
  backup_retention_period = var.rds_backup_retention
}

# ============================================
# Database - Aurora Global (primary cluster)
# ============================================
module "aurora_global" {
  count  = var.enable_aurora_global ? 1 : 0
  source = "../../modules/database/aurora-global"

  role                    = "primary"
  project                 = var.project
  environment             = var.environment
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  allowed_security_groups = [module.ecs_backend.security_group_id, aws_security_group.worker.id]
  kms_key_arn             = module.kms.rds_kms_key_arn
  instance_class          = var.aurora_instance_class
  engine_version          = var.aurora_engine_version
  backup_retention_period = var.rds_backup_retention
  deletion_protection     = contains(["prod", "platform"], var.environment)
}

locals {
  app_db_username = (
    var.enable_aurora_global && (var.aurora_use_for_app || var.decommission_rds)
    ? module.aurora_global[0].master_username
    : module.rds[0].db_username
  )
  app_db_password = (
    var.enable_aurora_global && (var.aurora_use_for_app || var.decommission_rds)
    ? module.aurora_global[0].master_password
    : module.rds[0].db_password
  )
  app_db_endpoint = (
    var.enable_aurora_global && (var.aurora_use_for_app || var.decommission_rds)
    ? module.aurora_global[0].cluster_endpoint
    : module.rds[0].db_endpoint
  )
  app_db_port = (
    var.enable_aurora_global && (var.aurora_use_for_app || var.decommission_rds)
    ? tostring(module.aurora_global[0].cluster_port)
    : module.rds[0].db_port
  )
  app_db_name = (
    var.enable_aurora_global && (var.aurora_use_for_app || var.decommission_rds)
    ? module.aurora_global[0].database_name
    : module.rds[0].db_name
  )
  app_db_connection_string = (
    var.enable_aurora_global && (var.aurora_use_for_app || var.decommission_rds)
    ? module.aurora_global[0].connection_string
    : module.rds[0].db_connection_string
  )
}

resource "aws_secretsmanager_secret" "aurora_migration" {
  count = var.enable_aurora_global ? 1 : 0

  name                    = "${local.resource_prefix}-aurora-database-credentials"
  description             = "Aurora Global writer credentials for DMS migration (not used by ECS until cutover)"
  kms_key_id              = module.kms.secrets_kms_key_id
  recovery_window_in_days = 30

  tags = {
    Name        = "${local.resource_prefix}-aurora-database-credentials"
    Environment = var.environment
    Purpose     = "AuroraMigration"
  }
}

resource "aws_secretsmanager_secret_version" "aurora_migration" {
  count = var.enable_aurora_global ? 1 : 0

  secret_id = aws_secretsmanager_secret.aurora_migration[0].id
  secret_string = jsonencode({
    username = module.aurora_global[0].master_username
    password = module.aurora_global[0].master_password
    host     = module.aurora_global[0].cluster_endpoint
    port     = module.aurora_global[0].cluster_port
    dbname   = module.aurora_global[0].database_name
    url      = module.aurora_global[0].connection_string
  })
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

module "s3_session_assets" {
  source = "../../modules/storage/s3-session-assets"

  project     = var.project
  environment = var.environment
  aws_region  = "us-east-1"
  cors_allowed_origins = distinct([
    "https://${var.domain_name}",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
  ])
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
  replica_regions = [
    for region in var.secrets_replica_regions : {
      region = region
    }
  ]

  db_username          = local.app_db_username
  db_password          = local.app_db_password
  db_endpoint          = local.app_db_endpoint
  db_port              = local.app_db_port
  db_name              = local.app_db_name
  db_connection_string = local.app_db_connection_string

  supabase_url                              = var.supabase_url
  supabase_anon_key                         = var.supabase_anon_key
  gotrue_jwt_secret                         = var.gotrue_jwt_secret
  mediahub_base_url                         = var.mediahub_base_url
  mediahub_api_key                          = var.mediahub_api_key
  contenthub_base_url                       = var.contenthub_base_url
  contenthub_api_key                        = var.contenthub_api_key
  youtube_api_key                           = var.youtube_api_key
  youtube_playlist_ids                      = var.youtube_playlist_ids
  zoom_account_id                           = var.zoom_account_id
  zoom_client_id                            = var.zoom_client_id
  zoom_client_secret                        = var.zoom_client_secret
  zoom_webhook_secret                       = var.zoom_webhook_secret
  zoom_sdk_key                              = var.zoom_sdk_key
  zoom_sdk_secret                           = var.zoom_sdk_secret
  jotform_api_key                           = var.jotform_api_key
  jotform_webinar_default_intake_url        = var.jotform_webinar_default_intake_url
  jotform_webinar_post_event_shared_form_id = var.jotform_webinar_post_event_shared_form_id
  bill_dev_key                              = var.bill_dev_key
  bill_username                             = var.bill_username
  bill_password                             = var.bill_password
  bill_org_id                               = var.bill_org_id
  bill_funding_account_id                   = var.bill_funding_account_id
  bill_webhook_secret                       = var.bill_webhook_secret
  bill_mfa_remember_me_id                   = var.bill_mfa_remember_me_id
  bill_mfa_device_name                      = var.bill_mfa_device_name
  admin_bootstrap_secret                    = var.admin_bootstrap_secret
  hubspot_access_token                      = var.hubspot_access_token
  recaptcha_secret_key                      = var.recaptcha_secret_key
  internal_cache_secret                     = var.internal_cache_secret
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
    module.secrets.app_secrets_arn
  ]
  kms_key_arns = compact([
    module.kms.secrets_kms_key_arn,
    module.kms.sqs_kms_key_arn,
    var.enable_cognito_pools && var.enable_cognito_mrr ? module.cognito[0].cognito_kms_key_arn : "",
  ])
  sqs_queue_arns = [
    module.sqs.email_queue_arn,
    module.sqs.payment_queue_arn,
    module.sqs.cme_queue_arn,
    module.sqs.scheduled_jobs_queue_arn
  ]
  certificates_bucket_arn   = module.s3_certificates.bucket_arn
  session_assets_bucket_arn = module.s3_session_assets.bucket_arn
  cognito_user_pool_arn     = var.enable_cognito_pools ? module.cognito[0].user_pool_arn : ""
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
  log_retention_days        = local.log_retention_days
  cloudwatch_kms_key_arn    = module.kms.cloudwatch_kms_key_arn
}

# ============================================
# Cache - ElastiCache Redis (dev by default)
# ============================================
module "elasticache" {
  count  = local.elasticache_enabled ? 1 : 0
  source = "../../modules/cache/elasticache"

  project            = var.project
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  node_type          = var.elasticache_node_type
}

# ============================================
# Compute - ECS Backend Service
# ============================================
module "ecs_backend" {
  source = "../../modules/compute/ecs-backend"

  project                        = var.project
  environment                    = var.environment
  aws_region                     = "us-east-1"
  vpc_id                         = module.vpc.vpc_id
  private_subnet_ids             = module.vpc.private_subnet_ids
  cluster_id                     = module.ecs_cluster.cluster_id
  cluster_name                   = module.ecs_cluster.cluster_name
  execution_role_arn             = module.iam.ecs_task_execution_role_arn
  task_role_arn                  = module.iam.ecs_task_role_arn
  alb_security_group_id          = module.alb.alb_security_group_id
  target_group_arn               = module.alb.backend_target_group_arn
  alb_listener_arn               = module.alb.https_listener_arn
  log_group_name                 = module.ecs_cluster.log_group_name
  container_image                = var.backend_image
  database_secret_arn            = module.secrets.database_secret_arn
  app_secrets_arn                = module.secrets.app_secrets_arn
  task_cpu                       = var.backend_task_cpu
  task_memory                    = var.backend_task_memory
  desired_count                  = var.backend_desired_count
  min_capacity                   = var.backend_min_capacity
  max_capacity                   = var.backend_max_capacity
  frontend_url                   = "https://${var.domain_name}"
  sqs_email_queue_url            = module.sqs.email_queue_url
  sqs_payment_queue_url          = module.sqs.payment_queue_url
  sqs_cme_queue_url              = module.sqs.cme_queue_url
  session_assets_s3_bucket       = module.s3_session_assets.bucket_id
  session_assets_public_url_base = module.s3_session_assets.public_url_base
  cognito_user_pool_id           = var.enable_cognito_pools ? module.cognito[0].user_pool_id : ""
  cognito_client_id              = var.enable_cognito_pools ? module.cognito[0].client_id : ""
  cognito_hosted_ui_base_url     = var.enable_cognito_pools ? module.cognito[0].hosted_ui_base_url : ""
  cognito_jwks_uri               = var.enable_cognito_pools ? module.cognito[0].jwks_uri : ""
  cognito_region                 = "us-east-1"
  recaptcha_min_score            = var.recaptcha_min_score
  redis_url                      = local.elasticache_enabled ? module.elasticache[0].redis_url : ""
  # Always apply Prisma migrations on backend boot (primary/writer).
  run_db_migrations = true
}

resource "aws_security_group_rule" "elasticache_from_backend" {
  count = local.elasticache_enabled ? 1 : 0

  type                     = "ingress"
  description              = "Redis from backend ECS tasks"
  from_port                = module.elasticache[0].port
  to_port                  = module.elasticache[0].port
  protocol                 = "tcp"
  security_group_id        = module.elasticache[0].security_group_id
  source_security_group_id = module.ecs_backend.security_group_id
}

# ============================================
# Compute - ECS Worker Service
# ============================================
module "ecs_worker" {
  source = "../../modules/compute/ecs-worker"

  project                      = var.project
  environment                  = var.environment
  aws_region                   = "us-east-1"
  vpc_id                       = module.vpc.vpc_id
  private_subnet_ids           = module.vpc.private_subnet_ids
  cluster_id                   = module.ecs_cluster.cluster_id
  cluster_name                 = module.ecs_cluster.cluster_name
  execution_role_arn           = module.iam.ecs_task_execution_role_arn
  task_role_arn                = module.iam.worker_task_role_arn
  log_group_name               = module.ecs_cluster.log_group_name
  container_image              = var.worker_image
  database_secret_arn          = module.secrets.database_secret_arn
  app_secrets_arn              = module.secrets.app_secrets_arn
  primary_queue_name           = "${local.resource_prefix}-email-queue"
  task_cpu                     = var.worker_task_cpu
  task_memory                  = var.worker_task_memory
  desired_count                = var.worker_desired_count
  min_capacity                 = var.worker_min_capacity
  max_capacity                 = var.worker_max_capacity
  security_group_ids           = [aws_security_group.worker.id]
  sqs_email_queue_url          = module.sqs.email_queue_url
  sqs_payment_queue_url        = module.sqs.payment_queue_url
  sqs_cme_queue_url            = module.sqs.cme_queue_url
  sqs_scheduled_jobs_queue_url = module.sqs.scheduled_jobs_queue_url
  ses_from_email               = var.worker_ses_from_email
  frontend_app_url             = "https://${var.domain_name}"
}

# ============================================
# Messaging - EventBridge scheduled jobs
# ============================================
module "scheduled_eventbridge" {
  source = "../../modules/messaging/eventbridge-scheduled-jobs"

  project                    = var.project
  environment                = var.environment
  scheduled_jobs_queue_arn   = module.sqs.scheduled_jobs_queue_arn
  scheduled_jobs_queue_url   = module.sqs.scheduled_jobs_queue_url
  session_reminders_schedule = var.session_reminders_schedule_expression

  enable_bill_mfa_reminder   = var.enable_bill_mfa_reminder
  alerts_topic_arn           = module.sns_alerts.topic_arn
  bill_mfa_reminder_schedule = var.bill_mfa_reminder_schedule
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

  project                     = var.project
  environment                 = var.environment
  s3_bucket_id                = module.s3_frontend.bucket_id
  s3_bucket_domain_name       = module.s3_frontend.bucket_domain_name
  cloudfront_oai_path         = module.s3_frontend.cloudfront_oai_path
  certificate_arn             = var.cloudfront_certificate_arn
  domain_aliases              = [var.domain_name]
  api_origin_domain           = module.alb.alb_dns_name
  secondary_api_origin_domain = var.secondary_api_origin_domain
  route_api_to_secondary      = var.route_api_to_secondary
  price_class                 = "PriceClass_100"
  web_acl_id                  = module.waf_cloudfront.web_acl_arn
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
  db_instance_id = var.enable_aurora_global && var.decommission_rds ? module.aurora_global[0].cluster_id : split(":", module.rds[0].db_endpoint)[0]
  alb_arn_suffix = split("/", module.alb.alb_arn)[3]
  log_group_name = module.ecs_cluster.log_group_name
  sns_topic_arn  = module.sns_alerts.topic_arn
}

# ============================================
# Monitoring - CloudTrail (audit logging)
# ============================================
module "cloudtrail" {
  source = "../../modules/monitoring/cloudtrail"

  project                = var.project
  environment            = var.environment
  aws_account_id         = data.aws_caller_identity.current.account_id
  s3_kms_key_arn         = module.kms.s3_kms_key_arn
  cloudwatch_kms_key_arn = module.kms.cloudwatch_kms_key_arn
  log_retention_days     = local.log_retention_days
}

# ============================================
# Security - Cognito User Pool
# ============================================
module "cognito" {
  count  = var.enable_cognito_pools ? 1 : 0
  source = "../../modules/security/cognito"

  providers = {
    aws.replica = aws.replica
  }

  project       = var.project
  environment   = var.environment
  domain_prefix = var.cognito_domain_prefix

  callback_urls = ["https://${var.domain_name}/auth/callback"]
  logout_urls   = ["https://${var.domain_name}"]

  mfa_configuration    = var.cognito_mfa_configuration
  user_pool_tier       = var.cognito_user_pool_tier
  google_client_id     = var.cognito_google_client_id
  google_client_secret = var.cognito_google_client_secret

  email_sending_account  = var.cognito_email_sending_account
  email_from_address     = var.cognito_email_from
  email_reply_to_address = var.cognito_email_reply_to

  enable_waf                      = var.enable_cognito_waf
  waf_enable_managed_rules        = var.cognito_waf_enable_managed_rules
  waf_enable_rate_limit           = var.cognito_waf_enable_rate_limit
  waf_rate_limit_count            = var.cognito_waf_rate_limit_count
  enable_multi_region_replication = var.enable_cognito_mrr
  replica_region                  = var.cognito_mrr_replica_region
  associate_waf_with_replica      = var.cognito_mrr_associate_waf_replica
}

# ============================================
# Compute - ECR lifecycle (existing repos; dev vs platform policies)
# ============================================
module "ecr_lifecycle" {
  count  = contains(["platform", "dev"], var.environment) ? 1 : 0
  source = "../../modules/compute/ecr-lifecycle"

  repository_names = local.ecr_repository_names
}

# ============================================
# Compute - ECR cross-region replication (account-level)
# Replicates cht-platform-* images from us-east-1 → us-east-2 (platform only).
# ============================================
module "ecr_replication" {
  count  = var.enable_ecr_replication ? 1 : 0
  source = "../../modules/compute/ecr-replication"

  destination_region = var.ecr_replication_destination_region
  repository_prefix  = var.ecr_repository_prefix
  repository_names   = local.ecr_replication_repository_names
}

# ============================================
# Monitoring - GuardDuty (us-east-1 — platform environment only)
# ============================================
module "guardduty" {
  source = "../../modules/monitoring/guardduty"

  project         = var.project
  environment     = var.environment
  enable_detector = local.manage_account_resources
  sns_topic_arn   = module.sns_alerts.topic_arn
}

# ============================================
# Monitoring - AWS Config (account-level — platform environment only)
# ============================================
module "aws_config" {
  source = "../../modules/monitoring/aws-config"

  project        = var.project
  environment    = var.environment
  aws_account_id = data.aws_caller_identity.current.account_id
  s3_kms_key_arn = module.kms.s3_kms_key_arn
}
