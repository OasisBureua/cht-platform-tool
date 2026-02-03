variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "secrets_arns" {
  description = "List of Secrets Manager ARNs"
  type        = list(string)
}

variable "kms_key_arns" {
  description = "List of KMS key ARNs"
  type        = list(string)
}

variable "sqs_queue_arns" {
  description = "List of SQS queue ARNs"
  type        = list(string)
}

variable "certificates_bucket_arn" {
  description = "S3 certificates bucket ARN"
  type        = string
}