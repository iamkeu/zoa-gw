# OAvote — Vercel + Supabase Architecture

## 1. Scope

MVP là một Next.js full-stack app chạy trên cùng một Vercel project, kết nối một Zalo OA duy nhất. User đăng nhập bằng Google qua Supabase Auth. File được lưu trong private Supabase Storage bucket tạm thời 24–72 giờ, sau đó backend gửi file và Vote template tới Zalo UID.

Production deployment hiện tại: Vercel project `zoa-gw`, domain `https://zoa-gw.vercel.app`. Không dùng tên project cũ `zoa-vote-gateway`.

## 2. Runtime architecture

```text
Browser
  ├─ Google OAuth via Supabase Auth
  ├─ upload file → private Storage bucket
  └─ call Next.js API with Supabase session
        ↓
Vercel / Next.js
  ├─ auth/session + RBAC
  ├─ signed upload / cleanup
  ├─ Zalo OAuth and encrypted token store
  ├─ send file + Vote template orchestration
  ├─ transaction/event/audit writes
  ├─ Zalo webhook
  └─ Vercel Cron reconcile
        ↓
Supabase
  ├─ Auth
  ├─ PostgreSQL + RLS
  └─ private Storage: oavote-files
        ↓
Zalo OA / ZBS APIs
```

Vercel server code uses the Supabase service-role key only on the server. Browser code uses the anon key and the authenticated session. No Zalo token, service-role key or webhook secret is returned to the browser.

## 3. Project structure

- `app/(auth)/login`: Google sign-in.
- `app/(dashboard)/`: authenticated UI shell.
- `app/api/zalo/*`: Zalo template, send, follower and OAuth routes.
- `app/api/webhook/zalo`: signed Zalo webhook.
- `app/api/cron/reconcile`: scheduled rating reconciliation.
- `app/api/transactions`: transaction list/detail/retry APIs.
- `lib/supabase/*`: browser/server/admin clients.
- `lib/authz.ts`: session and role checks.
- `lib/zalo/*`: Zalo API client, OAuth, token encryption, error mapping.
- `supabase/migrations`: versioned DDL, RLS and Storage policies.

## 4. RBAC matrix

| Capability | admin | operator | viewer |
|---|:---:|:---:|:---:|
| Login and view dashboard | yes | yes | yes |
| Upload temporary file | yes | yes | no |
| Send file + Vote | yes | yes | no |
| Retry failed file/Vote part | yes | yes | no |
| View own transactions | yes | yes | yes |
| View all transactions | yes | no | no |
| Read template catalog | yes | yes | yes |
| Create/update/archive saved templates | yes | no | no |
| Connect/reconnect Zalo OA | yes | no | no |
| Manage users and roles | yes | no | no |
| View audit logs | yes | no | no |
| Run reconcile manually | yes | no | no |

Operator scope is own transactions in MVP. Every authorization decision is enforced server-side; UI hiding is not security.

## 5. Core state model

`transactions` stores current state; `transaction_events` stores append-only history.

- Transaction: `created → processing → completed|partial_failure|failed`.
- File: `pending → processing → sent|failed`.
- Vote: `pending → processing → sent|failed`.
- Rating: `not_applicable|pending|received`.

The file and Vote operations are independent. A successful part is never resent by a retry of the other part.

## 6. Idempotency and retry

Every create/send request supplies `Idempotency-Key`. The key is unique per user. A duplicate request returns the original transaction. Retry endpoints target exactly one failed part and require the current part status to be `failed`.

## 7. Storage lifecycle

Bucket `oavote-files` is private. Object path is `{user_id}/{transaction_id}/{random}-{safe_filename}`. The database records the path and expiry. A daily Vercel Cron deletes expired objects and marks them deleted. Successful processing keeps the object only until `storage_expires_at`; failed requests may remain up to 72 hours.

## 8. Internal API contract

All authenticated routes return `{ data, error, requestId }` and use the Supabase session. Error shape: `{ code, message, details? }`.

### `POST /api/uploads/sign`

- Roles: admin/operator.
- Request: `{ fileName, contentType, sizeBytes }`.
- Response: `{ data: { transactionId, objectPath, uploadUrl, expiresAt } }`.
- Validates extension, MIME and 5 MB limit.

### `POST /api/transactions`

- Roles: admin/operator.
- Header: `Idempotency-Key: <uuid>`.
- Request:

```json
{
  "zaloUid": "string",
  "customerName": "string|null",
  "file": { "objectPath": "string", "fileName": "string", "contentType": "string" },
  "vote": { "templateId": "string", "templateName": "string", "templateData": {} }
}
```

- Response: `{ data: { transactionId, status, fileStatus, voteStatus } }`.

### `POST /api/transactions/:id/retry`

- Roles: admin/operator owner.
- Request: `{ part: "file" | "vote" }`.
- Only retries failed part; preserves successful message IDs.

### `GET /api/transactions`

- Roles: all authenticated users.
- Query: `page`, `pageSize`, `status`, `from`, `to`, `search`.
- Admin sees all; operator/viewer see permitted scope.

### `GET /api/zalo/templates`

- Roles: all authenticated users.
- Returns enabled ZBS templates available to the single OA.

### `POST /api/zalo/oauth/start`

- Roles: admin.
- Returns Zalo permission URL. Callback is `/api/zalo/oauth/callback`.

### `POST /api/webhook/zalo`

- No user session; validates `X-ZEvent-Signature` against the raw body.
- Idempotently maps `message.msg_id` to `transactions.vote_message_id`.

### `POST /api/cron/reconcile`

- No user session; validates `CRON_SECRET`.
- Reconciles only pending ratings in bounded pages.

## 9. Send flow

1. Browser validates file and requests `/api/uploads/sign`.
2. Backend creates a transaction shell and returns a signed upload URL.
3. Browser uploads directly to private Storage.
4. Browser submits `POST /api/transactions` with the idempotency key.
5. Backend verifies ownership of object path, creates event `transaction.created`, and reads the file using a service-role signed URL.
6. Backend calls Zalo upload-file and send-file APIs; writes `file_message_id` and a file event.
7. Backend calls ZBS template message API; writes `vote_message_id` and a vote event.
8. Backend calculates final transaction state and returns both part results.
9. Storage object remains until expiry; cleanup cron deletes it.

## 10. Rating update flow

- Webhook verifies signature, deduplicates by event hash, finds transaction by `vote_message_id`, updates rating fields and appends `rating.received`.
- Reconcile scans pending ratings and calls the verified Zalo rating API. It is mandatory even when webhook is enabled.

## 11. Security and operations

- Google identity is from Supabase Auth; `performed_by` is never accepted from client payload.
- RLS is enabled on all application tables. Service-role access is server-only.
- Zalo tokens are encrypted with AES-256-GCM and `TOKEN_ENCRYPTION_KEY`.
- No raw secrets in logs. Error responses use request IDs.
- Production uses versioned migrations; no `db push --accept-data-loss`.
- Required monitoring: Vercel logs, Supabase advisors, token-refresh failure alerts, webhook signature failures and cron health.
