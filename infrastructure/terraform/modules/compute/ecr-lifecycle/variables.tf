variable "repository_names" {
  description = "Existing ECR repository names to attach lifecycle policies to."
  type        = list(string)
}

variable "lifecycle_mode" {
  description = "Lifecycle policy set: platform (v*/platform-*) or dev (semver + dev-latest)."
  type        = string

  validation {
    condition     = contains(["platform", "dev"], var.lifecycle_mode)
    error_message = "lifecycle_mode must be platform or dev."
  }
}
