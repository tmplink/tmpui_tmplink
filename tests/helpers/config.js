/**
 * config.js — 凭据管理
 * 读取 tests/credentials.json 或从环境变量获取凭据
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = path.resolve(__dirname, '..', 'credentials.json');

/**
 * 读取已保存的凭据
 * @returns {{ username: string, password: string, notesKey: string } | null}
 */
function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) return null;
  try {
    const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    const cred = JSON.parse(raw);
    if (cred.username && cred.password && cred.notesKey) return cred;
    return null;
  } catch {
    return null;
  }
}

/**
 * 保存凭据到本地文件
 * @param {{ username: string, password: string, notesKey: string }} cred
 */
function saveCredentials(cred) {
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(cred, null, 2), 'utf-8');
}

/**
 * 获取当前凭据（从环境变量）
 * @returns {{ username: string, password: string, notesKey: string }}
 */
function getCredentials() {
  return {
    username: process.env.TEST_USERNAME || '',
    password: process.env.TEST_PASSWORD || '',
    notesKey: process.env.TEST_NOTES_KEY || '',
  };
}

/** 钛盘 API 根地址（不含 /api_v2 后缀） */
const API_BASE = process.env.TEST_API_URL || 'https://tmplink-sec.vxtrans.com';

module.exports = { loadCredentials, saveCredentials, getCredentials, CREDENTIALS_PATH, API_BASE };
