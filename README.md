# MCP Google Workspace Server

A **production-ready, generic MCP (Model Context Protocol) server** that provides AI agents with secure, reusable tools for interacting with Gmail and Google Docs.

Any MCP-compatible AI agent (Claude Desktop, Cursor, Windsurf, etc.) can connect to this server and use Google Workspace capabilities without needing to implement Google API integrations themselves.

---

## Architecture

```
AI Agent (Claude, Cursor, etc.)
   │
   │  MCP Protocol (stdio)
   ▼
Generic MCP Server
   ├── gmail_create_draft
   ├── gmail_send_email
   └── google_docs_append_content
   │
   ▼
Google APIs (HTTPS)
   ├── Gmail API
   └── Google Docs API
```

**Design priority:** Security → Genericity → Simplicity → Extensibility → Reliability

See [`docs/architecture.md`](docs/architecture.md) for full architectural details.

---

## Available MCP Tools

| Tool | Description | Side Effect |
|---|---|---|
| `gmail_create_draft` | Creates an email draft in Gmail | Saved draft only |
| `gmail_send_email` | Sends an email via Gmail | **Permanent — irreversible** |
| `google_docs_append_content` | Appends text to end of a Google Doc | Document edit |

---

## Prerequisites

- Node.js 18 or later
- A Google Cloud project with the following APIs enabled:
  - [Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com)
  - [Google Docs API](https://console.cloud.google.com/apis/library/docs.googleapis.com)
- OAuth 2.0 credentials (see setup below)

---

## Google Cloud Setup

### 1. Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one

### 2. Enable Required APIs

Enable the following APIs in your project:
- **Gmail API** — for email draft creation and sending
- **Google Docs API** — for document content appending

### 3. Configure OAuth 2.0

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Select **Desktop application** as the application type
4. Add `http://localhost:3000/oauth/callback` as an authorized redirect URI
5. Download the credentials JSON and note your **Client ID** and **Client Secret**

### 4. Required OAuth Scopes

| Scope | Purpose |
|---|---|
| `https://www.googleapis.com/auth/gmail.compose` | Create drafts and send email |
| `https://www.googleapis.com/auth/documents` | Read and write Google Docs |

---

## Installation

```bash
# Clone the repository
git clone https://github.com/Daminigit/MCP-server-for-pulse-detector.git
cd MCP-server-for-pulse-detector

# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
```

---

## Environment Variables

Edit `.env` with your credentials:

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
GOOGLE_TOKEN_STORAGE=.tokens/google-token.json
MCP_SERVER_PORT=3000
MCP_SERVER_HOST=localhost
LOG_LEVEL=info
```

> ⚠️ **Never commit `.env` to Git.** It is already listed in `.gitignore`.

---

## Authentication (One-Time Setup)

Before starting the server, you must complete a one-time OAuth flow to authorize the application:

```bash
npm run auth
```

This will:
1. Print a Google OAuth consent URL
2. Open it in your browser and grant the requested permissions
3. Paste the authorization code back into the terminal
4. Save the tokens to `GOOGLE_TOKEN_STORAGE`

After this step, the server can authenticate all subsequent API calls automatically, including token refresh.

---

## Running the Server

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

---

## Connecting an MCP-Compatible AI Agent

### Claude Desktop

Add the following to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": ["/absolute/path/to/MCP-server-for-pulse-detector/dist/index.js"],
      "env": {
        "GOOGLE_CLIENT_ID": "your-client-id",
        "GOOGLE_CLIENT_SECRET": "your-client-secret",
        "GOOGLE_REDIRECT_URI": "http://localhost:3000/oauth/callback",
        "GOOGLE_TOKEN_STORAGE": "/absolute/path/to/.tokens/google-token.json"
      }
    }
  }
}
```

### Using tsx (Development)

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/MCP-server-for-pulse-detector/src/index.ts"]
    }
  }
}
```

---

## Example Tool Calls

### Create an Email Draft

```json
{
  "tool": "gmail_create_draft",
  "arguments": {
    "to": ["recipient@example.com"],
    "subject": "Project Update",
    "body": "Here is the latest update on the project.",
    "cc": ["manager@example.com"]
  }
}
```

Response:
```json
{
  "success": true,
  "draft_id": "r1234567890",
  "message": "Email draft created successfully."
}
```

### Send an Email

```json
{
  "tool": "gmail_send_email",
  "arguments": {
    "to": ["recipient@example.com"],
    "subject": "Meeting Confirmed",
    "body": "The meeting is confirmed for tomorrow at 10 AM."
  }
}
```

### Append to a Google Doc

```json
{
  "tool": "google_docs_append_content",
  "arguments": {
    "document_id": "1AbCdEfGhIjKlMnOpQrStUvWxYz",
    "content": "This is additional content generated by the AI agent."
  }
}
```

---

## Testing

```bash
# Run all unit tests
npm test

# Run with coverage report
npm run test:coverage
```

Tests use mocked Google API clients — no real API calls are made during testing.

---

## Security Considerations

- **OAuth tokens are never logged** — pino is configured to redact all token fields automatically.
- **Tokens are never sent to the AI agent** — they are managed entirely within the service layer.
- **Client credentials are loaded from environment variables only** — never hard-coded.
- **The `.tokens/` directory is gitignored** — tokens are never committed to source control.
- **Least-privilege OAuth scopes** — only `gmail.compose` and `documents` are requested.
- **Input validation** occurs before any API call is made.
- **Error messages are sanitized** — no tokens or secrets appear in error payloads.

---

## Troubleshooting

### `AUTHENTICATION_REQUIRED` error

Run `npm run auth` to complete the OAuth flow and generate tokens.

### `DOCUMENT_NOT_FOUND` error

Ensure the document ID is correct (from the Google Doc URL) and the authenticated Google account has access to the document.

### `PERMISSION_DENIED` error

Check that the required OAuth scopes were granted during the auth flow. Re-run `npm run auth` and grant all requested permissions.

### Token file exists but auth still fails

Delete `.tokens/google-token.json` and re-run `npm run auth` to obtain fresh tokens.

### TypeScript build errors

```bash
npm run lint  # Check for type errors without building
```

---

## Project Structure

```
src/
├── server/          # MCP server bootstrap & tool registration
├── tools/
│   ├── gmail/       # gmail_create_draft, gmail_send_email handlers
│   └── google-docs/ # google_docs_append_content handler
├── services/        # Google API clients (Gmail, Docs, Auth)
├── utils/           # Validation, error handling, logging
├── config/          # Environment variable loader
└── scripts/         # OAuth setup script (auth.ts)

tests/               # Unit tests with mocked Google APIs
docs/                # Architecture and problem statement
```
