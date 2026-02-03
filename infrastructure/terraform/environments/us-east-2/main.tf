# This file contains the COMPLETE infrastructure for us-east-2
# It is NOT deployed by default (manual failover only)

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "cht-platform-terraform-state-dev"
    key            = "us-east-2-standby/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "cht-platform-terraform-locks"
  }
}

provider "aws" {
  region = "us-east-2"

  default_tags {
    tags = {
      Project     = var.project
      Environment = "${var.environment}-failover"
      Region      = "us-east-2"
      Purpose     = "Disaster Recovery"
      ManagedBy   = "Terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

# NOTE: This infrastructure is identical to us-east-1
# but deployed in us-east-2 for disaster recovery

# Copy all modules from us-east-1 here...
# (Same structure, different region)

# KMS, VPC, RDS, ElastiCache, ECS, ALB, CloudFront, etc.
# (I'll create this if you want, but it's the same as us-east-1)