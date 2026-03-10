# 钛盘 (tmplink) — 项目指南

## 项目概述

钛盘是一个基于 **tmpUI** 框架的网盘/文件分享 Web 应用，支持文件上传下载、在线播放、直链管理、加密密记、AI 助手、商城等功能。前端为纯静态 SPA，**无构建工具、无包管理器、无转译**——所有代码直接在浏览器运行。

## 核心约束

### 禁止修改的文件
- **`tmpui.js`** — SPA 路由/模板/i18n 核心框架，视为只读库
- **`tmpui.txt`** — 框架文档
- **`plugin/`** — 第三方插件（Bootstrap 4.6、ApexCharts、CryptoJS、Iconpark 等）
- **`js/tools/`** — jQuery、Clipboard.js、SHA1、QRCode 等工具库

### 运行与调试
- 代码通过其它工具手动运行，**不要在终端执行启动服务器或构建命令**
- 不需要执行 `npm`、`yarn`、`webpack` 等命令

## 架构概览

### 两套 UI 体系

| 体系 | 目录 | 状态 |
|------|------|------|
| **VXUI**（新） | `js/vxui/`、`css/vxui/`、`tpl/vxui/` | ✅ 活跃开发，新功能写这里 |
| **Listview**（旧） | `tpl/listview/`、`js/core/` 部分 | ⚠️ 保留状态，仅参考业务逻辑 |

**新功能一律使用 VXUI 体系。**

### 目录结构

```
index.html              # 入口，初始化 tmpUI 实例
tmpui.js                # SPA 框架（只读）
js/
  init/                 # 页面初始化器（init_vx*.js = VXUI, init_*.js = 旧）
  core/                 # 核心模块（API、上传、下载、工具类）
  vxui/                 # VXUI 模块（11 个模块，全局单例对象）
tpl/
  vxui/                 # VXUI HTML 模板
  listview/             # 旧版模板（保留参考）
  include/              # 公用片段（导航、页脚、弹窗）
css/
  vxui/                 # VXUI 样式
json/                   # i18n（cn/en/hk/jp）
plugin/                 # 第三方库
```

### VXUI 模块清单

| 全局对象 | 文件 | 功能 |
|----------|------|------|
| `VXUI` | `vxui-core.js` | 框架核心、Toast、i18n 兼容层 |
| `VX_FILELIST` | `vxui-filelist.js` | 文件列表/相册视图、拖放上传、右键菜单 |
| `VX_UPLOADER` | `vxui-uploader.js` | 上传队列（80MB 分片，最多 10 并发） |
| `VX_DOWNLOAD` | `vxui-download.js` | 批量下载（8MB 分片，3 线程） |
| `VX_DIRECT` | `vxui-direct.js` | 直链管理、自定义域名、流量分析 |
| `VX_AI` | `vxui-ai.js` | AI 聊天（智能小薇） |
| `VX_NOTES` | `vxui-notes.js` | 加密密记（AES 客户端加密） |
| `VX_SHOP` | `vxui-shop.js` | 商城/购买流程 |
| `VX_ACCOUNT` | `vxui-account.js` | 账户设置、OAuth |
| `VxSort` | `vxui-sort.js` | 通用排序管理器 |
| `VX_POINTS` | `vxui-points.js` | 分享奖励/点数 |

### 两套 API 层

- **`js/core/tmplink.js`**（`tmplink` 类） — 完整业务逻辑封装，旧代码使用
- **`js/core/api.js`**（`tmplink_api` 类） — 轻量 HTTP 封装，VXUI 模块使用

## 编码规范

### JavaScript
- 使用 `'use strict'`
- VXUI 模块声明为全局对象：`var VX_XXX = VX_XXX || { ... }`
- 翻译通过 `this.t(key, fallback)` 获取（VXUI 模块内）
- 跟踪 UI 行为通过 `this.trackUI('vui_module[action]')`
- HTML 中用 `data-tpl="key"` 或 `i18n="key"` 标记待翻译元素
- 剪贴板操作统一使用 `VXUI.copyToClipboard(text)`
- Toast 提示使用 `VXUI.toastSuccess/toastWarning/toastError(msg)`

### CSS
- VXUI 样式以 `vx-` 为类名前缀
- 移动端修复放入 `*-mobile-fix.css`
- 深色模式通过 `css/dark.css` 控制

### 模板
- VXUI 模板放入 `tpl/vxui/`
- 使用 Iconpark 图标：`<iconpark-icon name="xxx"></iconpark-icon>`
- 事件绑定直接写在 HTML 属性中：`onclick="VX_XXX.method()"`
- 权限控制用 `data-auth="logged-in"` 和 `data-owner="true"` 属性

### i18n
- 新增文案需同步更新 `json/cn.json`、`json/en.json`、`json/hk.json`、`json/jp.json`
- 键名使用小写下划线命名

## 常见任务模式

### 新增 VXUI 功能
1. 在 `js/vxui/vxui-xxx.js` 添加方法
2. 在 `tpl/vxui/xxx.html` 添加对应 UI
3. 如需样式，修改 `css/vxui/xxx.css`
4. 如需新翻译，更新 4 个 `json/*.json`

### 修改批量操作栏
- 操作栏 HTML 位于 `tpl/vxui/filelist.html`（搜索 `vx-selection-bar`）
- 对应逻辑在 `js/vxui/vxui-filelist.js`

### 修复 Bug
- 先确认是 VXUI 还是旧版代码的问题
- VXUI → `js/vxui/` + `tpl/vxui/`
- 旧版 → `js/core/` + `tpl/listview/`

## 总结与版本说明

### 当用户要求总结时
- 如果用户要求“提供总结”、“总结改动”、“整理更新说明”、“写版本变更说明”等内容，先读取最近的 git 提交及其实际改动，再生成总结。
- 默认以最近一次 git 提交为基础；如果用户指定了多个提交、某个范围或某个分支差异，则按用户指定范围读取。
- 总结默认面向用户输出，而不是面向开发者输出。

### 输出风格
- 用简短、易懂、非技术化的表达方式。
- 优先描述用户可感知的变化，例如功能新增、交互优化、问题修复、体验提升。
- 不要默认按文件名或函数名罗列改动，避免写成开发日志。
- 如果需要，可整理成类似“本次更新”或“版本变更说明”的短说明。
- 只有用户明确要求技术细节时，再补充涉及的模块、文件或实现方式。

### 透明性
- 如果总结是基于最近一次提交生成，需按这个前提组织内容。
- 如果提交信息不足以支撑可靠总结，应结合提交 diff 提炼，不要只复述 commit message。
