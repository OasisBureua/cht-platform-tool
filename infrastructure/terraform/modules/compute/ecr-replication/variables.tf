variable "destination_region" {
  description = "AWS region that receives replicated ECR images."
  type        = string
  default     = "us-east-2"
}

variable "repository_prefixes" {
  description = <<-EOT
    PREFIX_MATCH filters for the account-level ECR replication ruleset.
    Must include every repo family in this AWS account that relies on
    us-east-1 → destination replication (ContentHub and platform share one ruleset).
  EOT
  type        = list(string)
  default     = ["contenthub-", "cht-platform-"]
}

variable "repository_names" {
  description = "Known platform repository names (used for data sources and outputs)."
  type        = list(string)
  default     = ["cht-platform-backend", "cht-platform-worker"]
}
