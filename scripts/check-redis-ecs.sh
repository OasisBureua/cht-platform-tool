#!/bin/bash
# Run Redis connectivity test from INSIDE the VPC via one-off ECS task
# Uses same network as backend - will show real Redis connectivity
set -e

CLUSTER="${1:-cht-platform-cluster}"
SERVICE="${2:-cht-platform-backend}"
AWS_REGION="${AWS_REGION:-us-east-1}"

echo "🔍 Redis check from ECS (inside VPC)"
echo "===================================="
echo "Cluster: $CLUSTER"
echo "Region: $AWS_REGION"
echo ""

# Get task definition and network config from running service
TASK_DEF=$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" \
  --region "$AWS_REGION" --query 'services[0].taskDefinition' --output text 2>/dev/null) || {
  echo "❌ Could not find service. Is it deployed?"
  exit 1
}

SUBNETS=$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" \
  --region "$AWS_REGION" --query 'services[0].networkConfiguration.awsvpcConfiguration.subnets' --output text | tr '\t' ',')
SGS=$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" \
  --region "$AWS_REGION" --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups' --output text | tr '\t' ',')

echo "Running one-off task..."
TASK_ARN=$(aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$TASK_DEF" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SGS],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["node","-e","const R=require(\"ioredis\");const r=new R({host:process.env.REDIS_HOST,port:process.env.REDIS_PORT,tls:{rejectUnauthorized:true},connectTimeout:5000});r.on(\"ready\",async()=>{await r.setex(\"x\",5,\"ok\");console.log(\"OK:\",await r.get(\"x\"));r.quit();process.exit(0)});r.on(\"error\",e=>{console.error(\"ERR:\",e.message);process.exit(1)});setTimeout(()=>{console.error(\"TIMEOUT\");process.exit(1)},10000)"]}]}' \
  --region "$AWS_REGION" \
  --query 'tasks[0].taskArn' --output text 2>/dev/null)

if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" = "None" ]; then
  echo "❌ Failed to start task"
  exit 1
fi

echo "Task: $TASK_ARN"
echo "Waiting for result (check CloudWatch logs for backend container)..."
echo ""
echo "To see output:"
echo "  aws logs tail /ecs/cht-platform-backend --follow --task-id $(echo $TASK_ARN | cut -d'/' -f3)"
echo ""
echo "Or: aws ecs describe-tasks --cluster $CLUSTER --tasks $TASK_ARN --query 'tasks[0].lastStatus'"
