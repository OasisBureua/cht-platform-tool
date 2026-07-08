# CHT Platform — dev.github.tfvars
# Non-secret infra for GitHub Actions deploy-dev.yml (committed).
# Secrets: GitHub Environment "development" → TF_VAR_* (see .github/CI_CD.md).
# Local dev: copy dev.tfvars.example → dev.tfvars and add secrets inline or via TF_VAR_*.

project     = "cht-platform"
environment = "dev"

# Domain and certificates (devapp)
domain_name             = "devapp.communityhealth.media"
acm_certificate_arn     = "arn:aws:acm:us-east-1:233636046512:certificate/6a358a7c-fe5d-4bbe-8d09-b0fce55c61b7"
cloudfront_certificate_arn = "arn:aws:acm:us-east-1:233636046512:certificate/6a358a7c-fe5d-4bbe-8d09-b0fce55c61b7"

# Images are overridden per deploy by workflow (-var backend_image / worker_image)
backend_image = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-backend:3.0.0"
worker_image  = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-worker:3.0.0"

# Database (small dev)
rds_instance_class    = "db.t3.micro"
rds_engine_version    = "15.17"
rds_allocated_storage = 20
rds_multi_az          = false
rds_backup_retention  = 1

# Compute (dev autoscaling floor)
backend_task_cpu      = 256
backend_task_memory   = 512
backend_desired_count = 1
backend_min_capacity  = 1
backend_max_capacity  = 2

worker_task_cpu      = 256
worker_task_memory   = 512
worker_desired_count = 1
worker_min_capacity  = 1
worker_max_capacity  = 2

# DR / replication (dev usually single-region)
secrets_replica_regions   = []
enable_ecr_replication    = false
secondary_api_origin_domain = ""
route_api_to_secondary    = false

