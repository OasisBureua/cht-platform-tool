locals {
  is_prod             = var.environment == "prod" || var.environment == "platform"
  prefix              = var.environment == "platform" ? var.project : "${var.project}-${var.environment}"
  worker_security_sgs = length(var.security_group_ids) > 0 ? var.security_group_ids : [aws_security_group.worker[0].id]
}

# Security Group for Worker (created only when not provided via security_group_ids)
resource "aws_security_group" "worker" {
  count       = length(var.security_group_ids) > 0 ? 0 : 1
  name        = "${local.prefix}-worker-sg"
  description = "Security group for worker ECS tasks"
  vpc_id      = var.vpc_id

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${local.prefix}-worker-sg"
    Environment = var.environment
  }
}

# ECS Task Definition
resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.prefix}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = var.container_image
      essential = true

      environment = concat(
        [
          {
            name  = "ENVIRONMENT"
            value = var.environment
          },
          {
            name  = "AWS_REGION"
            value = var.aws_region
          },
          {
            name  = "SES_FROM_EMAIL"
            value = var.ses_from_email
          }
        ],
        var.sqs_payment_queue_url != "" ? [{ name = "SQS_PAYMENT_QUEUE_URL", value = var.sqs_payment_queue_url }] : [],
        var.sqs_scheduled_jobs_queue_url != "" ? [{ name = "SQS_SCHEDULED_JOBS_QUEUE_URL", value = var.sqs_scheduled_jobs_queue_url }] : [],
        var.frontend_app_url != "" ? [{ name = "FRONTEND_APP_URL", value = var.frontend_app_url }] : []
      )

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${var.database_secret_arn}:url::"
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
          "awslogs-stream-prefix" = "worker"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "pgrep -f start_workers || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 90
      }
    }
  ])

  tags = {
    Name        = "${local.prefix}-worker-task"
    Environment = var.environment
  }
}

# ECS Service
resource "aws_ecs_service" "worker" {
  name            = "${local.prefix}-worker"
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = local.worker_security_sgs
    assign_public_ip = false
  }

  deployment_maximum_percent         = 100
  deployment_minimum_healthy_percent = 50

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  enable_execute_command = true

  tags = {
    Name        = "${local.prefix}-worker-service"
    Environment = var.environment
  }
}

# Auto Scaling
resource "aws_appautoscaling_target" "worker" {
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${var.cluster_name}/${aws_ecs_service.worker.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Scale based on SQS queue depth
resource "aws_appautoscaling_policy" "worker_sqs" {
  name               = "${local.prefix}-worker-sqs-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension
  service_namespace  = aws_appautoscaling_target.worker.service_namespace

  target_tracking_scaling_policy_configuration {
    customized_metric_specification {
      metric_name = "ApproximateNumberOfMessagesVisible"
      namespace   = "AWS/SQS"
      statistic   = "Average"

      dimensions {
        name  = "QueueName"
        value = var.primary_queue_name
      }
    }
    target_value = 10.0 # Scale when queue has >10 messages
  }
}

resource "aws_appautoscaling_scheduled_action" "worker_scale_up" {
  count              = var.enable_scheduled_scaling && !local.is_prod ? 1 : 0
  name               = "${local.prefix}-worker-scale-up"
  service_namespace  = "ecs"
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension
  schedule           = "cron(0 13 ? * MON-FRI *)"

  scalable_target_action {
    min_capacity = var.min_capacity
    max_capacity = var.max_capacity
  }
}

resource "aws_appautoscaling_scheduled_action" "worker_scale_down" {
  count              = var.enable_scheduled_scaling && !local.is_prod ? 1 : 0
  name               = "${local.prefix}-worker-scale-down"
  service_namespace  = "ecs"
  resource_id        = aws_appautoscaling_target.worker.resource_id
  scalable_dimension = aws_appautoscaling_target.worker.scalable_dimension
  schedule           = "cron(0 1 ? * TUE-SAT *)"

  scalable_target_action {
    min_capacity = 0
    max_capacity = 0
  }
}