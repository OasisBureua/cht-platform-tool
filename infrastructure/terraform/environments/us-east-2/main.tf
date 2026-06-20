terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket       = "cht-platform-terraform-state"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
    # State key: pass via -backend-config=../backends/us-east-2-{platform|dev}.hcl
  }
}

provider "aws" {
  region = "us-east-2"

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      Region      = "us-east-2"
      Purpose     = "DisasterRecovery"
      ManagedBy   = "Terraform"
    }
  }
}

provider "aws" {
  alias  = "use1"
  region = "us-east-1"
}

data "aws_caller_identity" "current" {}

locals {
  dr_project          = "${var.project}-dr-use2"
  dr_resource_prefix  = var.environment == "platform" ? local.dr_project : "${local.dr_project}-${var.environment}"
  primary_prefix      = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
  primary_state_key   = var.environment == "platform" ? "us-east-1/terraform.tfstate" : "us-east-1-${var.environment}/terraform.tfstate"
  log_retention_days  = contains(["prod", "platform", "staging"], var.environment) ? 365 : 7
  standby_scale       = var.dr_standby_scale_factor
  backend_desired_dr  = max(1, ceil(var.backend_desired_count * local.standby_scale))
  backend_min_dr      = max(1, floor(var.backend_min_capacity * local.standby_scale))
  backend_max_dr      = max(1, ceil(var.backend_max_capacity * local.standby_scale))
  worker_desired_dr   = max(1, ceil(var.worker_desired_count * local.standby_scale))
  worker_min_dr       = max(1, floor(var.worker_min_capacity * local.standby_scale))
  worker_max_dr       = max(1, ceil(var.worker_max_capacity * local.standby_scale))
  primary_db_id       = var.primary_db_instance_identifier != "" ? var.primary_db_instance_identifier : "${local.primary_prefix}-db"
}

data "aws_db_instance" "primary" {
  provider               = aws.use1
  db_instance_identifier = local.primary_db_id
}

data "aws_secretsmanager_secret" "primary_database" {
  provider = aws.use1
  name     = "${local.primary_prefix}-database-credentials"
}

data "aws_secretsmanager_secret_version" "primary_database" {
  provider  = aws.use1
  secret_id = data.aws_secretsmanager_secret.primary_database.id
}

data "aws_secretsmanager_secret" "primary_app" {
  provider = aws.use1
  name     = "${local.primary_prefix}-app-secrets"
}

data "aws_secretsmanager_secret_version" "primary_app" {
  provider  = aws.use1
  secret_id = data.aws_secretsmanager_secret.primary_app.id
}

data "terraform_remote_state" "primary" {
  backend = "s3"

  config = {
    bucket = "cht-platform-terraform-state"
    key    = local.primary_state_key
    region = "us-east-1"
  }
}

locals {
  primary_db_secret = jsondecode(data.aws_secretsmanager_secret_version.primary_database.secret_string)

  primary_cognito_user_pool_id       = try(tostring(data.terraform_remote_state.primary.outputs.cognito_user_pool_id), "")
  primary_cognito_client_id          = try(tostring(data.terraform_remote_state.primary.outputs.cognito_client_id), "")
  primary_cognito_hosted_ui_base_url = try(tostring(data.terraform_remote_state.primary.outputs.cognito_hosted_ui_base_url), "")
  primary_cognito_jwks_uri           = try(tostring(data.terraform_remote_state.primary.outputs.cognito_jwks_uri), "")
  primary_cognito_kms_key_arn        = try(tostring(data.terraform_remote_state.primary.outputs.cognito_kms_key_arn), "")

  cognito_user_pool_id = var.cognito_user_pool_id != "" ? var.cognito_user_pool_id : local.primary_cognito_user_pool_id
  cognito_client_id    = var.cognito_client_id != "" ? var.cognito_client_id : local.primary_cognito_client_id
  cognito_hosted_ui_base_url = var.cognito_hosted_ui_base_url != "" ? var.cognito_hosted_ui_base_url : local.primary_cognito_hosted_ui_base_url
  cognito_jwks_uri           = var.cognito_jwks_uri != "" ? var.cognito_jwks_uri : local.primary_cognito_jwks_uri
  cognito_user_pool_arn = local.cognito_user_pool_id != "" ? "arn:aws:cognito-idp:us-east-1:${data.aws_caller_identity.current.account_id}:userpool/${local.cognito_user_pool_id}" : ""

  primary_aurora_global_cluster_id = try(tostring(data.terraform_remote_state.primary.outputs.aurora_global_cluster_id), "")
  primary_aurora_engine_version    = try(tostring(data.terraform_remote_state.primary.outputs.aurora_engine_version), var.aurora_engine_version)
  aurora_global_enabled            = var.enable_aurora_global && local.primary_aurora_global_cluster_id != ""
}

