# Architecture: Generic MCP Server for Gmail & Google Docs

> **Design Priority:** Security → Genericity → Simplicity → Extensibility → Reliability

---

## 1. System Overview

The MCP (Model Context Protocol) server acts as a **generic, reusable bridge** between any MCP-compatible AI agent and Google Workspace APIs. It exposes a set of well-defined tools that AI agents can discover and invoke without any knowledge of the underlying Google API implementation.

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│     AI Agent A      │     │     AI Agent B      │     │     AI Agent C      │
└──────────┬──────────┘     └──────────┬──────────┘     └──────────┬──────────┘
           │                           │                           │
           └───────────────────────────┼───────────────────────────┘
                                       │  MCP Protocol
                                       ▼
                      ┌────────────────────────────────┐
                      │     Generic MCP Server         │
                      │                                │
                      │  ┌──────────────────────────┐  │
                      │  │     MCP Tool Registry     │  │
                      │  │  - gmail_create_draft     │  │
                      │  │  - gmail_send_email       │  │
                      │  │  - google_docs_append     │  │
                      │  └────────────┬─────────────┘  │
                      │               │                 │
                      │  ┌────────────▼─────────────┐  │
                      │  │     Service Layer         │  │
                      │  │  - GmailService           │  │
                      │  │  - GoogleDocsService      │  │
                      │  │  - GoogleAuthService      │  │
                      │  └────────────┬─────────────┘  │
                      └───────────────┼─────────────────┘
                                      │ HTTPS
                                      ▼
                         ┌────────────────────────┐
                         │      Google APIs        │
                         │  ┌───────────────────┐  │
                         │  │    Gmail API      │  │
                         │  └───────────────────┘  │
                         │  ┌───────────────────┐  │
                         │  │  Google Docs API  │  │
                         │  └───────────────────┘  │
                         └────────────────────────┘
```

---

## 2. Architectural Layers

The server is organized into **four distinct layers**, each with a single responsibility.

```
┌──────────────────────────────────────────────────────┐
│                  Layer 1: MCP Interface              │
│       Tool definitions, input schemas, responses     │
├──────────────────────────────────────────────────────┤
│                  Layer 2: Tool Handlers              │
│    Validation, orchestration, error formatting       │
├──────────────────────────────────────────────────────┤
│                  Layer 3: Service Layer              │
│   Gmail, Google Docs, Auth — Google API abstraction  │
├──────────────────────────────────────────────────────┤
│                  Layer 4: Infrastructure             │
│         Config, logging, token storage, utils        │
└──────────────────────────────────────────────────────┘
```

### Layer 1 – MCP Interface
- Registers all tools with the MCP SDK.
- Defines strict JSON input schemas with required/optional parameters.
- Returns structured JSON responses to the AI agent.
- Contains **no business logic**.

### Layer 2 – Tool Handlers
- One handler per MCP tool.
- Validates input before calling the service layer.
- Converts service-layer results into MCP-compliant structured responses.
- Handles and formats errors into standardized error objects.

### Layer 3 – Service Layer
- Encapsulates all Google API interactions.
- `GmailService` — create draft, send email.
- `GoogleDocsService` — append content to a document.
- `GoogleAuthService` — OAuth 2.0 token management, refresh, scopes.
- **Never exposes tokens or credentials** to upper layers.

### Layer 4 – Infrastructure
- `Config` — loads environment variables; fails fast if required vars are missing.
- `Logger` — structured, redacted logging (no tokens, no secrets).
- `TokenStorage` — secure local storage of OAuth refresh tokens.
- `Validator` — email address format checks, document ID checks, required field checks.
- `ErrorHandler` — maps internal errors to standardized MCP error payloads.

---

## 3. Project Structure

```
mcp-google-workspace/
│
├── src/
│   ├── server/
│   │   └── mcp-server.ts          # MCP server bootstrap & tool registration
│   │
│   ├── tools/
│   │   ├── gmail/
│   │   │   ├── create-draft.ts    # gmail_create_draft handler
│   │   │   └── send-email.ts      # gmail_send_email handler
│   │   │
│   │   └── google-docs/
│   │       └── append-content.ts  # google_docs_append_content handler
│   │
│   ├── services/
│   │   ├── gmail-service.ts       # Gmail API client wrapper
│   │   ├── google-docs-service.ts # Google Docs API client wrapper
│   │   └── google-auth-service.ts # OAuth 2.0 token lifecycle manager
│   │
│   ├── utils/
│   │   ├── validation.ts          # Input validators (email, docId, etc.)
│   │   └── error-handling.ts      # Error normalization & MCP error builder
│   │
│   └── config/
│       └── environment.ts         # Env var loader with validation
│
├── tests/
│   ├── tools/
│   │   ├── gmail/
│   │   └── google-docs/
│   ├── services/
│   └── utils/
│
├── docs/
│   ├── ProblemStatement.md
│   └── architecture.md
│
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

