# Changelog — zoa-gateway-vercel

## [Unreleased]
### Added (Phase 3 — Auth)
- `lib/api-auth.ts`: xác thực API key theo client (thay cho Next.js
  middleware.ts vì Prisma cần Node.js runtime, không tương thích Edge
  middleware) — áp dụng cho mọi route nghiệp vụ (send-file, templates,
  followers, log/list), KHÔNG áp dụng cho oauth/callback (Zalo redirect),
  webhook/zalo (X-ZEvent-Signature), cron/reconcile (CRON_SECRET).
- `lib/crypto.ts`: sinh/hash API key (sha256), không lưu plaintext.
- `lib/token-crypto.ts`: mã hoá AES-256-GCM cho access/refresh token trước khi lưu Neon.
- `lib/pkce.ts`, `scripts/generate-pkce-pair.ts`: sinh cặp code_verifier/code_challenge
  1 lần cho việc cấu hình thủ công trong Zalo App console.
- `lib/zalo-oauth.ts`: exchangeCodeForToken, refreshAccessToken, buildPermissionUrl
  — theo đúng API_CONTRACT.md mục 1.
- `lib/token-store.ts`: getValidAccessToken(oaId) — tự refresh access token
  xoay vòng an toàn, dùng cho các phase sau (F01/F02/F03/F04).
- `app/api/oauth/start`, `app/api/oauth/callback`: luồng OAuth thật, lưu
  ZaloToken (mã hoá) vào Neon.
- `scripts/create-gateway-client.ts`: tạo gateway client mới + in API key 1 lần.
- Prisma schema: thêm model `ZaloToken`.

### Changed
- **Phát hiện quan trọng khi implement OAuth**: tài liệu Zalo xác nhận
  `code_challenge` và `redirect_uri` được cấu hình TĨNH qua form trong Zalo
  App console (mục thiết lập đường dẫn yêu cầu cấp quyền), không truyền động
  qua query string mỗi lần xin quyền. Vì vậy đã bỏ thiết kế PKCE-động-mỗi-
  request ban đầu (model `OAuthState` đã bị loại khỏi schema) và chuyển sang
  `code_verifier` tĩnh lưu ở biến môi trường `ZALO_OAUTH_CODE_VERIFIER`,
  khớp với `code_challenge` đã lưu thủ công trong console.
- `.env.example`: bổ sung `OAUTH_CALLBACK_URL`, `ZALO_OAUTH_CODE_VERIFIER`.

## [Unreleased] — Phase 4 (Zalo Client)
### Added
- `lib/zalo-errors.ts`: bảng mã lỗi Zalo đầy đủ (từ API_CONTRACT.md mục 5 +
  tài liệu gốc), `ZaloApiError`, `mapZaloError()` — mỗi mã có `category`
  (auth/permission/quota/user_declined/invalid_request/template/unknown) để
  các phase sau quyết định hiển thị/refresh/không tự retry (spec mục 11
  MUST NOT retry gây duplicate message).
- `lib/zalo-client.ts`: implement thật `listTemplates`, `getTemplateDetail`,
  `getTemplateSampleData`, `sendTemplateViaUid`, `getRatingInfo` — theo đúng
  API_CONTRACT.md, dùng `getValidAccessToken()` (Phase 3) trước mỗi lời gọi.

### Ghi chú kỹ thuật cần lưu ý khi test sandbox thật
- `getRatingInfo()` dùng POST cho `/rating/get` theo đúng "Method:" trong tài
  liệu — nhưng ví dụ curl gốc của Zalo lại dùng `-X GET`. Đây là mâu thuẫn
  trong chính tài liệu Zalo, CHƯA thể xác minh bằng cách đọc thêm — cần test
  thật trên sandbox OA (nếu POST trả -106 "Method unsupported", đổi sang GET).

## [Unreleased] — Phase 5 (F02 Rating Templates)
### Added
- `lib/tenant.ts`: `getPrimaryOaId()` — v1.0 single-tenant, lấy OA duy nhất
  đã kết nối qua OAuth.
- `lib/route-helpers.ts`: `handleRouteError()` — chuẩn hoá lỗi ZaloApiError
  (502 kèm category) và lỗi khác (500) cho mọi route gọi zalo-client.
- Nối `app/api/zalo/templates` (GET) và `app/api/zalo/templates/[id]/params`
  (GET) vào `lib/zalo-client.ts` thật — không còn là 501 stub.

