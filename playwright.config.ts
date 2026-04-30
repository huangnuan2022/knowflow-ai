import { defineConfig, devices } from '@playwright/test';

const backendUrl = 'http://127.0.0.1:3100';
const frontendUrl = 'http://127.0.0.1:5174';
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://knowflow:knowflow@localhost:15432/knowflow_test?schema=public';

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  testDir: './test/acceptance',
  timeout: 60_000,
  use: {
    baseURL: frontendUrl,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run start',
      env: envWith({
        AI_MODEL: 'stub-tutor-v0',
        AI_PROVIDER: 'stub',
        CORS_ORIGIN: frontendUrl,
        DATABASE_URL: testDatabaseUrl,
        OPENAI_API_KEY: '',
        PORT: '3100',
      }),
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      url: `${backendUrl}/api/health`,
    },
    {
      command: 'npm run dev --prefix frontend -- --host 127.0.0.1 --port 5174',
      env: envWith({
        VITE_API_BASE_URL: `${backendUrl}/api`,
      }),
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      url: frontendUrl,
    },
  ],
  workers: 1,
});

function envWith(overrides: Record<string, string>) {
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ),
    ...overrides,
  };
}