---

## 4. MCP Tools

### 4.1 Tool Registry

| Tool Name                    | Description                                 | Side Effect   |
|------------------------------|---------------------------------------------|---------------|
| `gmail_create_draft`         | Creates a draft in the user's Gmail account | None (saved)  |
| `gmail_send_email`           | Sends an email via Gmail                    | **Permanent** |
| `google_docs_append_content` | Appends plain text to a Google Doc          | Document edit |

### 4.2 `gmail_create_draft`

**Input Schema:**

```json
{
  "to":       { "type": "array",  "items": { "type": "string" }, "required": true  },
  "cc":       { "type": "array",  "items": { "type": "string" }, "required": false },
  "bcc":      { "type": "array",  "items": { "type": "string" }, "required": false },
  "subject":  { "type": "string", "required": true  },
  "body":     { "type": "string", "required": true  },
  "html_body":{ "type": "string", "required": false }
}
```

**Success Response:**

```json
{
  "success":  true,
  "draft_id": "<gmail_draft_id>",
  "message":  "Email draft created successfully."
}
```

> **Note:** This tool **never** sends the email. Creating a draft and sending an email are strictly separate operations.

---

### 4.3 `gmail_send_email`

**Input Schema:** Same fields as `gmail_create_draft`.

**Success Response:**

```json
{
  "success":    true,
  "message_id": "<gmail_message_id>",
  "thread_id":  "<gmail_thread_id>",
  "message":    "Email sent successfully."
}
```

> **Warning:** This action is **permanent**. The consuming AI agent should implement a user-confirmation step before invoking this tool.

---

### 4.4 `google_docs_append_content`

**Input Schema:**

```json
{
  "document_id": { "type": "string", "required": true },
  "content":     { "type": "string", "required": true }
}
```

**Success Response:**

```json
{
  "success":     true,
  "document_id": "<google_doc_id>",
  "message":     "Content appended successfully."
}
```

**Append Behavior:**

1. Validate `document_id` format.
2. Authenticate via `GoogleAuthService`.
3. Fetch document to determine the current end index.
4. Insert content at end index with a newline separator.
5. Return success response.
6. Preserve all existing document content — **no overwrites**.

---

## 5. Authentication Flow

### OAuth 2.0 Authorization Code Flow

```
User / Admin
    │
    │ 1. Initiate OAuth flow
    ▼
MCP Server (GoogleAuthService)
    │
    │ 2. Redirect to Google OAuth consent screen
    ▼
Google Authorization Server
    │
    │ 3. Authorization code returned
    ▼
MCP Server
    │
    │ 4. Exchange code for access + refresh tokens
    │ 5. Store refresh token securely (local file / env)
    │ 6. Use access token for API calls
    │ 7. Auto-refresh access token on expiry
    ▼
Gmail API / Google Docs API
```

### Token Security Rules

| Rule                                     | Enforced |
|------------------------------------------|----------|
| Tokens never sent to AI agent            | Yes      |
| Tokens never logged                      | Yes      |
| Client secret never logged               | Yes      |
| Credentials loaded from environment only | Yes      |
| Secrets never committed to Git           | Yes      |
| Refresh token auto-rotation on use       | Yes      |

