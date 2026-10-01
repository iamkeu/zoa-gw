# ZOA.vote / Zalo OA Gateway — API_CONTRACT.md

**Trạng thái:** API Verification Gate (spec mục 13) — hoàn tất phần kỹ thuật.
**Nguồn:** Tài liệu chính thức developers.zalo.me, xác minh trực tiếp qua bản sao người dùng cung cấp (không suy đoán endpoint/field).
**Lưu ý quan trọng:** ZNS API (cũ) đã ngừng cập nhật, hợp nhất vào **ZBS Template Message** từ 01/01/2026. Toàn bộ endpoint dưới đây dùng ZBS Template Message làm nguồn duy nhất.

---

## 1. OAuth — lấy & làm mới OA Access Token

**Endpoint (dùng chung cho lấy mới lẫn refresh):**
```
POST https://oauth.zaloapp.com/v4/oa/access_token
Content-Type: application/x-www-form-urlencoded
Header: secret_key: <app_secret>
```

**Lấy mới (grant_type=authorization_code):**
| Field | Giá trị |
|---|---|
| code | authorization code nhận từ callback |
| app_id | ID ứng dụng |
| grant_type | `authorization_code` |
| code_verifier | PKCE verifier đã dùng để tạo code_challenge |

**Refresh (grant_type=refresh_token):**
| Field | Giá trị |
|---|---|
| refresh_token | refresh token hiện có |
| app_id | ID ứng dụng |
| grant_type | `refresh_token` |

**Response (cả 2 trường hợp):**
```json
{ "access_token": "...", "refresh_token": "...", "expires_in": "90000" }
```

**PKCE:** `code_verifier` = chuỗi ngẫu nhiên 43 ký tự (hoa/thường/số) → `code_challenge = Base64URL(SHA-256(code_verifier))` (không padding).

**URL cấp quyền (OA admin bấm "Cấp quyền"):**
```
https://oauth.zaloapp.com/v4/oa/permission?app_id=<APP_ID>&redirect_uri=<CALLBACK_URL>
```
Callback nhận `GET <redirect_uri>?code=<CODE>&oa_id=<OA_ID>`.

**Thời hạn — RỦI RO VẬN HÀNH cần thiết kế đúng:**
| Token | Hiệu lực | Ghi chú |
|---|---|---|
| Authorization code | 10 phút | Dùng 1 lần |
| Access token | 25 giờ | Vercel phải chủ động refresh trước khi hết hạn |
| Refresh token | 3 tháng | **Dùng 1 lần, xoay vòng** — mỗi lần refresh thành công, token cũ bị vô hiệu ngay, hệ thống trả token mới. Nếu Vercel refresh xong nhưng lưu Neon thất bại → toàn bộ chuỗi auth đứt, phải cấp quyền lại từ đầu qua OA admin. **Bắt buộc lưu refresh_token mới theo transaction.** |

**Nhóm quyền tiêu chuẩn có thể xin qua màn hình OAuth consent** (12 nhóm API + tối đa 5 nhóm webhook): Sử dụng ZNS, Gửi tin nhắn, Quản lý thông tin OA, Quản lý thông tin tùy biến người dùng, Quản lý trường thông tin người dùng, Mua sản phẩm dịch vụ OA, Quản lý tin nhắn người dùng, Quản lý Nhóm Chat-GMF, Quản lý cửa hàng/đơn hàng, Quản lý bài viết, Quản lý ads, Gọi thoại; webhook: Nhận sự kiện quản lý gửi ZNS/tin nhắn/người dùng/Nhóm Chat-GMF/cửa hàng.

> ⚠️ **Chưa xác định nguồn cấp quyền:** `Quản lý Message Template` (dùng cho API list/detail/rating template) và `Nhận sự kiện quản lý Message Template` (webhook đánh giá) **không xuất hiện** trong màn hình OAuth consent chuẩn trên. Không phải mục "Đăng ký sử dụng API" (đó chỉ là xác thực domain). Cần xác nhận lại khi thiết lập App/OA/ZBS Account thật lúc deploy — **không chặn việc code, nhưng phải test thật trên sandbox OA trước khi coi webhook đánh giá là đáng tin cậy** (đúng yêu cầu spec mục 13).

---

## 2. Webhook — xác thực chữ ký (áp dụng mọi event)

```
Header: X-ZEvent-Signature
Giá trị: mac = sha256(app_id + <raw_json_body_string> + timestamp + OA_secret_key)
```
`OA_secret_key` cấu hình tại App console → Webhook (có nút Reset). Vercel middleware: tính lại sha256 từ raw body, so khớp — không khớp thì từ chối.

