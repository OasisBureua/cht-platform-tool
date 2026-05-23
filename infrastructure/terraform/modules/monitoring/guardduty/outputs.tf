output "detector_id" {
  description = "GuardDuty detector ID (platform only)"
  value       = try(aws_guardduty_detector.main[0].id, null)
}
