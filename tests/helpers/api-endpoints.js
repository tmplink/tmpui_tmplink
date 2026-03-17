/**
 * api-endpoints.js — API 端点定义
 * 用于 API 可用性测试。基于 js/core/api.js 的 init_api() 提取。
 */
'use strict';

/**
 * @typedef {Object} ApiEndpoint
 * @property {string} name - 端点名称
 * @property {string} path - 端点路径
 * @property {string} action - 请求 action 参数
 * @property {boolean} requiresToken - 是否需要 api_token
 * @property {function(Object): void} [validate] - 自定义响应校验
 */

/** @type {ApiEndpoint[]} */
const endpoints = [
  {
    name: 'Token Challenge',
    path: '/api_v2/token',
    action: 'challenge',
    requiresToken: false,
    validate: (rsp) => {
      if (!('data' in rsp)) throw new Error('Missing "data" in challenge response');
    },
  },
  {
    name: 'User Details',
    path: '/api_v2/user',
    action: 'get_detail',
    requiresToken: true,
    validate: (rsp) => {
      if (rsp.status !== 1) throw new Error(`Expected status=1, got ${rsp.status}`);
      if (!rsp.data || typeof rsp.data.uid === 'undefined')
        throw new Error('Missing uid in user details');
    },
  },
  {
    name: 'File Count',
    path: '/api_v2/file',
    action: 'my_file_count',
    requiresToken: true,
    validate: (rsp) => {
      if (![0, 1].includes(rsp.status)) {
        throw new Error(`Expected status to be 0 or 1, got ${rsp.status}`);
      }
    },
  },
  {
    name: 'Meeting Room List',
    path: '/api_v2/meetingroom',
    action: 'list',
    requiresToken: true,
    validate: (rsp) => {
      if (rsp.status !== 1) throw new Error(`Expected status=1, got ${rsp.status}`);
    },
  },
  {
    name: 'Direct Dashboard',
    path: '/api_v2/direct',
    action: 'dashboard',
    requiresToken: true,
    validate: (rsp) => {
      if (![0, 1].includes(rsp.status)) {
        throw new Error(`Expected status to be 0 or 1, got ${rsp.status}`);
      }
    },
  },
  {
    name: 'Notes List',
    path: '/api_v2/notes',
    action: 'list',
    requiresToken: true,
    validate: (rsp) => {
      if (rsp.status !== 1) throw new Error(`Expected status=1, got ${rsp.status}`);
    },
  },
  {
    name: 'AI History',
    path: '/api_v2/ai',
    action: 'history',
    requiresToken: true,
    validate: (rsp) => {
      if (rsp.status !== 1) throw new Error(`Expected status=1, got ${rsp.status}`);
    },
  },
  {
    name: 'Shop Products',
    path: '/api_v2/shop',
    action: 'products',
    requiresToken: true,
    validate: (rsp) => {
      if (![0, 1].includes(rsp.status)) {
        throw new Error(`Expected status to be 0 or 1, got ${rsp.status}`);
      }
    },
  },
  {
    name: 'Global File Search',
    path: '/api_v2/meetingroom',
    action: 'search',
    requiresToken: true,
    // search 为必填项，空字符串时服务端返回 status=1 且 data=[]
    extraBody: { search: '' },
    validate: (rsp) => {
      if (rsp.status !== 1) throw new Error(`Expected status=1, got ${rsp.status}`);
      if (!Array.isArray(rsp.data)) throw new Error('Expected data to be an array');
    },
  },
];

module.exports = { endpoints };