**Cấu hình App console:** Webhook URL, OA Secret Key, Webhook Retry (toggle), bảng "Danh sách sự kiện webhook" — **mỗi event có toggle Tắt/Bật riêng**, phải tìm đúng dòng và bật, không phải "1 URL nhận hết".

### 2.1 Sự kiện đánh giá dịch vụ (F03 — quan trọng nhất)
```json
{
  "event_name": "user_feedback",
  "message": {
    "rating_type": "csat",
    "option": "five_emotions",
    "note": "Tôi rất hài lòng.",
    "rate": 5,
    "submit_time": "1616673095659",
    "msg_id": "7e4c33cfc20b05575c18",
    "feedbacks": ["Nhân viên vui vẻ", "..."],
    "tracking_id": "1956"
  },
  "app_id": "...", "oa_id": "...", "timestamp": "..."
}
```
Quyền: `Nhận sự kiện quản lý Message Template`.

**⚠️ Không có UID khách hàng trong payload này** — chỉ có `msg_id`. TransactionLog **bắt buộc lưu `message_id`** (trả về khi gửi UID, xem mục 4) để đối soát ngược khi webhook/reconcile trả về `msg_id`. `tracking_id` chỉ tồn tại ở luồng gửi qua SĐT — không dùng được cho luồng UID của ZOA.vote.

### 2.2 Sự kiện template khác (không thuộc F01-F08, tham khảo cho tương lai)
- `change_template_status`: `{oa_id, app_id, template_id, status:{prev_status,new_status}, reason, timestamp}`
- `change_template_quality`: `{oa_id, template_id, quality:HIGH/MEDIUM/LOW/UNDEFINED, timestamp}`
- `user_click_response_button` (mẫu phản hồi nhanh, khác mẫu đánh giá): `{event_name, message:{submit_time,button_type,data,tracking_id}, msg_id, app_id, oa_id, timestamp}`

---

## 3. ZBS Template Message API (business.openapi.zalo.me)

Header chung: `access_token: <token>` · Quyền chung: `Quản lý Message Template` (trừ khi ghi khác).

### 3.1 Lấy danh sách Template (F02)
```
GET /template/all?offset=&limit=&status=&filterPreset=1
```
`status`: 1=ENABLE, 2=PENDING_REVIEW, 3=REJECT, 4=DISABLE (bỏ trống = tất cả) · `filterPreset=1` = chỉ template do App này tạo.
```json
{ "data": [{"templateId","templateName","createdTime","status","templateQuality"}], "metadata": {"total": 300} }
```

### 3.2 Chi tiết Template + tham số (F02)
```
GET /template/info/v2?template_id=<ID>
```
```json
{
  "data": {
    "templateId","templateName","status",
    "listParams": [{"name","require","type","maxLength","minLength","acceptNull"}],
    "listButtons": [{"type","title","content"}],
    "timeout","previewUrl","templateQuality",
    "templateTag": "TRANSACTION|CUSTOMER_CARE|PROMOTION",
    "price_sdt","price_uid"
  }
}
```
→ `listParams` chính là dữ liệu lưu vào Sheet `RatingTemplates` (F02).

### 3.3 Dữ liệu mẫu của Template (tham khảo giá trị mặc định)
```
GET /template/sample-data?template_id=<ID>
```

### 3.4 Lấy thông tin đánh giá khách hàng (F03 — reconcile)
```
POST /rating/get?template_id=&from_time=&to_time=&offset=&limit=
```
`from_time`/`to_time`: timestamp millisecond.
```json
{
  "data": { "total": 2, "data": [
    {"rating_type":"csat","option":"five_emotions","note":"...","rate":5,
     "submitDate":"...","msgId":"...","feedbacks":["..."],"trackingId":"..."}
  ]},
  "error": 0
}
```
App chỉ lấy được đánh giá của template do chính App đó tạo hoặc được OA cấp quyền (access_token phải khớp App+OA sở hữu template).

### 3.5 Tạo / Chỉnh sửa Template — KHÔNG dùng trong v1.0
`POST /template/create`, `POST /template/edit` tồn tại nhưng Zalo đang cảnh báo "đang đánh giá lại, khuyến nghị dùng giao diện ZBS Account". Khớp đúng quyết định spec: **ZOA.vote chỉ đọc, không tạo template qua API.**

`template_type`: 1=Tùy chỉnh, 2=Xác thực, 3=Yêu cầu thanh toán, 4=Voucher, **5=Đánh giá dịch vụ** (bắt buộc `tag=2` Customer care).

