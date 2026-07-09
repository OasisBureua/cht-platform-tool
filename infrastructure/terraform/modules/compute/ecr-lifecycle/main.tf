locals {
  platform_lifecycle_policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep last 100 platform release tags (v*)"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = 100
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 3
        description  = "Keep last 10 platform-latest builds"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["platform-"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = { type = "expire" }
      }
    ]
  })

  dev_lifecycle_policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep last 10 dev-latest builds"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["dev-"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 3
        description  = "Keep last 50 dev semver images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 50
        }
        action = { type = "expire" }
      }
    ]
  })

  lifecycle_policy = var.lifecycle_mode == "platform" ? local.platform_lifecycle_policy : local.dev_lifecycle_policy
}

resource "aws_ecr_lifecycle_policy" "main" {
  for_each = toset(var.repository_names)

  repository = each.value
  policy     = local.lifecycle_policy
}
