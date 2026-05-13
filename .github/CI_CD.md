
## CI/CD with GitHub Actions

### Automatic Deployments

- **Push to `main`** → Automatically deploys to Dev (us-east-1)
- **Create tag `v*`** → Deploys to Production (requires approval)
- **Pull Request** → Runs validation and tests

### Workflows

1. **PR Validation** (`.github/workflows/pr-validation.yml`)
   - Linting
   - Unit tests
   - Terraform validation

2. **Dev Deployment** (`.github/workflows/deploy-dev.yml`)
   - Build Docker images
   - Deploy infrastructure
   - Run migrations
   - Deploy frontend
   - Health checks

3. **Prod Deployment** (`.github/workflows/deploy-prod.yml`)
   - Requires manual approval
   - Multi-region deployment
   - Versioned releases

### Manual Deployment

You can still use scripts for manual deployments:
```bash
./scripts/deploy-primary.sh dev
./scripts/deploy-frontend.sh dev
```

### Rollback

To rollback to a previous version:
```bash
# Deploy a previous tag
git tag -l  # List available tags
# In GitHub: Actions → Deploy to Production → Run workflow → Select tag
```
