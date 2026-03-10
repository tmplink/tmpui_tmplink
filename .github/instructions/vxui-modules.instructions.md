---
description: "Use when editing VXUI JavaScript modules (vxui-filelist, vxui-uploader, vxui-direct, vxui-core, etc.). Covers module patterns, API conventions, state management, and i18n usage in the VXUI framework."
applyTo: "js/vxui/**"
---
# VXUI 模块开发规范

## 模块结构
- 每个模块是一个全局单例对象：`var VX_XXX = VX_XXX || { ... }`
- 模块通过 `init()` 方法初始化，由 `js/init/init_vx_*.js` 调用
- 模块状态直接挂在对象属性上，不使用 class

## 编码要点
- 翻译：`this.t('key', '中文默认值')` 或 `this.fmt('key', { count: n }, '默认文本')`
- UI 行为追踪：`this.trackUI('vui_module[action_name]')`
- Toast：`VXUI.toastSuccess(msg)` / `VXUI.toastWarning(msg)` / `VXUI.toastError(msg)`
- 剪贴板：`VXUI.copyToClipboard(text)`
- API 调用：使用 `$.post(apiUrl, params, callback, 'json')`，apiUrl 从 `TL.api_mr` 等获取
- Token：`this.getToken()` 获取认证 token
- 安全编码：用户输入必须转义，URL 参数使用 `encodeURIComponent()`

## 关键全局变量
- `TL` — tmplink 实例（API 地址、站点配置）
- `app` — tmpUI 实例（languageData、路由）
- `VXUI` — VXUI 核心（Toast、工具方法）

## 文件对应关系
- `vxui-filelist.js` ↔ `tpl/vxui/filelist.html` + `css/vxui/filelist.css`
- `vxui-direct.js` ↔ `tpl/vxui/direct.html` + `css/vxui/direct.css`
- `vxui-account.js` ↔ `tpl/vxui/profile.html` + `tpl/vxui/settings.html` + `css/vxui/account.css`
- `vxui-ai.js` ↔ `tpl/vxui/ai.html`
- `vxui-notes.js` ↔ `tpl/vxui/notes.html`
- `vxui-shop.js` ↔ `tpl/vxui/shop.html`
