#!/bin/bash
# Request ACM certificates for devapp.communityhealth.media.
exec "$(dirname "$0")/request-certificate.sh" devapp "$@"
