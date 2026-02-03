# Database credentials
resource "aws_secretsmanager_secret" "database" {
  name        = "${var.project}-${var.environment}-database-credentials"
  description = "Database credentials for ${var.project} ${var.environment}"
  kms_key_id  = var.kms_key_id

  tags = {
    Name        = "${var.project}-${var.environment}-database-credentials"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({
    username = var.db_username
    password = var.db_password
    host     = var.db_endpoint
    port     = var.db_port
    dbname   = var.db_name
    url      = var.db_connection_string
  })
}

# Redis connection
resource "aws_secretsmanager_secret" "redis" {
  name        = "${var.project}-${var.environment}-redis-connection"
  description = "Redis connection details for ${var.project} ${var.environment}"
  kms_key_id  = var.kms_key_id

  tags = {
    Name        = "${var.project}-${var.environment}-redis-connection"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "redis" {
  secret_id     = aws_secretsmanager_secret.redis.id
  secret_string = jsonencode({
    host        = var.redis_endpoint
    port        = var.redis_port
  })
}

# Application secrets (API keys, etc.)
resource "aws_secretsmanager_secret" "app_secrets" {
  name        = "${var.project}-${var.environment}-app-secrets"
  description = "Application secrets for ${var.project} ${var.environment}"
  kms_key_id  = var.kms_key_id

  tags = {
    Name        = "${var.project}-${var.environment}-app-secrets"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    stripe_secret_key       = var.stripe_secret_key
    stripe_publishable_key  = var.stripe_publishable_key
    stripe_webhook_secret   = var.stripe_webhook_secret
    sendgrid_api_key        = var.sendgrid_api_key
    auth0_domain            = var.auth0_domain
    auth0_client_id         = var.auth0_client_id
    auth0_audience          = var.auth0_audience
  })
}