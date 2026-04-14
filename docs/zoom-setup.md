# Zoom API Setup for Webinars

The webinars pages (`/webinars`, `/webinars/:id`) pull live webinars from the Zoom API when credentials are configured. Without Zoom, only database programs with webinar links are shown.

## 1. Create a Server-to-Server OAuth App

1. Go to [Zoom App Marketplace](https://marketplace.zoom.us/)
2. Sign in and click **Develop** → **Build App**
3. Choose **Server-to-Server OAuth** app type
4. Fill in app name (e.g. "CHT Platform Webinars") and company info
5. Under **Scopes**, add:
   - `webinar:read:admin` (or `webinar:read` for your user's webinars)
6. Under **Activation**, add your account and activate
7. Copy the **Account ID**, **Client ID**, and **Client Secret**

## 2. Add Credentials to platform.tfvars

Edit `infrastructure/terraform/environments/variables/platform.tfvars`:

```hcl
zoom_account_id   = "your-account-id"
zoom_client_id    = "your-client-id"
zoom_client_secret = "your-client-secret"
```

## 3. Deploy Secrets and Backend

```bash
# Refresh Secrets Manager with Zoom credentials
./scripts/set-secrets.sh platform

# Redeploy backend to pick up new env vars
./scripts/deploy-ecs-services.sh platform v1.0.6
```

Or manually:

```bash
cd infrastructure/terraform/environments/us-east-1
terraform apply -var-file="../variables/platform.tfvars" -auto-approve -target=module.secrets

# Force ECS to pull new task definition
aws ecs update-service --cluster cht-platform-cluster --service cht-platform-backend --force-new-deployment --region us-east-1 --no-cli-pager
```

## 4. Verify

- Visit `https://testapp.communityhealth.media/webinars`
- Scheduled Zoom webinars should appear (IDs prefixed with `zoom-`)
- Click a webinar to see join link

## Local Development

Add to `backend/.env`:

```
ZOOM_ACCOUNT_ID=your-account-id
ZOOM_CLIENT_ID=your-client-id
ZOOM_CLIENT_SECRET=your-client-secret
```

Restart the backend. Webinars will be fetched from Zoom and merged with DB programs.
