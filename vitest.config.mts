import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Test chạy thẳng mã nguồn thật (app/api/**/route.ts, lib/**) — không copy
// logic sang test. Chỉ mock 2 biên ngoài: Prisma (Neon) và global fetch
// (Zalo API) qua test/support/*.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    setupFiles: ['./test/support/setup-env.ts'],
    include: ['test/**/*.test.ts'],
  },
});
