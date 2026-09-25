# zoa-gateway-vercel

Backend Gateway trên Vercel — đầu mối 2 chiều duy nhất giao tiếp Zalo OA/ZNS/ZBS
API, phục vụ ZOA.vote v1.0 và các nghiệp vụ Zalo khác trong tương lai.

**Trạng thái hiện tại: F01 Send File + Rating (Development Phase 6)** —
`app/api/zalo/send-file` đã hoạt động thật: upload+gửi file (kênh Tin Tư
vấn) và gửi Rating Template (kênh Template Message) như 2 thao tác độc lập,
ghi `TransactionLog`. `followers`, `webhook`, `cron/reconcile` vẫn là
scaffold 501, chờ Phase 7-8. Xem
`docs/API_CONTRACT.md` cho toàn bộ endpoint Zalo đã xác minh, và spec
`ZOA.vote_v1_0_Specification.md` cho phạm vi nghiệp vụ đầy đủ.

## Cài đặt

```bash
npm install
cp .env.example .env.local   # điền giá trị thật, KHÔNG commit file này
npx prisma migrate dev --name init
npm run dev
```

## Test

```bash
npm test
```
Chạy Vitest, import và gọi trực tiếp route/lib thật (`app/api/**`, `lib/**`)
— không copy/paste logic sang test. Chỉ 2 "biên" bị mock: Prisma (Neon) và
`fetch` (Zalo API), qua `test/support/mock-db.ts` / `test/support/mock-fetch.ts`.

## Thiết lập Auth (Phase 3, làm 1 lần)

1. **Gateway client cho GAS**: `npm run create-client -- "zoa-vote-gas"` →
   copy API key in ra (chỉ hiện 1 lần) vào GAS Script Properties
   `GATEWAY_API_KEY`.
2. **OAuth PKCE**: `npm run generate-pkce-pair` → copy `code_verifier` vào
   env var `ZALO_OAUTH_CODE_VERIFIER`; copy `code_challenge` dán vào form
   "Thiết lập đường dẫn yêu cầu cấp quyền" trong Zalo App console, cùng với
   `OAUTH_CALLBACK_URL` (URL thật của route `/api/oauth/callback` sau khi
   deploy) — bấm Lưu trong console trước khi test luồng kết nối.
3. Đặt `TOKEN_ENCRYPTION_KEY` (chuỗi ngẫu nhiên đủ dài, vd `openssl rand -hex 32`).

## Cấu trúc

```
app/api/
  zalo/send-file/          F01 — Phase 6
  zalo/templates/          F02 — Phase 5
  zalo/templates/[id]/params/  F02 — Phase 5
  zalo/followers/          F04 — Phase 7
  zalo/followers/refresh/  F04 — Phase 7
  oauth/start/             F05 — Phase 3
  oauth/callback/          F05 — Phase 3
  webhook/zalo/            F03 — Phase 8
  cron/reconcile/          F03 — Phase 8
  log/list/                F03/F07 — Phase 8-9
lib/
  db.ts            Prisma client singleton
  zalo-client.ts    Zalo API client (chưa triển khai — Phase 4)
prisma/schema.prisma  Neon Postgres schema
docs/API_CONTRACT.md  Endpoint Zalo đã xác minh (nguồn tham chiếu duy nhất)
```

## Nguyên tắc (Developer Constraints, spec mục 11)

- GAS không bao giờ gọi trực tiếp Zalo API — mọi giao tiếp qua Gateway này.
- Secret Zalo chỉ lưu ở đây (Neon, mã hoá) hoặc biến môi trường, không đi qua GAS.
- Mỗi client gọi Gateway có API key riêng (bảng `gateway_clients`).
- Không tự suy đoán endpoint/field Zalo chưa xác minh — bám `docs/API_CONTRACT.md`.
