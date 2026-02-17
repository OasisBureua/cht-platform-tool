# CHT Platform - us-east-1 (Primary Region)

project     = "cht-platform"
environment = "dev"

# Docker Images (update after building/pushing)
backend_image = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-backend:v1.0.0"
worker_image  = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-worker:v1.0.0"

# Database
rds_instance_class      = "db.t3.micro"
rds_allocated_storage   = 20
rds_multi_az            = false
rds_backup_retention    = 7

# Cache
redis_node_type         = "cache.t3.micro"
redis_num_nodes         = 1

# Compute
backend_task_cpu        = 256
backend_task_memory     = 512
backend_desired_count   = 2
backend_min_capacity    = 1
backend_max_capacity    = 4

worker_task_cpu         = 256
worker_task_memory      = 512
worker_desired_count    = 1
worker_min_capacity     = 1
worker_max_capacity     = 10

# SSL Certificates (testapp - issued)
acm_certificate_arn        = "arn:aws:acm:us-east-1:233636046512:certificate/3d4f17ef-46f3-45a2-84a0-c61fb94769bb"
cloudfront_certificate_arn = "arn:aws:acm:us-east-1:233636046512:certificate/3d4f17ef-46f3-45a2-84a0-c61fb94769bb"

# Domain (testapp.communityhealth.media)
domain_name = "testapp.communityhealth.media"

# Optional: Application secrets (or set via environment variables)
# stripe_secret_key      = "sk_test_51SgE8U4AsB5fThaf2V3I0Li9sQjSi2AVxSMlQFaX9liGKBIjdfh8cITr0Fwk3AHELnnPZhcyZX2u03rsrQpXSZyI00JqUqlMAd"
# stripe_publishable_key = "pk_test_51SgE8U4AsB5fThafcGimMu6kadDjrman1ptUTRs69I2m5HDgWM4hJegOuos8oJ47kwVmDYu3hP2uOUSrbUKjh5kn00TPu3XgL9"
# stripe_webhook_secret  = "whsec_nmSP4aOvIHnW8ZFz7xApvEYE51vCGiLS"
# HubSpot (await credentials - create token at Settings > Integrations > Email in HubSpot)
# hubspot_smtp_user       = ""
# hubspot_smtp_password  = ""
# auth0_domain           = "dev-z6ql5fywvjgz4snj.us.auth0.com"
# auth0_client_id        = "aHwexIuzxluejiNGQ5ej0EHpSjwetl53"
# auth0_audience         = "https://api-dev.communityhealth.media"

# Optional: SNS for alerts
# sns_topic_arn = ""

# Cost: ~$145/month