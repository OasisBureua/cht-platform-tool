# AWS Configuration
aws_region         = "us-east-1"
availability_zones = ["us-east-1a", "us-east-1b"]

# Docker Images (update with your ECR repository URLs)
backend_image = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-backend:v1.0.0"
worker_image  = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-worker:v1.0.0"

# SSL Certificates (add after requesting tomorrow)
# acm_certificate_arn        = "arn:aws:acm:us-east-1:233636046512:certificate/..."
# cloudfront_certificate_arn = "arn:aws:acm:us-east-1:233636046512:certificate/..."

# Domain Configuration
# domain_aliases = ["app.communityhealth.media"]

# Optional: SNS for Alarms
# sns_topic_arn = "arn:aws:sns:us-east-1:123456789012:cht-platform-alerts"

# Application Secrets (or set via environment variables: TF_VAR_stripe_secret_key)
stripe_secret_key      = "sk_test_51SgE8U4AsB5fThaf2V3I0Li9sQjSi2AVxSMlQFaX9liGKBIjdfh8cITr0Fwk3AHELnnPZhcyZX2u03rsrQpXSZyI00JqUqlMAd"
stripe_publishable_key = "pk_test_51SgE8U4AsB5fThafcGimMu6kadDjrman1ptUTRs69I2m5HDgWM4hJegOuos8oJ47kwVmDYu3hP2uOUSrbUKjh5kn00TPu3XgL9"
# stripe_webhook_secret = ""
# sendgrid_api_key       = ""
# auth0_domain           = ""
# auth0_client_id        = ""
# auth0_audience         = ""