### Required OAuth Scopes (Minimum)

| Service      | Scope                                            | Purpose      |
|--------------|--------------------------------------------------|--------------|
| Gmail        | `https://www.googleapis.com/auth/gmail.compose`  | Draft + Send |
| Google Docs  | `https://www.googleapis.com/auth/documents`      | Read + Append|

---

## 6. Configuration

All configuration is environment-based. No secrets are hard-coded.

```env
# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback

# Token storage path (relative to project root)
GOOGLE_TOKEN_STORAGE=.tokens/google-token.json

# MCP Server
MCP_SERVER_PORT=3000
MCP_SERVER_HOST=localhost
```

Provide a `.env.example` with all keys and placeholder values. The `.env` file must be listed in `.gitignore`.

---

## 7. Error Handling

All errors are returned as structured JSON. Errors **never** expose tokens, secrets, or stack traces to the AI agent.

### Standard Error Schema

```json
{
  "success": false,
  "error":   "<ERROR_CODE>",
  "message": "<Human-readable description>"
}
```

### Error Code Reference

| Code                      | Trigger                                     |
|---------------------------|---------------------------------------------|
| `AUTHENTICATION_REQUIRED` | No valid OAuth token found                  |
| `INVALID_INPUT`           | Malformed email address, empty body, etc.   |
| `DOCUMENT_NOT_FOUND`      | Google Doc ID not found or inaccessible     |
| `GMAIL_API_ERROR`         | Gmail API returned an error                 |
| `GOOGLE_DOCS_API_ERROR`   | Google Docs API returned an error           |
| `PERMISSION_DENIED`       | Insufficient OAuth scope or doc permissions |
| `RATE_LIMIT_EXCEEDED`     | Google API quota exceeded                   |
| `INTERNAL_ERROR`          | Unexpected server-side failure              |

---

## 8. Logging Strategy

Logging is structured (JSON-format) and safe for production.

### Logged Events

| Event                    | Log Level |
|--------------------------|-----------|
| Tool invoked             | INFO      |
| Operation started        | DEBUG     |
| Operation completed      | INFO      |
| Google API error         | ERROR     |
| Authentication failure   | WARN      |
| Input validation failure | WARN      |

### Never Logged

- OAuth access tokens
- OAuth refresh tokens
- Google client secrets
- Raw email body content (unless debug mode is explicitly enabled)

---

## 9. Security Architecture

```
AI Agent
   │
   │  (only sees: tool names, schemas, structured responses)
   │
   ▼
MCP Tool Interface
   │
   │  (validates inputs, formats errors, no tokens passed)
   │
   ▼
Service Layer
   │
   │  (holds tokens in memory only; never returns raw tokens)
   │
   ▼
GoogleAuthService
   │
   │  (reads tokens from secure storage; auto-refreshes)
   │
   ▼
Token Storage (local encrypted file or env var)
```

**Key security boundaries:**
- The **AI agent layer** has zero knowledge of OAuth tokens or API credentials.
- The **service layer** is the only component that touches tokens.
- Input validation happens **before** any API call is made.
- All external API calls use **HTTPS**.
- Least-privilege OAuth scopes are enforced.

---

## 10. Sequence Diagrams

### `gmail_create_draft` — Happy Path

```
AI Agent          MCP Server          GmailService       Gmail API
    │                  │                    │                 │
    │ gmail_create_draft(input)             │                 │
    │─────────────────►│                   │                 │
    │                  │ validate(input)   │                 │
    │                  │──────────┐        │                 │
    │                  │◄─────────┘        │                 │
    │                  │ createDraft(data) │                 │
    │                  │──────────────────►│                 │
    │                  │                   │ POST /drafts    │
    │                  │                   │────────────────►│
    │                  │                   │  { draft_id }  │
    │                  │                   │◄────────────────│
    │                  │  { success, draft_id }              │
    │                  │◄──────────────────│                 │
    │ { success, draft_id }               │                 │
    │◄─────────────────│                   │                 │
```

### `google_docs_append_content` — Happy Path

