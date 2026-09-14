# Production / Dokploy notes for Steward (app + document collab)

## Single container

The Docker image runs:
- Next.js on **:3000**
- Hocuspocus (document live co-edit) on **:1234**

Started by `scripts/docker-entrypoint.js` after `prisma migrate deploy`.

After changing the Dockerfile (especially collab runtime deps), trigger a **full image rebuild and redeploy** on Dokploy so the runner stage re-runs `npm install` and the collab smoke check. A restart-only deploy reuses the old image and will not pick up the fix.

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
5. Verify: `curl -fsS http://127.0.0.1:1234/` returns `OK`; open a document → toolbar **Live sync** (not stuck on Connecting / Local editing); upload a file → no 503.

### Env checklist (collab)

Same secret must be visible to **both** Next and `scripts/collab-server.cjs`:

| Variable | Local | Prod |
|----------|--------|------|
| `COLLAB_TOKEN_SECRET` | Yes (copy `.env.example`) | Yes — long random, stable across restarts |
| `COLLAB_WS_URL` | `ws://localhost:1234` | Public `wss://…` the **browser** can open |
| `COLLAB_PORT` | `1234` | In-container listen port |
| `DISABLE_COLLAB` | unset | `1` only to force local-only editors |

`npm run dev:all` runs Next + collab. If `COLLAB_TOKEN_SECRET` lives only in `.env.local`, both still match now (collab-server loads `.env.local`). Prefer `.env` so Docker/Dokploy see it too.

## Local Docker

```bash
npm run docker:build
npm run docker:run
# or: docker compose up -d
```

Compose maps `3000` and `1234`. Default `COLLAB_WS_URL=ws://localhost:1234`.

## Disable collab

Set `DISABLE_COLLAB=1` if you only want the Next app. The collab-token API then returns `{ mode: "local" }` and editors skip the WebSocket instead of hanging on Connecting.

## Local verify (`npm run dev:all`)

```bash
# .env has COLLAB_TOKEN_SECRET + COLLAB_WS_URL=ws://localhost:1234
npm run db:setup
npm run dev:all
curl -fsS http://127.0.0.1:1234/   # expect: OK
```

Sign in → Docs → open a rich-text document. Toolbar should read **Live sync** within a few seconds. A second browser/profile on the same doc should show carets and incoming edits. `DISABLE_COLLAB=1 npm run dev` should show **Local editing** immediately (no Connecting hang).

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
