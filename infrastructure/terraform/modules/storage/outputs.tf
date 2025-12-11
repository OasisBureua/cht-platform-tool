output "uploads_bucket_id" {
  description = "Uploads bucket ID"
  value       = aws_s3_bucket.uploads.id
}

output "uploads_bucket_arn" {
  description = "Uploads bucket ARN"
  value       = aws_s3_bucket.uploads.arn
}

output "uploads_bucket_name" {
  description = "Uploads bucket name"
  value       = aws_s3_bucket.uploads.bucket
}

output "uploads_bucket_regional_domain_name" {
  description = "Uploads bucket regional domain name"
  value       = aws_s3_bucket.uploads.bucket_regional_domain_name
}

output "logs_bucket_id" {
  description = "Logs bucket ID"
  value       = aws_s3_bucket.logs.id
}

output "logs_bucket_arn" {
  description = "Logs bucket ARN"
  value       = aws_s3_bucket.logs.arn
}

output "logs_bucket_name" {
  description = "Logs bucket name"
  value       = aws_s3_bucket.logs.bucket
}

output "terraform_state_bucket_id" {
  description = "Terraform state bucket ID"
  value       = var.create_terraform_state_bucket ? aws_s3_bucket.terraform_state[0].id : null
}

output "terraform_state_bucket_arn" {
  description = "Terraform state bucket ARN"
  value       = var.create_terraform_state_bucket ? aws_s3_bucket.terraform_state[0].arn : null
}

output "terraform_state_bucket_name" {
  description = "Terraform state bucket name"
  value       = var.create_terraform_state_bucket ? aws_s3_bucket.terraform_state[0].bucket : null
}
EOF* ✅

Your module structure is now:
