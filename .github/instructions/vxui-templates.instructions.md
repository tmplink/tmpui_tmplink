---
description: "Use when editing VXUI HTML templates (filelist.html, direct.html, ai.html, etc.). Covers template conventions, icon usage, event binding, permission controls, and i18n markup."
applyTo: "tpl/vxui/**"
---
# VXUI 模板规范

## 事件绑定
- 直接写在 HTML 属性中：`onclick="VX_FILELIST.method()"` 或 `onclick="VX_DIRECT.method()"`
- 阻止冒泡：`onclick="event.stopPropagation(); VX_XXX.method()"`

## i18n 翻译标记
- VXUI 模板使用 `data-tpl="key"` 属性：`<span data-tpl="on_select_download">下载</span>`
- 旧模板使用 `i18n="key"` 属性

## 图标
- 使用 Iconpark：`<iconpark-icon name="icon-name"></iconpark-icon>`
- 选择或替换图标前，先到 `plugin/icon/lib.js` 查找仓库内实际可用的 icon 名称，不要凭空猜测 name
- 常用图标参考：
	- `cloud-arrow-up`（上传）
	- `cloud-arrow-down`（下载）
	- `folder-plus`（新建文件夹）
	- `folder-open-e1ad2j7l`（文件夹/目录）
	- `copy`（复制）
	- `trash`（删除）
	- `share-from-square`（分享/外链）
	- `link`（链接/直链）
	- `rotate`（刷新）
	- `circle-check`（成功/确认）
	- `circle-xmark`（关闭/取消）
	- `circle-exclamation`（警告/提示）
	- `bars`（菜单）

## 权限控制
- `data-auth="logged-in"` — 仅登录用户可见
- `data-owner="true"` — 仅文件所有者可见

## CSS 类名
- 按钮：`vx-btn`、`vx-btn-ghost`、`vx-btn-primary`
- 危险操作：添加 `vx-text-danger` 类
- 弹窗：`vx-modal`、`vx-modal-overlay`、`vx-modal-content`
- 所有 VXUI 类名以 `vx-` 开头
