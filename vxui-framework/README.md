# VXUI Framework

VXUI Framework 是从现有 VXUI 视觉体系中抽出的独立 UI Foundation。

当前目标：

- 默认视觉节奏对齐 VXUI（侧栏、顶栏、列表、焦点态）。
- 提供通用组件抽象，不绑定钛盘业务语义。
- 不依赖 tmpUI、TL、jQuery。
- 核心不提供多语言能力。

## 当前包含

- 核心运行时：视图注册、hash 路由、主题切换、权限显隐、sidebar 控制。
- 反馈组件：toast、alert、confirm、prompt、modal。
- 通用组件工具：列表、标签页、开关、头部与按钮拼装器。
- 静态展示站：中性 mock 数据，组件化渲染，不带业务预置。
- bridge 示例：仅演示认证和路由同步。

## 目录

- [vxui-framework/js/vxui-framework.js](vxui-framework/js/vxui-framework.js)：核心运行时。
- [vxui-framework/js/vxui-components.js](vxui-framework/js/vxui-components.js)：通用组件拼装工具。
- [vxui-framework/js/vxui-tmpui-bridge.js](vxui-framework/js/vxui-tmpui-bridge.js)：tmpUI 宿主桥接层。
- [vxui-framework/css/vxui-framework.css](vxui-framework/css/vxui-framework.css)：基础设计令牌与核心样式。
- [vxui-framework/css/vxui-showcase.css](vxui-framework/css/vxui-showcase.css)：展示站增强样式。
- [vxui-framework/showcase/index.html](vxui-framework/showcase/index.html)：展示站入口。
- [vxui-framework/showcase/showcase.js](vxui-framework/showcase/showcase.js)：展示站脚本。
- [vxui-framework/example/tmpui-bridge.html](vxui-framework/example/tmpui-bridge.html)：bridge 示例页。

## 最小接入

```html
<link rel="stylesheet" href="./css/vxui-framework.css">
<script src="./plugin/icon/lib.js"></script>
<script src="./js/vxui-framework.js"></script>
```

```javascript
const app = new VXUIFramework({
  root: '#vx-app',
  authProvider: () => ({ loggedIn: true, owner: true, user: { name: 'Owner' } })
});

app.registerViews({
  overview: {
    title: 'Overview',
    render: () => '<section class="vx-card">Hello VXUI</section>'
  }
});

app.setNavigation([
  { view: 'overview', label: 'Overview', icon: 'house' }
]);

app.init();
```

## 核心 API

- registerView(name, config)
- registerViews(map)
- setNavigation(items)
- navigate(name, state)
- setTheme(mode) / cycleTheme()
- refreshAuth()
- toastSuccess / toastWarning / toastError / toastInfo
- alert / confirm / prompt / openModal

## 组件工具

详见 [vxui-framework/js/vxui-components.js](vxui-framework/js/vxui-components.js) 暴露的方法：

- moduleHeader
- dataList
- selectionBar
- tabStrip
- switchItem
- button / iconButton

## 边界说明

- 框架层不承载上传、文件管理、支付、AI、账户等业务 API。
- 框架核心已移除多语言能力。
- 如需与 tmpUI 项目联动，请通过 bridge 进行认证与路由映射。