# ============================================
# Security - KMS
# ============================================
module "kms" {
  source = "../../modules/security/kms"

  project        = local.dr_project
  environment    = var.environment
  aws_region     = "us-east-2"
  aws_account_id = data.aws_caller_identity.current.account_id
}

# ============================================
# Networking - VPC
# ============================================
module "vpc" {
  source = "../../modules/networking/vpc"

  project                = local.dr_project
  environment            = var.environment
  vpc_cidr               = "10.20.0.0/16"
  availability_zones     = ["us-east-2a", "us-east-2b"]
  enable_nat_gateway     = true
  enable_flow_logs       = true
  cloudwatch_kms_key_arn = module.kms.cloudwatch_kms_key_arn
  log_retention_days     = local.log_retention_days
}

# ============================================
# Storage - S3 Buckets (regional standby)
# ============================================
module "s3_frontend" {
  source = "../../modules/storage/s3-frontend"

  project     = local.dr_project
  environment = var.environment
}

module "s3_certificates" {
  source = "../../modules/storage/s3-certificates"

  project         = local.dr_project
  environment     = var.environment
  kms_key_id      = module.kms.s3_kms_key_id
  allowed_origins = ["https://${var.domain_name}"]
}

module "s3_session_assets" {
  source = "../../modules/storage/s3-session-assets"

  project     = local.dr_project
  environment = var.environment
  aws_region  = "us-east-2"
  cors_allowed_origins = distinct([
    "https://${var.domain_name}",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
  ])
}

# ============================================
# Messaging - SNS + SQS
# ============================================
module "sns_alerts" {
  source = "../../modules/messaging/sns-alerts"

  project                   = local.dr_project
  environment               = var.environment
  kms_key_id                = module.kms.sns_kms_key_id
  aws_account_id            = data.aws_caller_identity.current.account_id
  alarm_notification_emails = var.alarm_notification_emails
}

module "sqs" {
  source = "../../modules/messaging/sqs"

  project       = local.dr_project
  environment   = var.environment
  kms_key_id    = module.kms.sqs_kms_key_id
  sns_topic_arn = module.sns_alerts.topic_arn
}

# ============================================
# Security - Secrets Manager (replicated from us-east-1)
# ============================================
resource "aws_secretsmanager_secret" "database" {
  name                    = "${local.dr_resource_prefix}-database-credentials"
  description             = "DR copy of database credentials for ${var.project} ${var.environment}"
  kms_key_id              = module.kms.secrets_kms_key_id
  recovery_window_in_days = 30
}

resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "${local.dr_resource_prefix}-app-secrets"
  description             = "DR copy of app secrets for ${var.project} ${var.environment}"
  kms_key_id              = module.kms.secrets_kms_key_id
  recovery_window_in_days = 30
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id     = aws_secretsmanager_secret.app_secrets.id
  secret_string = data.aws_secretsmanager_secret_version.primary_app.secret_string
}

# ============================================
# Security - IAM Roles
# ============================================
module "iam" {
  source = "../../modules/security/iam"

  project     = local.dr_project
  environment = var.environment
  secrets_arns = [
    aws_secretsmanager_secret.database.arn,
    aws_secretsmanager_secret.app_secrets.arn
  ]
  kms_key_arns = compact([
    module.kms.secrets_kms_key_arn,
    module.kms.sqs_kms_key_arn,
    local.primary_cognito_kms_key_arn,
  ])
  cognito_user_pool_arn = local.cognito_user_pool_arn
  sqs_queue_arns = [
    module.sqs.email_queue_arn,
    module.sqs.payment_queue_arn,
    module.sqs.cme_queue_arn,
    module.sqs.scheduled_jobs_queue_arn
  ]
  certificates_bucket_arn   = module.s3_certificates.bucket_arn
  session_assets_bucket_arn = module.s3_session_assets.bucket_arn
}

# ============================================
# Networking - ALB
# ============================================
module "alb" {
  source = "../../modules/networking/alb"

  project            = local.dr_project
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  certificate_arn    = var.dr_acm_certificate_arn != "" ? var.dr_acm_certificate_arn : var.acm_certificate_arn
  enable_access_logs = false
}

# ============================================
# Compute - ECS
# ============================================
module "ecs_cluster" {
  source = "../../modules/compute/ecs-cluster"

  project                   = local.dr_project
  environment               = var.environment
  enable_container_insights = true
  log_retention_days        = local.log_retention_days
  cloudwatch_kms_key_arn    = module.kms.cloudwatch_kms_key_arn
}

module "ecs_backend" {
  source = "../../modules/compute/ecs-backend"

  project               = local.dr_project
  environment           = var.environment
  aws_region            = "us-east-2"
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
  database_secret_arn   = aws_secretsmanager_secret.database.arn
  app_secrets_arn       = aws_secretsmanager_secret.app_secrets.arn
  task_cpu              = var.backend_task_cpu
  task_memory           = var.backend_task_memory
  desired_count         = local.backend_desired_dr
  min_capacity          = local.backend_min_dr
  max_capacity          = local.backend_max_dr
  frontend_url          = "https://${var.domain_name}"
  sqs_email_queue_url   = module.sqs.email_queue_url
  sqs_payment_queue_url = module.sqs.payment_queue_url
  sqs_cme_queue_url     = module.sqs.cme_queue_url
  session_assets_s3_bucket       = module.s3_session_assets.bucket_id
  session_assets_public_url_base = module.s3_session_assets.public_url_base
  run_db_migrations              = false
  cognito_user_pool_id         = local.cognito_user_pool_id
  cognito_client_id            = local.cognito_client_id
  cognito_hosted_ui_base_url   = local.cognito_hosted_ui_base_url
  cognito_jwks_uri             = local.cognito_jwks_uri
  cognito_region               = "us-east-1"
}

module "ecs_worker" {
  source = "../../modules/compute/ecs-worker"

  project               = local.dr_project
  environment           = var.environment
  aws_region            = "us-east-2"
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  cluster_id            = module.ecs_cluster.cluster_id
  cluster_name          = module.ecs_cluster.cluster_name
  execution_role_arn    = module.iam.ecs_task_execution_role_arn
  task_role_arn         = module.iam.worker_task_role_arn
  log_group_name        = module.ecs_cluster.log_group_name
  container_image       = var.worker_image
  database_secret_arn   = aws_secretsmanager_secret.database.arn
  app_secrets_arn       = aws_secretsmanager_secret.app_secrets.arn
  primary_queue_name    = "${local.dr_resource_prefix}-email-queue"
  task_cpu              = var.worker_task_cpu
  task_memory           = var.worker_task_memory
  desired_count         = local.worker_desired_dr
  min_capacity          = local.worker_min_dr
  max_capacity          = local.worker_max_dr
  sqs_email_queue_url          = module.sqs.email_queue_url
  sqs_payment_queue_url        = module.sqs.payment_queue_url
  sqs_cme_queue_url            = module.sqs.cme_queue_url
  sqs_scheduled_jobs_queue_url = module.sqs.scheduled_jobs_queue_url
  ses_from_email               = var.worker_ses_from_email
  frontend_app_url             = "https://${var.domain_name}"
}

module "scheduled_eventbridge" {
  source = "../../modules/messaging/eventbridge-scheduled-jobs"

  project                    = local.dr_project
  environment                = var.environment
  scheduled_jobs_queue_arn   = module.sqs.scheduled_jobs_queue_arn
  scheduled_jobs_queue_url   = module.sqs.scheduled_jobs_queue_url
  session_reminders_schedule = var.session_reminders_schedule_expression
}

# ============================================
# Database - Aurora Global (secondary cluster)
# ============================================
module "aurora_global" {
  count  = local.aurora_global_enabled ? 1 : 0
  source = "../../modules/database/aurora-global"

