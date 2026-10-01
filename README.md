# OAvote — Vercel + Supabase

OAvote là web app full-stack Next.js triển khai trên Vercel, dùng Supabase Auth (Google), PostgreSQL và private Storage. Ứng dụng phục vụ một Zalo OA duy nhất: user upload file tạm, chọn ZBS Vote template, gửi tới Zalo UID và theo dõi transaction log.

## Trạng thái

Repository này được chuyển từ gateway GAS/Neon scaffold sang baseline Vercel + Supabase. Tài liệu kiến trúc, RBAC, schema, API contract và flow nằm tại `docs/ARCHITECTURE_SUPABASE.md`. Migration production nằm tại `supabase/migrations/`.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Google provider được bật trong Supabase Auth dashboard; không commit `.env.local` hoặc secret.

## Deployment

- GitHub: `iamkeu/zoa-gw`, branch `main`.
- Vercel: project `zoa-gw`, production domain `https://zoa-gw.vercel.app`.
- Supabase: project `oavote`.
- Supabase Auth redirect URL: `https://zoa-gw.vercel.app/auth/callback`.
- Zalo OAuth callback URL: `https://zoa-gw.vercel.app/api/zalo/oauth/callback`.
- Cần cấu hình Google OAuth redirect URL và Zalo secrets trước khi bật production send.
