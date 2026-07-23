#!/usr/bin/env bash
# Resolve currently applied ECS images from Terraform state.
# Used by CI on infra-only (or any plan that is not building new images) so
# terraform apply does not roll services back to placeholder tags in *.github.tfvars.
#
# Usage (from TF env dir, after terraform init):
#   eval "$(../../../../scripts/ci-resolve-ecs-images-from-state.sh)"
#   # exports BACKEND_IMAGE and WORKER_IMAGE
set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi

if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform is required" >&2
  exit 1
fi

STATE_JSON="$(terraform show -json)"

extract_image() {
  local needle="$1"
  echo "$STATE_JSON" | jq -r --arg needle "$needle" '
    [
      ..
      | objects
      | select(
          (.type? == "aws_ecs_task_definition")
          and ((.address? // .name? // "") | tostring | contains($needle))
        )
      | (.values.container_definitions // empty)
    ]
    | map(select(type == "string" and length > 0))
    | first
    | if . == null then empty else (fromjson | .[0].image) end
  '
}

BACKEND_IMAGE="$(extract_image "ecs_backend" || true)"
WORKER_IMAGE="$(extract_image "ecs_worker" || true)"

if [ -z "${BACKEND_IMAGE:-}" ] || [ -z "${WORKER_IMAGE:-}" ]; then
  echo "Could not resolve current ECS images from Terraform state (backend='${BACKEND_IMAGE:-}' worker='${WORKER_IMAGE:-}')." >&2
  echo "Refusing infra-only plan that would risk rolling images back to tfvars placeholders." >&2
  exit 1
fi

echo "Resolved current ECS images from state:" >&2
echo "  backend: ${BACKEND_IMAGE}" >&2
echo "  worker:  ${WORKER_IMAGE}" >&2

# Print shell assignments for eval
printf "BACKEND_IMAGE=%q\n" "$BACKEND_IMAGE"
printf "WORKER_IMAGE=%q\n" "$WORKER_IMAGE"
