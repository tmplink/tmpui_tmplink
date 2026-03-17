/**
 * api.spec.js — API 可用性测试
 * 对 8 个主要 API 端点进行基本可用性检查
 */
// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { endpoints } = require('../helpers/api-endpoints');
const { API_BASE } = require('../helpers/config');

const AUTH_FILE = path.resolve(__dirname, '..', '.auth', 'state.json');

/** 从 storageState 文件中提取 api_token */
function getApiToken() {
  if (!fs.existsSync(AUTH_FILE)) {
    throw new Error('认证文件不存在，请先运行 auth setup');
  }
  const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
  const origins = state.origins || [];
  for (const origin of origins) {
    const storage = origin.localStorage || [];
    for (const item of storage) {
      if (item.name === 'app_token') return item.value;
    }
  }
  throw new Error('未在 storageState 中找到 app_token');
}

test.describe('API 可用性检查', () => {
  /** @type {string} */
  let apiToken;

  test.beforeAll(() => {
    apiToken = getApiToken();
  });

  for (const endpoint of endpoints) {
    test(`${endpoint.name} (${endpoint.path} → ${endpoint.action})`, async ({ request }) => {
      const formData = { action: endpoint.action };
      if (endpoint.requiresToken) {
        formData.token = apiToken;
      }
      if (endpoint.extraBody) {
        Object.assign(formData, endpoint.extraBody);
      }

      const response = await request.post(API_BASE + endpoint.path, {
        form: formData,
      });

      // HTTP 状态码
      expect(response.status(), `${endpoint.name}: HTTP 状态码应为 200`).toBe(200);

      // 响应为 JSON
      const contentType = response.headers()['content-type'] || '';
      expect(
        contentType.includes('json'),
        `${endpoint.name}: Content-Type 应包含 json，实际为 "${contentType}"`
      ).toBe(true);

      // 响应体解析
      const body = await response.json();
      expect(body, `${endpoint.name}: 响应体不应为空`).toBeTruthy();

      // 自定义校验
      if (endpoint.validate) {
        try {
          endpoint.validate(body);
        } catch (e) {
          expect(null, `${endpoint.name}: 校验失败 — ${e.message}`).toBeTruthy();
        }
      }
    });
  }
});
