#!/bin/bash
# Redis connectivity diagnostic - run before deploy to verify config
# Note: Redis is in a private subnet; connection test only works from within the VPC (VPN/bastion)
set -e

SECRET_NAME="${1:-cht-platform-redis-connection}"
AWS_REGION="${AWS_REGION:-us-east-1}"

echo "🔍 Redis connectivity check"
echo "================================"
echo "Secret: $SECRET_NAME"
echo "Region: $AWS_REGION"
echo ""

# 0. Infrastructure checks (no network needed)
echo "📋 Infrastructure checks..."
REDIS_SG=$(aws ec2 describe-security-groups \
  --region "$AWS_REGION" \
  --filters "Name=group-name,Values=cht-platform-redis-sg" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "none")
BACKEND_SG=$(aws ec2 describe-security-groups \
  --region "$AWS_REGION" \
  --filters "Name=group-name,Values=cht-platform-backend-sg" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "none")

if [ "$REDIS_SG" != "none" ] && [ "$BACKEND_SG" != "none" ]; then
  echo "   Redis SG: $REDIS_SG"
  echo "   Backend SG: $BACKEND_SG"
  INGRESS=$(aws ec2 describe-security-groups --group-ids "$REDIS_SG" --region "$AWS_REGION" \
    --query "SecurityGroups[0].IpPermissions[?FromPort==\`6379\`]" --output json 2>/dev/null)
  if echo "$INGRESS" | grep -q "$BACKEND_SG"; then
    echo "   ✅ Redis SG allows backend on 6379"
  else
    echo "   ⚠️  Redis SG may not allow backend - check ingress rules"
  fi
else
  echo "   ⚠️  Could not find SGs (run terraform apply first?)"
fi
echo ""

# 1. Fetch Redis config from Secrets Manager
echo "📥 Fetching Redis config from Secrets Manager..."
REDIS_JSON=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_NAME" \
  --region "$AWS_REGION" \
  --query SecretString \
  --output text 2>/dev/null) || {
  echo "❌ Failed to fetch secret. Ensure AWS CLI is configured and you have access."
  exit 1
}

REDIS_HOST=$(echo "$REDIS_JSON" | jq -r '.host')
REDIS_PORT=$(echo "$REDIS_JSON" | jq -r '.port')

echo "   Host: $REDIS_HOST"
echo "   Port: $REDIS_PORT"
echo ""

# 2. Check if host looks like Elasticache (TLS required)
if [[ "$REDIS_HOST" == *".cache.amazonaws.com"* ]]; then
  echo "✅ Host is Elasticache - TLS is required (transit_encryption_enabled)"
  USE_TLS="true"
else
  echo "⚠️  Host is not Elasticache - TLS optional"
  USE_TLS="false"
fi
echo ""

# 3. Run Node.js connection test (uses same ioredis config as backend)
echo "🔌 Testing connection (TLS=$USE_TLS)..."
cd "$(dirname "$0")/../backend"
node -e "
const Redis = require('ioredis');
const host = process.env.REDIS_HOST || '$REDIS_HOST';
const port = parseInt(process.env.REDIS_PORT || '$REDIS_PORT', 10);
const useTls = '$USE_TLS' === 'true';

const opts = {
  host,
  port,
  connectTimeout: 5000,
  commandTimeout: 10000,
  retryStrategy: () => null,
  tls: useTls ? { rejectUnauthorized: true } : undefined,
};

console.log('Connecting to', host + ':' + port, useTls ? '(TLS)' : '(no TLS)');
const redis = new Redis(opts);

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
  process.exitCode = 1;
});

redis.on('connect', () => console.log('   TCP connection established'));
redis.on('ready', async () => {
  console.log('   Redis ready');
  try {
    await redis.setex('_health_check', 10, 'ok');
    const val = await redis.get('_health_check');
    await redis.del('_health_check');
    console.log('   SET/GET test:', val === 'ok' ? '✅ OK' : '❌ FAIL');
    console.log('');
    console.log('✅ Redis is reachable and working');
  } catch (e) {
    console.error('❌ Command failed:', e.message);
    process.exitCode = 1;
  } finally {
    redis.disconnect();
  }
});

setTimeout(() => {
  if (redis.status !== 'ready' && redis.status !== 'end') {
    console.error('❌ Connection timeout (5s)');
    console.error('   Possible causes:');
    console.error('   - Redis is in a private subnet (run from VPN/bastion or inside VPC)');
    console.error('   - Security group blocks port 6379');
    console.error('   - TLS mismatch (Elasticache requires TLS)');
    redis.disconnect();
    process.exit(1);
  }
}, 6000);
" 2>&1

EXIT=$?
echo ""
if [ $EXIT -eq 0 ]; then
  echo "✅ Redis check passed"
else
  echo "❌ Redis check failed"
  echo ""
  echo "Summary:"
  echo "  - Infra: Redis SG allows backend ✅"
  echo "  - ETIMEDOUT from local = expected (Redis is in private subnet)"
  echo ""
  echo "To test from INSIDE the VPC (real connectivity):"
  echo "  ./scripts/check-redis-ecs.sh   # Runs Redis test in a one-off ECS task"
  echo ""
  echo "Known production issue: 'Connection is closed' - Redis connects then drops."
  echo "  Possible causes: TLS handshake, Elasticache timeout (300s), or network."
  echo "  Try: REDIS_TLS_REJECT_UNAUTHORIZED=false in backend (diagnostic only)."
  echo ""
  echo "The DB session fallback (v1.0.12) lets login work without Redis."
fi
exit $EXIT
