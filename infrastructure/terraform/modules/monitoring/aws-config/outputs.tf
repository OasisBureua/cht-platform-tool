output "bucket_id" {
  description = "AWS Config delivery bucket"
  value       = aws_s3_bucket.config.id
}

output "recorder_name" {
  description = "AWS Config recorder name"
  value       = aws_config_configuration_recorder.main.name
}
