# Deploying the Backend to Azure App Service (Linux, Basic B1)

This guide deploys `backend/` as a **container** on Azure App Service, using the
GHCR image your existing CI workflow (`.github/workflows/deploy-backend.yml`)
already builds and pushes. No changes to the Dockerfile are needed.

Plan tier: **Basic B1** (1 vCPU, 1.75 GB RAM, ~$13/mo, no free tier / no
autoscale, no slots — fine for a low-traffic personal project).

---

## 0. Prerequisites

- An Azure subscription (with billing enabled — B1 is not free).
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
  installed locally, **or** use [Azure Cloud Shell](https://shell.azure.com/)
  (bash, browser-based, CLI pre-installed — no local install needed).
- Your GHCR image is currently **private** by default (`ghcr.io/sreeaditya-dev/rag-backend`).
  Azure needs credentials to pull it — see step 4.
- Push access to this GitHub repo (to add secrets / trigger the workflow).

Login first (skip if using Cloud Shell, which is already authenticated):

```bash
az login
```

---

## 1. Choose names and create a resource group

Pick globally-unique values (the web app name becomes part of a public URL:
`https://<name>.azurewebsites.net`):

```bash
RESOURCE_GROUP="rag-system-rg"
LOCATION="centralindia"          # pick the region closest to you/users
PLAN_NAME="rag-system-plan"
APP_NAME="rag-system-backend"    # must be globally unique across all of Azure

az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
```

---

## 2. Create the App Service plan (Linux, B1)

```bash
az appservice plan create \
  --name "$PLAN_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --is-linux \
  --sku B1
```

---

## 3. Create the Web App, pointed at a placeholder image

We deploy a placeholder first; the real image is set once GHCR auth is wired
up in step 4, and from then on your existing GitHub Actions workflow pushes
new images automatically.

```bash
az webapp create \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --plan "$PLAN_NAME" \
  --deployment-container-image-name "mcr.microsoft.com/appsvc/staticsite:latest"
```

---

## 4. Give the Web App pull access to your private GHCR image

Create a GitHub [Personal Access Token](https://github.com/settings/tokens)
(classic, scope: `read:packages`) — this is what Azure uses to authenticate
to `ghcr.io`. Then:

```bash
GHCR_USERNAME="your-github-username"
GHCR_TOKEN="ghp_xxx_your_read_packages_token"

az webapp config container set \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --container-image-name "ghcr.io/sreeaditya-dev/rag-backend:latest" \
  --container-registry-url "https://ghcr.io" \
  --container-registry-user "$GHCR_USERNAME" \
  --container-registry-password "$GHCR_TOKEN"
```

> Alternative: make the GHCR package public (Package settings → Change
> visibility → Public on github.com/users/sreeaditya-dev/packages). Then you
> can drop `--container-registry-user/password` entirely.

Azure App Service listens for whatever port your container `EXPOSE`s; your
Dockerfile exposes `8000` and Azure auto-detects this via `WEBSITES_PORT`.
Set it explicitly to be safe:

```bash
az webapp config appsettings set \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --settings WEBSITES_PORT=8000
```

---

## 5. Set application environment variables

These map 1:1 to `backend/.env` / `backend/app/config.py`. Fill in real
values (don't commit secrets — this command sends them straight to Azure):

```bash
az webapp config appsettings set \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --settings \
    NVIDIA_API_KEY="nvapi-xxxxx" \
    NVIDIA_BASE_URL="https://integrate.api.nvidia.com/v1" \
    LLM_MODEL="meta/llama-3.1-70b-instruct" \
    EMBEDDING_MODEL="nvidia/nv-embedqa-e5-v5" \
    EMBEDDING_DIMENSION="1024" \
    PINECONE_API_KEY="xxxxx" \
    PINECONE_INDEX_NAME="rag-system" \
    PINECONE_CLOUD="aws" \
    PINECONE_REGION="us-east-1" \
    API_KEY="choose-a-long-random-secret" \
    TAVILY_API_KEY="tvly-xxxxx" \
    CORS_ORIGINS='["https://your-frontend-domain.com"]' \
    DATABASE_URL="postgresql://..." \
    S3_ENDPOINT_URL="https://xxx.supabase.co/storage/v1/s3" \
    S3_ACCESS_KEY_ID="xxxxx" \
    S3_SECRET_ACCESS_KEY="xxxxx" \
    S3_BUCKET_NAME="rag-documents"
```

**Important — B1 has no persistent local disk across restarts/redeploys.**
`DATABASE_URL` defaults to local SQLite and `UPLOAD_DIR` defaults to a local
folder — both get wiped on every container restart/redeploy on App Service.
Use a real Postgres (e.g. Supabase) for `DATABASE_URL` and S3-compatible
storage (Supabase Storage, already supported in `config.py`) for uploads, or
your data will vanish on every deploy.

`API_KEY` is required (`backend/app/auth.py` fails closed / returns 503 for
every protected route if unset) — don't skip it.

---

## 6. Get the publish profile and add it to GitHub Secrets

```bash
az webapp deployment list-publishing-profiles \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --xml > publish-profile.xml
```

Open `publish-profile.xml`, copy its **entire contents**, then in GitHub:
`Settings → Secrets and variables → Actions → New repository secret`

- Name: `AZURE_WEBAPP_PUBLISH_PROFILE`
- Value: (paste the full XML)

Delete `publish-profile.xml` locally afterward — it's a credential.

(Optional, only if you want Telegram failure alerts from the existing
workflow: also add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` secrets.)

---

## 7. Point the workflow at your real app name

Edit `.github/workflows/deploy-backend.yml`:

```yaml
env:
  AZURE_WEBAPP_NAME: rag-system-backend   # ← your $APP_NAME from step 1
```

Commit and push this change to `main`.

---

## 8. Deploy

Any push to `main` touching `backend/**` now runs the pipeline automatically:
`test` → `build-and-deploy` (builds/pushes the Docker image to GHCR, then
`azure/webapps-deploy` swaps it into the Web App).

To trigger it manually instead: GitHub → **Actions** tab → "Deploy Backend to
Azure App Service" → **Run workflow**.

---

## 9. Verify

```bash
curl https://$APP_NAME.azurewebsites.net/health
```

Watch container startup logs if it doesn't come up:

```bash
az webapp log tail --name "$APP_NAME" --resource-group "$RESOURCE_GROUP"
```

---

## Cost / scaling notes

- B1 is a fixed-cost single instance — no autoscale, no deployment slots.
  Fine for low/moderate traffic; upgrade to S1+ if you need slots or scaling.
- Only one container instance runs — no zero-downtime deploys on B1 (brief
  restart on every deploy).
- Remember to `az group delete --name "$RESOURCE_GROUP"` if you ever want to
  tear everything down (deletes the plan + web app + all their billing).
