output "bucket_id" {
  description = "AWS Config delivery bucket (platform only)"
  value       = try(aws_s3_bucket.config[0].id, null)
}

output "recorder_name" {
  description = "AWS Config recorder name (platform only)"
  value       = try(aws_config_configuration_recorder.main[0].name, null)
}
