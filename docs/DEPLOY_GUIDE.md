# DEPLOY_GUIDE.md — zoa-gateway-vercel

Hướng dẫn deploy đầy đủ, không cần terminal/máy tính — làm được hoàn toàn
trên điện thoại (trình duyệt Chrome/Safari). Đọc song song với
`zoa-vote-gas/DEPLOY_GUIDE.md` — 2 phần xen kẽ nhau theo đúng thứ tự dưới đây.

**Phạm vi hiện tại đã code xong:** Foundation, Auth (OAuth), Zalo Client,
F02 (Rating Templates), F01 (Send File + Rating). **Chưa có:** F04
(Follower), F03 (Webhook + Reconcile), F07/F08. Sau khi hoàn tất hướng dẫn
này, bạn dùng được: đăng nhập GAS, kết nối OA, tạo mẫu đánh giá, gửi file +
đánh giá thủ công (nhập UID tay). Chưa theo dõi được khách đã đánh giá hay
chưa (phần đó code ở Phase 8).

## 0. Thông số cần chuẩn bị từ phía Zalo

| Thông số | Lấy ở đâu | Cần cho bước nào |
|---|---|---|
| OA đã tồn tại (Official Account của doanh nghiệp) | Đã có sẵn, hoặc tạo tại oa.zalo.me | Toàn bộ |
| Zalo App đã tạo trên developers.zalo.me | Tự tạo (mục 3 dưới) | Toàn bộ |
| App ID, App Secret Key | App console → Cài đặt | `ZALO_APP_ID`, `ZALO_APP_SECRET` |
| 1 Template "Đánh giá dịch vụ" (template_type=5) đã ENABLE trên OA | Tạo qua giao diện ZBS Account (không qua API — xem API_CONTRACT.md mục 3.5) | Dùng khi tạo mẫu ở F02 |
| Domain đã xác thực | App console → Xác thực domain | Bắt buộc trước khi khai báo Callback URL |

Chưa cần: Webhook URL / OA Secret Key (F03 chưa code, để sau).

## 1. Đưa code lên GitHub (điện thoại)

1. Giải nén file `zoa-gateway-vercel.zip` bằng ứng dụng quản lý file có sẵn
   trên máy (Android: "Files"/trình quản lý file mặc định; iOS: app "Files"
   → chạm giữ file zip → "Giải nén").
2. Mở github.com bằng trình duyệt, đăng nhập (tạo tài khoản nếu chưa có).
3. Bấm **+** góc trên → **New repository** → đặt tên `zoa-gateway-vercel` →
   **Create repository**.
4. Trong repo vừa tạo, bấm **Add file → Upload files**. Chọn TOÀN BỘ file
   và thư mục đã giải nén (trình duyệt di động thường cho chọn nhiều file
   cùng lúc; nếu không kéo được cả thư mục con, upload từng thư mục một —
   `app/`, `lib/`, `prisma/`, `docs/`, `scripts/`, rồi các file gốc).
5. Bấm **Commit changes**.

## 2. Tạo Neon Postgres + Deploy trên Vercel

1. Mở vercel.com bằng trình duyệt → đăng nhập bằng tài khoản GitHub vừa dùng.
2. **Add New → Project** → chọn repo `zoa-gateway-vercel` vừa đẩy lên →
   **Import**.
3. **CHƯA bấm Deploy vội** — cuộn xuống mục Environment Variables, thêm các
   biến (giá trị `ZALO_APP_ID`/`ZALO_APP_SECRET` lấy ở bước 3 bên dưới, có
   thể điền tạm rồi sửa lại sau):

   | Tên biến | Giá trị |
   |---|---|
   | `ZALO_APP_ID` | (điền sau khi tạo App ở bước 3) |
   | `ZALO_APP_SECRET` | (điền sau khi tạo App ở bước 3) |
   | `TOKEN_ENCRYPTION_KEY` | gõ bừa 1 chuỗi dài ngẫu nhiên ≥32 ký tự (bàn phím điện thoại gõ loạn cũng được, miễn đủ dài) |
   | `SETUP_SECRET` | 1 chuỗi ngẫu nhiên khác, tự đặt, nhớ để dùng ở bước 4 |
   | `OAUTH_CALLBACK_URL` | để tạm `https://placeholder.vercel.app/api/oauth/callback` — QUAY LẠI SỬA ở bước 3.4 khi đã biết domain thật |
   | `ZALO_OAUTH_CODE_VERIFIER` | để tạm trống — điền ở bước 4 |
   | `CRON_SECRET` | 1 chuỗi ngẫu nhiên bất kỳ (chưa dùng tới, để sẵn) |

