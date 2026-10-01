export const metadata = {
  title: 'Zalo OA Gateway',
  description: 'Backend Gateway – Zalo OA/ZNS/ZBS API',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
