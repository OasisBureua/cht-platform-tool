output "detector_id" {
  description = "GuardDuty detector ID"
  value       = try(aws_guardduty_detector.main[0].id, null)
}
