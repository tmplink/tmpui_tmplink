// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests/specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 4 : 4,
  reporter: [['html', { open: 'never' }], ['list']],

  globalSetup: path.resolve(__dirname, 'tests/setup/credentials.setup.js'),

  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
    },
  },

  snapshotPathTemplate: 'tests/screenshots/{projectName}/{testFilePath}/{arg}{ext}',

  use: {
    baseURL: 'http://localhost:3939',
    trace: 'on-first-retry',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  webServer: {
    command: 'npx serve . --listen 3939 --no-clipboard',
    port: 3939,
    reuseExistingServer: true,
    timeout: 10000,
  },

  projects: [
    // --- Standalone: i18n (no browser, no auth needed) ---
    {
      name: 'i18n',
      testMatch: /i18n\.spec\.js/,
    },

    // --- Setup: login and save auth state ---
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.js/,
      testDir: './tests/setup',
    },

    // --- API tests (needs auth) ---
    {
      name: 'api',
      testMatch: /api\.spec\.js/,
      dependencies: ['auth-setup'],
    },

    // --- Uploader checks (desktop) ---
    {
      name: 'uploader-desktop',
      testMatch: /uploader\.spec\.js/,
      use: {
        viewport: { width: 1440, height: 900 },
        storageState: 'tests/.auth/state.json',
      },
      dependencies: ['auth-setup'],
    },

    // --- Global Search functional tests (desktop + mobile) ---
    {
      name: 'global-search-desktop',
      testMatch: /global-search\.spec\.js/,
      use: {
        viewport: { width: 1440, height: 900 },
        storageState: 'tests/.auth/state.json',
      },
      dependencies: ['auth-setup'],
    },
    {
      name: 'global-search-mobile',
      testMatch: /global-search\.spec\.js/,
      use: {
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        storageState: 'tests/.auth/state.json',
      },
      dependencies: ['auth-setup'],
    },

    // --- Share Copy functional tests (desktop + mobile) ---
    {
      name: 'share-copy-desktop',
      testMatch: /share-copy\.spec\.js/,
      use: {
        viewport: { width: 1440, height: 900 },
        storageState: 'tests/.auth/state.json',
      },
      dependencies: ['auth-setup'],
    },
    {
      name: 'share-copy-mobile',
      testMatch: /share-copy\.spec\.js/,
      use: {
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        storageState: 'tests/.auth/state.json',
      },
      dependencies: ['auth-setup'],
    },

    // --- Desktop Light (13" MacBook Air: 1440×900) ---
    {
      name: 'desktop-light',
      testMatch: /ui\.spec\.js/,
      use: {
        viewport: { width: 1440, height: 900 },
        storageState: 'tests/.auth/state.json',
      },
      dependencies: ['auth-setup'],
    },

    // --- Mobile Light (iPhone SE: 375×812) ---
    {
      name: 'mobile-light',
      testMatch: /ui\.spec\.js/,
      use: {
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        storageState: 'tests/.auth/state.json',
      },
      dependencies: ['auth-setup'],
    },

    // --- Desktop Dark ---
    {
      name: 'desktop-dark',
      testMatch: /ui\.spec\.js/,
      use: {
        viewport: { width: 1440, height: 900 },
        colorScheme: 'dark',
        storageState: 'tests/.auth/state.json',
      },
      dependencies: ['auth-setup'],
    },

    // --- Mobile Dark ---
    {
      name: 'mobile-dark',
      testMatch: /ui\.spec\.js/,
      use: {
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        colorScheme: 'dark',
        storageState: 'tests/.auth/state.json',
      },
      dependencies: ['auth-setup'],
    },
  ],
});