### 3.6 Upload ảnh (không cần cho v1.0, tham khảo)
```
POST /upload/image  (multipart/form-data, field "file")
```
JPG/PNG, tối đa 500KB, giới hạn 5000 ảnh/tháng/App.

---

## 4. Gửi tin qua UID (F01 — API chính ZOA.vote dùng)

```
POST https://openapi.zalo.me/v3.0/oa/message/template
Header: access_token
Body: { "user_id": "...", "template_id": "...", "template_data": {...} }
```
Quyền: `Gửi tin nhắn` (nằm trong nhóm quyền OAuth chuẩn — **không** thuộc rủi ro ở mục 1).

```json
{ "data": { "message_id": "...", "user_id": "...", "quota": {"quota_type","owner_type","owner_id"} },
  "sent_time": "...", "error": 0, "message": "Success" }
```

**→ Lưu `message_id` vào `TransactionLog.zalo_uid`-row ngay khi gửi thành công** — đây là khóa đối soát duy nhất với webhook/reconcile (mục 2.1, 3.4).

**Lỗi -249 "Template does not support send via UID":** loại trừ template tạo trước 10/12/2025, template Xác thực (OTP), template có component Response, template Journey. **Template đánh giá dịch vụ CÓ hỗ trợ UID.**

---

## 5. Mã lỗi cần map vào `send_file_status` / `send_rating_status`

| Mã | Ý nghĩa | Ghi chú |
|---|---|---|
| -117 | OA/App không có quyền dùng Template này | Kiểm tra App+OA khớp chủ sở hữu template |
| -124 | Access token không hợp lệ | Trigger refresh hoặc yêu cầu cấp quyền lại |
| -120 / -135 / -136 / -138 | OA/App thiếu quyền hoặc chưa liên kết ZBS Account | Cần xử lý ở Settings/User Guide (F05/F08) |
| -144 / -147 | Vượt quota trong ngày | Hiển thị cho người dùng, không tự retry |
| -139 / -140 / -141 | Người dùng từ chối/không đủ điều kiện nhận | Ghi nhận trạng thái, không coi là lỗi hệ thống |

---

## 6. Việc còn mở (không chặn code, xử lý khi deploy thật)

- [ ] Xác nhận luồng cấp quyền `Quản lý Message Template` + `Nhận sự kiện quản lý Message Template` khi có App/OA/ZBS Account thật.
- [ ] Test thật sự kiện `user_feedback` trên sandbox OA (bắt buộc theo spec mục 13, không được chỉ tin vào tài liệu).
- [ ] Xác nhận template đánh giá dịch vụ hiện có của OA (nếu có sẵn) được tạo sau 10/12/2025 — nếu không, cần tạo/clone lại qua ZBS Account để hỗ trợ gửi UID.

---

## 7. Gửi File (F01 — nhánh "Gửi File")

**Bước 1 — Upload file, lấy token:**
```
POST https://openapi.zalo.me/v2.0/oa/upload/file
Header: access_token
Content-Type: multipart/form-data, field "file"
```
Chỉ hỗ trợ **PDF/DOC/DOCX/CSV**, tối đa **5MB**. Quota **5000 request/tháng** (toàn App, không phải theo OA). File lưu trên server Zalo tối đa **7 ngày** — sau đó khách xem lại sẽ thấy "file không còn tồn tại" (cần ghi vào User Guide F08).
```json
{ "data": { "token": "..." }, "error": 0, "message": "Success" }
```

**Bước 2 — Gửi tin đính kèm file (API Tin Tư vấn, KHÁC hẳn API Template Message):**
```
POST https://openapi.zalo.me/v3.0/oa/message/cs
Header: access_token
Body: { "recipient": {"user_id": "..."}, "message": {"attachment": {"type": "file", "payload": {"token": "<token bước 1>"}}} }
```
Quota riêng theo `quota_type` trả về (`reply` trong khung 48h tương tác — miễn phí không giới hạn từ 1/1/2026, `welcome_msg` khi chưa từng tương tác, `sub_quota`/`purchase_quota`/`reward_quota` khi ngoài khung) — **độc lập với quota Template Message**, cần map lỗi/hiển thị riêng cho `send_file_status`.

> ⚠️ **Còn thiếu (không chặn code, cần bổ sung trước khi hoàn thiện tính năng "nội dung tin nhắn tùy chọn" trong F01):** API gửi **tin nhắn văn bản** qua kênh Tin Tư vấn (`message/cs` với `message.text` thay vì `attachment`) — chưa có tài liệu xác minh. Phase 6 tạm để trống phần này, chỉ gửi File + Rating Template.
