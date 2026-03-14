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

## VXUI 移动端顶栏统一约束
- 移动端顶栏统一复用 `css/vxui/vxui.css` 的共享样式：`.vx-mob-topbar`、`.vx-mob-topbar-inner`、`.vx-mob-topbar-left/.vx-mob-topbar-right`、`.vx-mob-topbar-title`、`.vx-mob-topbar-btn`。
- 模块 `*-mobile-fix.css` 默认不得覆盖顶栏基线尺寸（padding、按钮宽高、按钮圆角、标题字号、icon 尺寸、间距）。
- 顶栏统一基线：
	- 默认：padding `14px 16px`，按钮 `44x44`，圆角 `16px`，标题字号 `16px`。
	- `@media (max-width: 420px)`：padding `14px 12px`，按钮 `42x42`，圆角 `15px`。
- 模块级覆盖仅允许业务必要项（如标题文本最大宽度、菜单定位、显隐逻辑），不允许为“视觉微调”单独做一套尺寸。
- 若页面高度计算依赖顶栏高度，调整顶栏后必须同步更新对应容器高度表达式。

## 深色模式
- 深色模式全局覆写在 `css/dark.css`
- 不要在 VXUI CSS 中写深色模式逻辑，统一放 `dark.css`

## 常用组件类
- 按钮：`.vx-btn`、`.vx-btn-primary`、`.vx-btn-ghost`
- 文本色彩：`.vx-text-danger`、`.vx-text-success`
- 弹窗：`.vx-modal`、`.vx-modal-overlay`、`.vx-modal-content`、`.vx-modal-title`
- 列表行：`.vx-list-row`
- 选择栏：`.vx-selection-bar`
