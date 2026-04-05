# tmpUI Bridge

tmpUI Bridge 只负责两件事：

- 将宿主登录态映射为框架 auth provider。
- 将框架视图切换映射为宿主路由跳转。

桥接脚本位置：

- [vxui-framework/js/vxui-tmpui-bridge.js](vxui-framework/js/vxui-tmpui-bridge.js)

最小接入方式：

```html
<script src="/plugin/icon/lib.js"></script>
<script src="/vxui-framework/js/vxui-framework.js"></script>
<script src="/vxui-framework/js/vxui-tmpui-bridge.js"></script>
```

```javascript
const framework = new VXUIFramework({
  root: '#vx-app',
  defaultView: 'overview'
});

new VXUITmpuiBridge({
  framework,
  app,
  service: TL,
  ownerResolver: () => TL.isLogin() && !!TL.profile?.owner,
  routeMap: {
    overview: '/vx&module=overview'
  },
  syncNavigationToHost: true
}).attach();

framework.init();
```

bridge 默认行为：

- 通过 TL.isLogin 或 localStorage.app_login 推断登录态。
- 通过 TL.profile/TL.uid 组装基础用户快照。
- 监听 vxui:viewchange 事件并可回推到 app.dynOpen/app.open。

推荐自定义项：

- ownerResolver：不同项目 owner 语义可能不同。
- routeMap 或 routeBuilder：将框架视图映射为宿主可识别路由。
- userResolver：若宿主用户结构不同，建议自定义。

公开选项：

- framework：必填，VXUIFramework 实例。
- app：可选，默认读取全局 app。
- service：可选，默认读取全局 TL。
- authResolver：可选，完全自定义认证状态。
- userResolver：可选，自定义用户快照。
- ownerResolver：可选，自定义 owner 判断。
- routeMap：可选，视图到宿主路由映射。
- routeBuilder：可选，动态构造宿主路由。
- syncNavigationToHost：默认 false，是否把视图切换回推宿主。
- useDynOpen：默认 true，优先使用 app.dynOpen。

说明：

- 框架核心已移除多语言能力，bridge 不再处理语言同步。
- bridge 不是业务层，不负责上传、文件管理、支付、AI 或账号业务 API。
