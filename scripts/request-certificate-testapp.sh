#!/bin/bash
# Backward-compatible wrapper for testapp certificates.
exec "$(dirname "$0")/request-certificate.sh" testapp "$@"
