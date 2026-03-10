---
description: "Use when editing VXUI CSS files (filelist.css, direct.css, vxui.css, account.css, mobile-fix). Covers class naming, dark mode, mobile fix pattern, and component styling."
applyTo: "css/vxui/**"
---
# VXUI CSS 规范

## 类名前缀
- 所有 VXUI 类以 `vx-` 开头

## 移动端适配
- 移动端修复放在独立的 `*-mobile-fix.css` 文件
- 例如 `filelist-mobile-fix.css`、`direct-mobile-fix.css`

## 深色模式
- 深色模式全局覆写在 `css/dark.css`
- 不要在 VXUI CSS 中写深色模式逻辑，统一放 `dark.css`

## 常用组件类
- 按钮：`.vx-btn`、`.vx-btn-primary`、`.vx-btn-ghost`
- 文本色彩：`.vx-text-danger`、`.vx-text-success`
- 弹窗：`.vx-modal`、`.vx-modal-overlay`、`.vx-modal-content`、`.vx-modal-title`
- 列表行：`.vx-list-row`
- 选择栏：`.vx-selection-bar`
