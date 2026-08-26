output "bucket_id" {
  description = "Bucket name"
  value       = aws_s3_bucket.session_assets.id
}

output "bucket_arn" {
  description = "Bucket ARN"
  value       = aws_s3_bucket.session_assets.arn
}

output "public_url_base" {
  description = "HTTPS base URL for objects (virtual-hosted–style)"
  value       = "https://${aws_s3_bucket.session_assets.bucket}.s3.${var.aws_region}.amazonaws.com"
}
