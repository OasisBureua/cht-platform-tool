# CHT Platform — platform.github.tfvars
# Non-secret infra for GitHub Actions deploy-prod.yml (committed).
# Secrets: GitHub Environment "platform" → TF_VAR_* (see .github/CI_CD.md).
# Local prod: copy platform.tfvars.example → platform.tfvars and add secrets.

project     = "cht-platform"
environment = "platform"

domain_name = "testapp.communityhealth.media"

# Images overridden per deploy by workflow (-var backend_image / worker_image)
backend_image = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-backend:v3.0.0"
worker_image  = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-worker:v3.0.0"

rds_instance_class    = "db.t3.small"
rds_engine_version    = "15.17"
rds_allocated_storage = 20
rds_multi_az          = true
rds_backup_retention  = 7

enable_aurora_global  = true
aurora_instance_class = "db.r6g.large"
aurora_engine_version = "15.17"
aurora_use_for_app    = true
decommission_rds      = true

backend_task_cpu      = 512
backend_task_memory   = 1024
backend_desired_count = 2
backend_min_capacity  = 2
backend_max_capacity  = 2

worker_task_cpu      = 512
worker_task_memory   = 1024
worker_desired_count = 2
worker_min_capacity  = 2
worker_max_capacity  = 2

acm_certificate_arn        = "arn:aws:acm:us-east-1:233636046512:certificate/3d4f17ef-46f3-45a2-84a0-c61fb94769bb"
cloudfront_certificate_arn = "arn:aws:acm:us-east-1:233636046512:certificate/3d4f17ef-46f3-45a2-84a0-c61fb94769bb"
dr_acm_certificate_arn     = "arn:aws:acm:us-east-2:233636046512:certificate/e99c8853-8cac-4733-80dc-f1515335b804"

secrets_replica_regions     = ["us-east-2"]
enable_ecr_replication        = true
secondary_api_origin_domain   = "cht-platform-dr-use2-alb-455710402.us-east-2.elb.amazonaws.com"
dr_rds_instance_class         = "db.t3.small"
