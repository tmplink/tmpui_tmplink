/**
 * console-allowlist.js — 可忽略的 console 消息模式
 * 匹配这些模式的 console.error / console.warn 不会导致测试失败
 */
'use strict';

/** @type {RegExp[]} */
const allowlist = [
  /\[init_vx\]/,
  /\[init_auth\]/,
  /\[VXUI\]\s*Module container not found/i,
  /templateEngine::Element not found with id:\s*upload_servers_opt_tpl/i,
  /favicon\.ico/i,
  /recaptcha/i,
  /google.*analytics/i,
  /gtag/i,
  /service[\s._-]?worker/i,
  /pwa_sw\.js/i,
  /Failed to load resource.*404/i,
  /app\.webmanifest/i,
  /net::ERR_/i,
  /the server responded with a status of 4\d\d/i,
  /api_v2/i,
];

/**
 * 检查一条 console 消息是否在白名单中
 * @param {string} text
 * @returns {boolean}
 */
function isAllowed(text) {
  return allowlist.some((pattern) => pattern.test(text));
}

module.exports = { allowlist, isAllowed };
