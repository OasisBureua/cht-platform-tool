#!/bin/bash

echo "🔍 Checking AWS permissions..."
echo ""

# Check identity
echo "📋 Your AWS Identity:"
aws sts get-caller-identity
echo ""

# Check ECR permissions
echo "📦 Testing ECR access..."
aws ecr describe-repositories --max-items 1 2>/dev/null && echo "✅ ECR: OK" || echo "❌ ECR: DENIED"

# Check ECS permissions
echo "🐳 Testing ECS access..."
aws ecs list-clusters --max-items 1 2>/dev/null && echo "✅ ECS: OK" || echo "❌ ECS: DENIED"

# Check RDS permissions
echo "🗄️  Testing RDS access..."
aws rds describe-db-instances --max-items 1 2>/dev/null && echo "✅ RDS: OK" || echo "❌ RDS: DENIED"

# Check S3 permissions
echo "📦 Testing S3 access..."
aws s3 ls 2>/dev/null && echo "✅ S3: OK" || echo "❌ S3: DENIED"

# Check VPC permissions
echo "🌐 Testing VPC access..."
aws ec2 describe-vpcs --max-items 1 2>/dev/null && echo "✅ VPC: OK" || echo "❌ VPC: DENIED"

# Check IAM permissions
echo "🔐 Testing IAM access..."
aws iam get-user 2>/dev/null && echo "✅ IAM: OK" || echo "❌ IAM: DENIED"

echo ""
echo "✅ Permission check complete!"
