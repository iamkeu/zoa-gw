/** @type {import('next').NextConfig} */
const nextConfig = {
  // GAS gọi Vercel qua fetch từ máy chủ (server-to-server), không phải từ browser,
  // nên không cần cấu hình CORS rộng ở đây — chỉ mở đúng những gì cần khi có yêu cầu thật.
  reactStrictMode: true,
  skipTrailingSlashRedirect: true,
};

module.exports = nextConfig;
