output "destination_region" {
  description = "Region receiving replicated images."
  value       = var.destination_region
}

output "dr_registry_url" {
  description = "ECR registry URL in the destination region (use for DR ECS task images)."
  value       = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.destination_region}.amazonaws.com"
}

output "dr_backend_image_base" {
  description = "DR ECR image base for backend (append :tag)."
  value       = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.destination_region}.amazonaws.com/cht-platform-backend"
}

output "dr_worker_image_base" {
  description = "DR ECR image base for worker (append :tag)."
  value       = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.destination_region}.amazonaws.com/cht-platform-worker"
}

output "repository_arns" {
  description = "Primary-region ECR repository ARNs included in replication."
  value       = [for repo in data.aws_ecr_repository.repositories : repo.arn]
}
