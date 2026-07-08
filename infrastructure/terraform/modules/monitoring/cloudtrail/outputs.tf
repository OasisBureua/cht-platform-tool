output "trail_arn" {
  description = "CloudTrail trail ARN"
  value       = aws_cloudtrail.main.arn
}

output "bucket_id" {
  description = "CloudTrail S3 bucket name"
  value       = aws_s3_bucket.cloudtrail.id
}

output "log_group_name" {
  description = "CloudWatch log group for CloudTrail"
  value       = aws_cloudwatch_log_group.cloudtrail.name
}