  role                      = "secondary"
  project                   = var.project
  environment               = var.environment
  vpc_id                    = module.vpc.vpc_id
  private_subnet_ids        = module.vpc.private_subnet_ids
  allowed_security_groups   = [module.ecs_backend.security_group_id, module.ecs_worker.security_group_id]
  kms_key_arn               = module.kms.rds_kms_key_arn
  instance_class            = var.aurora_instance_class
  engine_version            = local.primary_aurora_engine_version
  global_cluster_identifier = local.primary_aurora_global_cluster_id
  backup_retention_period   = var.rds_backup_retention
  deletion_protection       = contains(["prod", "platform"], var.environment)
}

# ============================================
# Database - Cross-region read replica (legacy; removed after Aurora cutover)
# ============================================
resource "aws_db_subnet_group" "replica" {
  count      = var.enable_db_replica && !(var.enable_aurora_global && var.decommission_rds) ? 1 : 0
  name       = "${local.dr_resource_prefix}-db-subnet"
  subnet_ids = module.vpc.private_subnet_ids
}

resource "aws_security_group" "rds_replica" {
  count       = var.enable_db_replica && !(var.enable_aurora_global && var.decommission_rds) ? 1 : 0
  name        = "${local.dr_resource_prefix}-rds-sg"
  description = "Security group for DR RDS replica"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "PostgreSQL from DR ECS tasks"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    security_groups = [
      module.ecs_backend.security_group_id,
      module.ecs_worker.security_group_id
    ]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "replica" {
  count = var.enable_db_replica && !(var.enable_aurora_global && var.decommission_rds) ? 1 : 0

  identifier             = "${local.dr_resource_prefix}-db-replica"
  replicate_source_db    = data.aws_db_instance.primary.db_instance_arn
  instance_class         = var.dr_rds_instance_class
  kms_key_id             = module.kms.rds_kms_key_arn
  storage_encrypted      = true # inherited from primary; must match AWS or Terraform replaces the replica
  publicly_accessible    = false
  multi_az               = false
  auto_minor_version_upgrade = true

  db_subnet_group_name   = aws_db_subnet_group.replica[0].name
  vpc_security_group_ids = [aws_security_group.rds_replica[0].id]

  backup_retention_period = var.rds_backup_retention
  skip_final_snapshot     = true
  deletion_protection     = contains(["prod", "platform"], var.environment)
}

locals {
  dr_database_host = local.aurora_global_enabled && var.aurora_use_for_app ? module.aurora_global[0].reader_host : (
    length(aws_db_instance.replica) > 0 ? aws_db_instance.replica[0].address : local.primary_db_secret.host
  )
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({
    username = local.primary_db_secret.username
    password = local.primary_db_secret.password
    host     = local.dr_database_host
    port     = local.primary_db_secret.port
    dbname   = local.primary_db_secret.dbname
    url      = format("postgresql://%s:%s@%s:%s/%s", local.primary_db_secret.username, urlencode(local.primary_db_secret.password), local.dr_database_host, local.primary_db_secret.port, local.primary_db_secret.dbname)
  })
}

# ============================================
# Monitoring - CloudWatch
# ============================================
module "cloudwatch" {
  count  = var.enable_db_replica || local.aurora_global_enabled ? 1 : 0
  source = "../../modules/monitoring/cloudwatch"

  project        = local.dr_project
  environment    = var.environment
  aws_region     = "us-east-2"
  cluster_name   = module.ecs_cluster.cluster_name
  db_instance_id = length(aws_db_instance.replica) > 0 ? aws_db_instance.replica[0].id : module.aurora_global[0].cluster_id
  alb_arn_suffix = split("/", module.alb.alb_arn)[3]
  log_group_name = module.ecs_cluster.log_group_name
  sns_topic_arn  = module.sns_alerts.topic_arn
}

# ============================================
# Monitoring - GuardDuty (us-east-2 — DR region compliance)
# ============================================
module "guardduty" {
  source = "../../modules/monitoring/guardduty"

  project         = local.dr_project
  environment     = var.environment
  enable_detector = true
  sns_topic_arn   = module.sns_alerts.topic_arn
}
