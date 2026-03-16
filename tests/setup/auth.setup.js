/**
 * auth.setup.js — Playwright setup project
 * 在浏览器中通过 API 登录，保存 storageState 供后续测试复用
 */
// @ts-check
const { test: setup, expect } = require('@playwright/test');
const path = require('path');
const { API_BASE } = require('../helpers/config');

const AUTH_FILE = path.resolve(__dirname, '..', '.auth', 'state.json');

setup('authenticate', async ({ page, baseURL }) => {
  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;
  const notesKey = process.env.TEST_NOTES_KEY;

  if (!username || !password) {
    console.warn('⚠ 缺少凭据，跳过认证 setup（i18n 测试可单独运行）');
    // 创建一个空的 state 文件，避免依赖此 setup 的 project 报错找不到文件
    const fs = require('fs');
    const authDir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }
    if (!fs.existsSync(AUTH_FILE)) {
      fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
    }
    return;
  }

  // 方案: 通过 API 直接登录（绕过 reCAPTCHA 界面交互）
  // 1. 获取 challenge token
  const challengeResponse = await page.request.post(`${API_BASE}/api_v2/token`, {
    form: { action: 'challenge' },
  });
  const challengeData = await challengeResponse.json();
  const captchaToken = challengeData.data || '';

  // 2. 获取初始 API token
  const tokenResponse = await page.request.post(`${API_BASE}/api_v2/token`, {
    form: {
      action: 'token',
      captcha: captchaToken,
      token: '',
    },
  });
  const tokenData = await tokenResponse.json();
  const apiToken = tokenData.data;
  if (!apiToken) {
    throw new Error('无法获取 API token: ' + JSON.stringify(tokenData));
  }

  // 3. 登录
  const loginResponse = await page.request.post(`${API_BASE}/api_v2/user`, {
    form: {
      action: 'login',
      token: apiToken,
      captcha: captchaToken,
      email: username,
      password: password,
    },
  });
  const loginData = await loginResponse.json();
  if (loginData.status !== 1) {
    throw new Error('登录失败: ' + JSON.stringify(loginData));
  }

  // 4. 在浏览器中设置 localStorage，模拟已登录状态
  await page.goto(baseURL + '/');
  await page.evaluate(
    ({ token, notesKey }) => {
      localStorage.setItem('app_token', token);
      localStorage.setItem('app_login', '1');
      if (notesKey) {
        localStorage.setItem('NotesKey', notesKey);
      }
    },
    { token: apiToken, notesKey: notesKey || '' }
  );

  // 5. 保存 storageState
  const fs = require('fs');
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
  await page.context().storageState({ path: AUTH_FILE });
  console.log('✓ 认证完成，storageState 已保存');
});