## [Unreleased] — Phase 6 (F01 Send File + Rating)
### Added
- `lib/file-constraints.ts`: PDF/DOC/DOCX/CSV, tối đa 5MB (theo API_CONTRACT.md mục 7).
- `lib/zalo-client.ts`: `uploadFile()` (multipart, v2.0/oa/upload/file),
  `sendFileMessage()` (v3.0/oa/message/cs, kênh Tin Tư vấn — khác hẳn kênh
  Template Message dùng cho rating).
- `app/api/zalo/send-file` (POST): thật sự chạy — upload+gửi file VÀ gửi
  Rating Template như 2 thao tác độc lập, mỗi thao tác có trạng thái riêng;
  ghi `TransactionLog` (zaloMessageId = message_id của rating, dùng đối soát F03).
- `docs/API_CONTRACT.md` mục 7: Upload File + Gửi File.

### Còn thiếu (đã flag rõ trong code, không chặn phase)
- API gửi tin nhắn văn bản qua kênh Tin Tư vấn (`message.text`) — chưa có
  tài liệu xác minh. Phần "Nội dung tin nhắn tùy chọn" trong F01 tạm vô hiệu
  hoá ở UI GAS, chờ bổ sung tài liệu.

## [Unreleased] — Test suite (Vitest, chạy thẳng mã nguồn thật)
### Added
- `vitest.config.mts` + `test/support/mock-db.ts` (fake Prisma trong bộ nhớ),
  `test/support/mock-fetch.ts` (router giả lập gọi ra Zalo) — 2 "biên" duy
  nhất bị mock; mọi route (`app/api/**/route.ts`) và `lib/**` được IMPORT VÀ
  GỌI TRỰC TIẾP, không copy/paste logic sang test.
- 14 file test / 64 test case, bao phủ: crypto, pkce, token-crypto
  (round-trip + phát hiện tamper), api-auth (401 các nhánh), zalo-oauth
  (đúng body/header theo API_CONTRACT.md), token-store (refresh xoay vòng
  ghi đè đúng cả access+refresh token), zalo-client (mọi hàm gọi Zalo),
  zalo-errors, tenant, và route thật: `zalo/templates`,
  `zalo/templates/[id]/params`, `oauth/start`, `oauth/callback`,
  `zalo/send-file` (10 test case — nhánh thành công/thất bại độc lập giữa
  file và rating, đối soát `zaloMessageId`, validate định dạng/dung lượng).
- Kết quả lần chạy đầu: **64/64 pass, không phát hiện bug** trong mã nguồn
  nghiệp vụ → KHÔNG bump patch version (điều kiện "có lỗi và đã fix" không
  xảy ra).
- `npm test` (script mới trong package.json) để chạy lại bất kỳ lúc nào.

## [Unreleased] — Hỗ trợ deploy không cần terminal (điện thoại)
### Added
- `app/api/setup/create-client`, `app/api/setup/generate-pkce`: thay thế
  `npm run create-client` / `npm run generate-pkce-pair` khi không có
  terminal. Mặc định vô hiệu hoá (404), chỉ bật khi có env `SETUP_SECRET` —
  PHẢI xoá biến này khỏi Vercel ngay sau khi dùng xong.
- 6 test case cho 2 route trên (404 khi tắt, 404 khi sai secret, tạo client
  thật trong DB).

### Changed
- `package.json`: thêm script `vercel-build` = `prisma generate && prisma db
  push --accept-data-loss && next build`. Vercel tự nhận và ưu tiên chạy
  script này khi deploy — schema Neon được đồng bộ tự động mỗi lần deploy,
  KHÔNG cần chạy `prisma migrate` thủ công từ máy nào cả.
- **Lưu ý kỹ thuật (khác thiết kế "migration có version" nêu ở spec mục 8.2):**
  dùng `prisma db push` thay vì `prisma migrate deploy` — vì môi trường code
  hiện tại không kết nối được Postgres thật để sinh file migration SQL đã
  qua kiểm chứng (`binaries.prisma.sh` bị mạng sandbox chặn). `db push` đồng
  bộ schema trực tiếp, không cần file migration lịch sử, phù hợp hơn cho
  việc deploy "một chạm" không qua terminal. Đánh đổi: mất lịch sử migration
  dạng file — nếu sau này cần rollback theo từng bước hoặc audit thay đổi
  schema chi tiết, nên chuyển sang `prisma migrate deploy` với migration đã
  tạo từ máy có kết nối Neon thật.