4. Trước khi bấm Deploy: vào tab **Storage** trong Vercel (hoặc mục Marketplace
   ngay trong màn hình tạo project) → **Create Database → Neon (Postgres)** →
   làm theo hướng dẫn (miễn phí) → Vercel tự động thêm biến `DATABASE_URL`
   vào project, bạn không cần tự nhập.
5. Bấm **Deploy**. Vercel sẽ tự chạy `npm install` → `prisma generate` →
   `prisma db push` (tự tạo bảng trong Neon) → `next build` — không cần bạn
   chạy lệnh gì cả.
6. Sau khi deploy xong, Vercel cho 1 domain dạng
   `https://zoa-gateway-vercel-xxxx.vercel.app`. **Copy domain này lại.**
7. Vào **Settings → Environment Variables**, sửa `OAUTH_CALLBACK_URL` thành
   `https://<domain-thật-của-bạn>/api/oauth/callback`, **Save**, rồi vào tab
   **Deployments** → bấm vào bản deploy mới nhất → nút **Redeploy** để áp
   dụng biến vừa sửa.

## 3. Tạo Zalo App (nếu chưa có)

1. Mở developers.zalo.me bằng trình duyệt điện thoại, đăng nhập.
2. **Tạo ứng dụng mới** (chọn loại phù hợp, vd "Ứng dụng cho doanh nghiệp"/
   OA OpenAPI tuỳ giao diện hiện tại) → điền tên, mô tả, danh mục.
3. Vào **Cài đặt** của App vừa tạo → copy **ID ứng dụng** và **Khóa bí mật**
   → dán vào Vercel Environment Variables (`ZALO_APP_ID`, `ZALO_APP_SECRET`)
   → **Save** → Redeploy (như bước 2.7).
4. Vào **Xác thực domain** → làm theo hướng dẫn xác thực domain Vercel của
   bạn (thường là thêm 1 file hoặc thẻ meta — làm được từ điện thoại vì chỉ
   cần Vercel cho phép bạn thêm route tĩnh, hoặc dùng phương thức DNS nếu
   bạn có domain riêng; nếu vướng bước này, đây là điểm cần hỏi thêm).

## 4. Lấy Gateway API key + cặp PKCE (không cần terminal)

Mở 2 đường dẫn sau bằng trình duyệt điện thoại (thay `<domain>` = domain
Vercel thật, `<SETUP_SECRET>` = giá trị bạn đặt ở bước 2.3):

```
https://<domain>/api/setup/create-client?name=zoa-vote-gas&secret=<SETUP_SECRET>
```
→ Trang hiện ra 1 API key — **copy lại**, dùng ở bước cài GAS (mục
`zoa-vote-gas/DEPLOY_GUIDE.md`).

```
https://<domain>/api/setup/generate-pkce?secret=<SETUP_SECRET>
```
→ Trang hiện `code_verifier` (dán vào Vercel env `ZALO_OAUTH_CODE_VERIFIER`,
Save, Redeploy) và `code_challenge` (dán vào form "Thiết lập đường dẫn yêu
cầu cấp quyền" trong Zalo App console cùng với Callback URL đã xác thực).

**Xong 2 bước trên: vào Vercel Environment Variables, XOÁ biến
`SETUP_SECRET`, Save, Redeploy.** Nếu không xoá, ai biết được URL + secret
này cũng tự tạo thêm API key gọi vào Gateway của bạn.

## 5. Kiểm tra nhanh

Mở `https://<domain>/` trên trình duyệt — thấy trang giới thiệu Gateway là
deploy thành công. `https://<domain>/api/zalo/templates` sẽ báo lỗi 401
(đúng — vì bạn chưa gắn API key vào request, đây là bảo vệ hoạt động đúng).

Bước tiếp theo: sang `zoa-vote-gas/docs/DEPLOY_GUIDE.md` để dựng GAS Web
App, kết nối OA, rồi quay lại kiểm tra toàn luồng.
