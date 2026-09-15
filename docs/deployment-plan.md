# Railway Deployment Plan — MCP Google Workspace Server

## Background

The MCP server currently uses **`StdioServerTransport`** — it communicates over stdin/stdout and is designed to run as a local process managed by an MCP client (Claude Desktop, Cursor, etc.).

Railway is a cloud platform that runs persistent services over **HTTP**. To deploy on Railway, the server must expose an HTTP endpoint. The MCP SDK v1.30.0 (already installed) supports **`StreamableHttpServerTransport`** — the modern remote transport for MCP over HTTP.

---

## What Needs to Change

The core tools (Gmail, Google Docs) require **zero changes**. Only the transport layer and token storage need updating.

### Core Problem 1 — Transport
Railway needs HTTP. Current server uses stdio only.
**Fix:** Add a `StreamableHttpServerTransport` alongside the existing stdio transport, served via Node.js `http` module (no new frameworks needed).

### Core Problem 2 — Token Storage
Currently tokens are stored in `.tokens/google-token.json` on disk. Railway containers are **ephemeral** — the file will be lost on every redeploy.
**Fix:** Store tokens as a `GOOGLE_TOKEN_JSON` environment variable (base64-encoded JSON string), with the auth service reading from env first, falling back to file.

### Core Problem 3 — OAuth Redirect URI
The current redirect URI is `http://localhost:3000/oauth/callback`. On Railway it must be `https://<your-app>.railway.app/oauth/callback`.
**Fix:** Set `GOOGLE_REDIRECT_URI` as a Railway env var to the production URL.

---

## Proposed Changes

### 1. Token Storage — Env-var first

#### [MODIFY] `src/services/google-auth-service.ts`

- `loadTokens()` → checks `GOOGLE_TOKEN_JSON` env var first (base64-decoded JSON), then falls back to file
- `saveTokens()` → writes to file as before (for local dev); in production the token is pre-loaded from env

---

### 2. HTTP Transport — StreamableHttp

#### [NEW] `src/server/http-server.ts`

New file that creates a Node.js HTTP server with:
- `POST /mcp` — MCP Streamable HTTP endpoint (main MCP communication)
- `GET /health` — Health check for Railway (returns `{"status":"ok"}`)
- Optional: `MCP_API_KEY` header validation middleware

#### [MODIFY] `src/index.ts`

- Detect `RAILWAY_ENVIRONMENT` or `NODE_ENV=production` env var
- In production → start HTTP server with StreamableHttp transport
- In development → keep existing StdioServerTransport (no breaking changes)

---

### 3. Environment Variables

#### [NEW] `.env.example`

Documents all required env vars for Railway setup:

```env
# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://<your-app>.railway.app/oauth/callback

# Token storage (base64-encoded JSON of the token file)
GOOGLE_TOKEN_JSON=

# Server
PORT=3000          # Railway injects this automatically
LOG_LEVEL=info

# Optional security
MCP_API_KEY=       # Set a random secret to protect the /mcp endpoint
```

---

### 4. Dockerfile

#### [NEW] `Dockerfile`

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

#### [NEW] `.dockerignore`

Excludes `node_modules`, `.env`, `.tokens/`, `dist/`, `docs/`.

---

### 5. Railway Config

#### [NEW] `railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "DOCKERFILE" },
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

---

## Deployment Steps

1. **Get your Railway domain first**
   - Create a new Railway project → Deploy → note the generated URL (e.g. `mcp-server.railway.app`)

2. **Update Google Cloud Console**
   - Add `https://<your-app>.railway.app/oauth/callback` to **Authorized redirect URIs**

3. **Set Railway env vars**
   ```
   GOOGLE_CLIENT_ID        = (from .env)
   GOOGLE_CLIENT_SECRET    = (from .env)
   GOOGLE_REDIRECT_URI     = https://<your-app>.railway.app/oauth/callback
   GOOGLE_TOKEN_JSON       = (base64 of your .tokens/google-token.json)
   LOG_LEVEL               = info
   MCP_API_KEY             = (optional, random secret)
   ```
   To generate `GOOGLE_TOKEN_JSON`:
   ```bash
   cat .tokens/google-token.json | base64
   ```

4. **Push to GitHub** → Railway auto-deploys from your repo

5. **Verify** — Railway health check hits `/health` → server goes green

6. **Connect MCP client** — point Claude Desktop / Cursor to:
   ```
   https://<your-app>.railway.app/mcp
   ```

---

## Verification Plan

### Automated Tests
```bash
npm test   # All 46 existing tests must still pass
```

### Manual Verification
- `GET /health` returns `{"status":"ok","version":"1.0.0"}`
- `POST /mcp` with MCP `initialize` message returns valid handshake
- Create a Gmail draft via the deployed server end-to-end

---

## Files Summary

| File | Action |
|---|---|
| `src/services/google-auth-service.ts` | MODIFY — env-var token fallback |
| `src/server/http-server.ts` | NEW — StreamableHttp transport |
| `src/index.ts` | MODIFY — stdio/http transport selector |
| `.env.example` | NEW — Railway env var docs |
| `Dockerfile` | NEW — container build |
| `.dockerignore` | NEW — exclude secrets from image |
| `railway.json` | NEW — Railway deployment config |
