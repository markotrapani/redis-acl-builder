// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright Configuration for Redis ACL Builder E2E Tests
 *
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './e2e',

  // Maximum time one test can run
  timeout: 30 * 1000,

  // Test files pattern
  testMatch: '**/*.spec.js',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Limit workers to avoid race conditions (reduced from default)
  // Use 1 worker on CI, 2 workers locally for better test isolation
  workers: process.env.CI ? 1 : 2,

  // Reporter to use
  reporter: 'html',

  // Output folders - keep organized in tests directory
  outputDir: './e2e-results',

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:5001',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'cd .. && source venv/bin/activate && python backend/app.py',
    url: 'http://localhost:5001',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    cwd: '../',
  },
});
