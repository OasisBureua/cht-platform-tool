#!/usr/bin/env bash
# Dev semver tag helper — delegates to next-image-tag.sh (no v prefix).
exec "$(dirname "$0")/next-image-tag.sh" "${1:-cht-platform-backend}" "${2:-us-east-1}" ""
