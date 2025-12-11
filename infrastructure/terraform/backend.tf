# Terraform Backend Configuration
# 
# IMPORTANT: This backend configuration should be COMMENTED OUT on first run.
# After the first terraform apply creates the S3 bucket and DynamoDB table,
# uncomment this block and run `terraform init -migrate-state` to move state to S3.
#
# terraform {
#   backend "s3" {
#     bucket         = "cht-platform-terraform-state-dev"  # Change per environment
#     key            = "infrastructure/terraform.tfstate"
#     region         = "us-east-1"
#     encrypt        = true
#     dynamodb_table = "cht-platform-terraform-locks"
#   }
# }

# Terraform version constraints
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# AWS Provider Configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
