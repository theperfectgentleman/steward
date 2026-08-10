# Production / Dokploy notes for Steward (app + document collab)

## Single container

The Docker image runs:
- Next.js on **:3000**
- Hocuspocus (document live co-edit) on **:1234**

Started by `scripts/docker-entrypoint.js` after `prisma migrate deploy`.

## Dokploy checklist

1. Publish / expose ports **3000** and **1234** (or reverse-proxy both).
2. Set environment (Create Environment File):

| Variable | Required | Purpose |
|----------|----------|---------|
| `DB_*` or `DATABASE_URL` | Yes | Postgres |
| `COLLAB_PORT` | No | Default `1234` (in-container listen port) |
| `COLLAB_WS_URL` | **Yes (prod)** | Public WebSocket URL browsers use, e.g. `wss://collab.your-domain.com` |
| `COLLAB_TOKEN_SECRET` | **Yes (prod)** | Long random secret (HMAC for collab tokens) — must match across restarts |
| `R2_ACCOUNT_ID` | For uploads | Cloudflare R2 |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | For uploads | R2 API token |
| `R2_BUCKET` / `R2_ENDPOINT` | For uploads | Bucket + S3 endpoint |
| `BREVO_*` or `BREVO_API_KEY` | For email | Invites, OTP, attention digests |
| `GROQ_API_KEY` | No | Optional AI |

3. Reverse proxy:
   - HTTPS → app `:3000`
   - WSS → collab `:1234` (enable WebSocket upgrade on that host/path)

### Example Caddy (collab subdomain)

```caddy
collab.your-domain.com {
  reverse_proxy steward-app:1234
}
```

### Example nginx (WebSocket upgrade)

```nginx
location / {
  proxy_pass http://127.0.0.1:1234;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
}
```

4. Redeploy the image after setting `COLLAB_WS_URL` (runtime; no rebuild required for this var).
5. Verify: open a document → live co-edit connects; upload a file → no 503.

## Local Docker

```bash
npm run docker:build
npm run docker:run
# or: docker compose up -d
```

Compose maps `3000` and `1234`. Default `COLLAB_WS_URL=ws://localhost:1234`.

## Disable collab

Set `DISABLE_COLLAB=1` if you only want the Next app (editors fall back to local mode).

## Cloudflare R2 (document files)

Library uploads, imports (originals), task attachments, and event deliverables store binaries in R2 when configured.

| Variable | Purpose |
|----------|---------|
| `R2_ACCOUNT_ID` | Cloudflare account id |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 API token (Object Read & Write) |
| `R2_BUCKET` | Bucket name |
| `R2_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` |
| `R2_KEY_PREFIX` | Optional object key prefix (default `steward`) |
| `R2_PUBLIC_BASE_URL` | Optional; downloads use auth-gated `/api/.../file` routes |

Browsers never receive R2 credentials — files are served via authenticated Next.js routes that stream from R2.

## Brevo email (production)

Prefer `BREVO_API_KEY` (HTTPS) over SMTP on VPS/Dokploy (port 587 may be blocked).

Authenticate your sending domain in Brevo (SPF, DKIM, DMARC) before go-live to avoid spam folders.

Test: `npx tsx scripts/test-brevo-email.ts`
