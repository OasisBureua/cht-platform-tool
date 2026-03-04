locals {
  is_prod = var.environment == "prod" || var.environment == "platform"
  prefix  = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
}

# Security Group for Backend
resource "aws_security_group" "backend" {
  name        = "${local.prefix}-backend-sg"
  description = "Security group for backend ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    description     = "HTTP from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [var.alb_security_group_id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${local.prefix}-backend-sg"
    Environment = var.environment
  }
}

# ECS Task Definition
resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.prefix}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = var.container_image
      essential = true

      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = concat(
        [
          {
            name  = "NODE_ENV"
            value = var.environment == "prod" || var.environment == "platform" ? "production" : var.environment
          },
          {
            name  = "PORT"
            value = "3000"
          },
          {
            name  = "AWS_REGION"
            value = var.aws_region
          },
          {
            name  = "SESSION_TTL_SECONDS"
            value = "1800"
          },
          # Elasticache TLS cert verification often fails; bypass to fix "connection is closed"
          {
            name  = "REDIS_TLS_REJECT_UNAUTHORIZED"
            value = "false"
          }
        ],
        concat(
          var.frontend_url != "" ? [{ name = "FRONTEND_URL", value = var.frontend_url }] : [],
          var.sqs_email_queue_url != "" ? [{ name = "SQS_EMAIL_QUEUE_URL", value = var.sqs_email_queue_url }] : [],
          var.sqs_payment_queue_url != "" ? [{ name = "SQS_PAYMENT_QUEUE_URL", value = var.sqs_payment_queue_url }] : [],
          var.sqs_cme_queue_url != "" ? [{ name = "SQS_CME_QUEUE_URL", value = var.sqs_cme_queue_url }] : []
        )
      )

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${var.database_secret_arn}:url::"
        },
        {
          name      = "REDIS_HOST"
          valueFrom = "${var.redis_secret_arn}:host::"
        },
        {
          name      = "REDIS_PORT"
          valueFrom = "${var.redis_secret_arn}:port::"
        },
        {
          name      = "SUPABASE_URL"
          valueFrom = "${var.app_secrets_arn}:supabase_url::"
        },
        {
          name      = "SUPABASE_ANON_KEY"
          valueFrom = "${var.app_secrets_arn}:supabase_anon_key::"
        },
        {
          name      = "GOTRUE_JWT_SECRET"
          valueFrom = "${var.app_secrets_arn}:gotrue_jwt_secret::"
        },
        {
          name      = "MEDIAHUB_BASE_URL"
          valueFrom = "${var.app_secrets_arn}:mediahub_base_url::"
        },
        {
          name      = "MEDIAHUB_API_KEY"
          valueFrom = "${var.app_secrets_arn}:mediahub_api_key::"
        },
        {
          name      = "YOUTUBE_API_KEY"
          valueFrom = "${var.app_secrets_arn}:youtube_api_key::"
        },
        {
          name      = "YOUTUBE_PLAYLIST_IDS"
          valueFrom = "${var.app_secrets_arn}:youtube_playlist_ids::"
        },
        {
          name      = "ZOOM_ACCOUNT_ID"
          valueFrom = "${var.app_secrets_arn}:zoom_account_id::"
        },
        {
          name      = "ZOOM_CLIENT_ID"
          valueFrom = "${var.app_secrets_arn}:zoom_client_id::"
        },
        {
          name      = "ZOOM_CLIENT_SECRET"
          valueFrom = "${var.app_secrets_arn}:zoom_client_secret::"
        },
        {
          name      = "JOTFORM_API_KEY"
          valueFrom = "${var.app_secrets_arn}:jotform_api_key::"
        },
        {
          name      = "BILL_DEV_KEY"
          valueFrom = "${var.app_secrets_arn}:bill_dev_key::"
        },
        {
          name      = "BILL_USERNAME"
          valueFrom = "${var.app_secrets_arn}:bill_username::"
        },
        {
          name      = "BILL_PASSWORD"
          valueFrom = "${var.app_secrets_arn}:bill_password::"
        },
        {
          name      = "BILL_ORG_ID"
          valueFrom = "${var.app_secrets_arn}:bill_org_id::"
        },
        {
          name      = "BILL_FUNDING_ACCOUNT_ID"
          valueFrom = "${var.app_secrets_arn}:bill_funding_account_id::"
        }
      ]

      environmentFiles = var.sqs_queue_urls_env_file_arn != "" ? [
        {
          value = var.sqs_queue_urls_env_file_arn
          type  = "s3"
        }
      ] : []

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = var.log_group_name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -sf http://localhost:3000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 90
      }
    }
  ])

  tags = {
    Name        = "${local.prefix}-backend-task"
    Environment = var.environment
  }
}

# ECS Service
resource "aws_ecs_service" "backend" {
  name            = "${local.prefix}-backend"
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.backend.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "backend"
    container_port   = 3000
  }

  deployment_maximum_percent         = 100
  deployment_minimum_healthy_percent = 50

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  enable_execute_command = true

  tags = {
    Name        = "${local.prefix}-backend-service"
    Environment = var.environment
  }

  depends_on = [var.alb_listener_arn]
}

# Auto Scaling
resource "aws_appautoscaling_target" "backend" {
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${var.cluster_name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "backend_cpu" {
  name               = "${local.prefix}-backend-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}

resource "aws_appautoscaling_policy" "backend_memory" {
  name               = "${local.prefix}-backend-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value = 80.0
  }
}

resource "aws_appautoscaling_scheduled_action" "backend_scale_up" {
  count               = var.enable_scheduled_scaling && !local.is_prod ? 1 : 0
  name                = "${local.prefix}-backend-scale-up" 
  service_namespace   = "ecs"
  resource_id         = aws_appautoscaling_target.backend.resource_id
  scalable_dimension  = aws_appautoscaling_target.backend.scalable_dimension
  schedule            = "cron(0 13 ? * MON-FRI *)"

  scalable_target_action {
    min_capacity = var.min_capacity
    max_capacity = var.max_capacity
  }
}

resource "aws_appautoscaling_scheduled_action" "backend_scale_down" {
  count              = var.enable_scheduled_scaling && !local.is_prod ? 1 : 0
  name               = "${local.prefix}-backend-scale-down"
  service_namespace  = "ecs"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  schedule           = "cron(0 1 ? * TUE-SAT *)"

  scalable_target_action {
    min_capacity = 0
    max_capacity = 0
  }
}