```
AI Agent       MCP Server       GoogleDocsService     Google Docs API
    │               │                  │                     │
    │ append(doc_id, content)          │                     │
    │──────────────►│                  │                     │
    │               │ validate input   │                     │
    │               │─────────┐        │                     │
    │               │◄────────┘        │                     │
    │               │ appendContent()  │                     │
    │               │─────────────────►│                     │
    │               │                  │ GET document        │
    │               │                  │────────────────────►│
    │               │                  │ { endIndex }        │
    │               │                  │◄────────────────────│
    │               │                  │ batchUpdate(insert) │
    │               │                  │────────────────────►│
    │               │                  │ { success }         │
    │               │                  │◄────────────────────│
    │               │ { success }      │                     │
    │◄──────────────│                  │                     │
```

---

## 11. Extensibility Design

### Adding a New Tool (Pattern)

1. Create a new handler in `src/tools/<service>/<tool-name>.ts`.
2. Create or extend the corresponding service in `src/services/`.
3. Register the tool in `src/server/mcp-server.ts`.
4. Add the new OAuth scope to `GoogleAuthService` if required.
5. Write unit tests in `tests/tools/<service>/`.

### Future Capability Roadmap

```
Gmail
├── [V1] create draft
├── [V1] send email
├── [Future] search emails
├── [Future] read email
└── [Future] reply to email

Google Docs
├── [V1] append content
├── [Future] read document
├── [Future] update content
└── [Future] create document

Google Sheets (Future)
├── read data
├── append row
├── update cell
└── create spreadsheet

Google Calendar (Future)
├── create event
├── update event
├── delete event
└── list events
```

---

## 12. Testing Strategy

### Unit Tests

| Area                 | What to Test                                                    |
|----------------------|-----------------------------------------------------------------|
| `gmail_create_draft` | Valid input, invalid email, missing subject/body, auth failure  |
| `gmail_send_email`   | Valid input, invalid email, Gmail API error                     |
| `google_docs_append` | Valid input, empty content, invalid doc ID, doc not found       |
| `GmailService`       | API call construction, response parsing, error propagation      |
| `GoogleDocsService`  | End-index detection, insert construction, error propagation     |
| `GoogleAuthService`  | Token refresh, missing token, scope validation                  |
| `Validator`          | Email regex, required fields, document ID format                |

### Integration Tests

- MCP server starts and registers all tools successfully.
- Tool discovery returns all three registered tools.
- End-to-end tool invocation with mocked Google API responses.

### Google API Mocking
All unit tests must **mock Google API clients** to avoid real API calls during CI.

---

## 13. V1 Scope Boundary

| In Scope (V1)                    | Out of Scope (V1)               |
|----------------------------------|---------------------------------|
| `gmail_create_draft`             | Gmail inbox management          |
| `gmail_send_email`               | Email search or read            |
| `google_docs_append_content`     | Rich document formatting        |
| OAuth 2.0 authentication         | Google Sheets integration       |
| Structured error responses       | Google Calendar integration     |
| Input validation                 | Agent-specific business logic   |
| Structured logging               | Autonomous email workflows      |
| Unit tests                       | Complete Google Docs editor     |
| `.env.example`                   | Multi-user/multi-tenant support |
| `README.md`                      |                                 |

---

## 14. Definition of Done

- [ ] MCP server starts and registers all tools without errors.
- [ ] MCP-compatible clients can list and discover tools.
- [ ] `gmail_create_draft` creates a real draft in Gmail.
- [ ] `gmail_send_email` sends a real email via Gmail.
- [ ] `google_docs_append_content` appends to a real Google Doc.
- [ ] OAuth 2.0 authentication and token refresh work correctly.
- [ ] No tokens or secrets appear in any log output.
- [ ] Input validation rejects malformed inputs with clear errors.
- [ ] All unit tests pass with mocked Google APIs.
- [ ] `.env.example` documents all required environment variables.
- [ ] `README.md` covers setup, usage, and security considerations.
- [ ] Any MCP-compatible AI agent can connect without server changes.
