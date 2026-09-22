import { defineConfig, devices } from '@playwright/test';

export function createFrameworkPlaywrightConfig(port: number) {
  const baseURL = `http://127.0.0.1:${port}`;
  return defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    workers: 1,
    timeout: 180_000,
    expect: { timeout: 30_000 },
    reporter: process.env.CI ? [['github'], ['line']] : 'line',
    use: {
      baseURL,
      trace: 'retain-on-failure',
      screenshot: 'only-on-failure'
    },
    projects: [
      {
        name: 'unsupported-chromium',
        testMatch: /unsupported\.spec\.ts/,
        use: { ...devices['Desktop Chrome'] }
      },
      {
        name: 'enabled-user-chrome',
        testMatch: /live\.spec\.ts/
      }
    ],
    webServer: {
      command: 'pnpm dev',
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  });
}
