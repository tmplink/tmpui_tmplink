/**
 * credentials.setup.js — Playwright globalSetup
 * 交互式询问用户凭据，或复用已保存的凭据
 */
'use strict';

const readline = require('readline');
const { loadCredentials, saveCredentials } = require('../helpers/config');

/**
 * 通过 stdin 提问并获取回答
 * @param {readline.Interface} rl
 * @param {string} question
 * @param {boolean} [hidden] - 是否隐藏输入（密码）
 * @returns {Promise<string>}
 */
function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

/** @param {import('@playwright/test').FullConfig} config */
module.exports = async function globalSetup(config) {
  // 1. 优先检查环境变量（CI 或手动设置）
  if (process.env.TEST_USERNAME && process.env.TEST_PASSWORD && process.env.TEST_NOTES_KEY) {
    console.log('✓ 使用环境变量中的凭据');
    return;
  }

  // 2. 检查已保存的凭据文件
  const saved = loadCredentials();
  if (saved) {
    // 自动模式（CI / TEST_AUTO=1）或非交互环境 — 直接使用
    const isAuto = process.env.TEST_AUTO === '1' || process.env.CI === 'true' || !process.stdin.isTTY;
    if (isAuto) {
      process.env.TEST_USERNAME = saved.username;
      process.env.TEST_PASSWORD = saved.password;
      process.env.TEST_NOTES_KEY = saved.notesKey;
      console.log(`✓ 从 credentials.json 加载凭据（用户: ${saved.username}）`);
      return;
    }
    // 交互环境询问是否复用
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      console.log(`\n检测到已保存的凭据（用户: ${saved.username}）`);
      const reuse = await ask(rl, '是否使用已保存的凭据? [Y/n] ');
      if (!reuse || reuse.toLowerCase() === 'y' || reuse === '') {
        process.env.TEST_USERNAME = saved.username;
        process.env.TEST_PASSWORD = saved.password;
        process.env.TEST_NOTES_KEY = saved.notesKey;
        console.log('✓ 使用已保存的凭据\n');
        return;
      }
    } finally {
      rl.close();
    }
  }

  // 3. 非交互环境且无凭据 — 允许 i18n 等不需要认证的测试继续
  if (!process.stdin.isTTY) {
    console.warn('⚠ 未找到凭据，需要认证的测试将被跳过');
    return;
  }

  // 4. 交互式输入新凭据
  const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log('\n请输入测试凭据:');
    const username = await ask(rl2, '  钛盘用户名 (邮箱): ');
    const password = await ask(rl2, '  密码: ');
    const notesKey = await ask(rl2, '  密记解密密钥: ');

    if (!username || !password || !notesKey) {
      throw new Error('凭据不能为空');
    }

    process.env.TEST_USERNAME = username;
    process.env.TEST_PASSWORD = password;
    process.env.TEST_NOTES_KEY = notesKey;

    saveCredentials({ username, password, notesKey });
    console.log('✓ 凭据已保存到 tests/credentials.json\n');
  } finally {
    rl2.close();
  }
};
