# 钛盘自动化回归测试

## 概览

基于 Playwright 构建的三层回归测试，用于防止开发过程中（尤其是 AI 辅助编码）产生预期外的 UI 变化和功能变化。

| 测试层 | 文件 | 说明 |
|--------|------|------|
| **i18n 对齐** | `tests/specs/i18n.spec.js` | 检查四个语言文件键集一致、无空值、命名规范 |
| **API 可用性** | `tests/specs/api.spec.js` | 验证 8 个主要 API 端点的基本可用性 |
| **UI 截图回归** | `tests/specs/ui.spec.js` | 对 21 个页面截图并与基线对比，捕获 console 错误 |

UI 测试覆盖 **4 个视口/主题组合 × 21 页 = 84 组截图**：

| Project | 视口 | 主题 |
|---------|------|------|
| `desktop-light` | 1440×900（13" MacBook Air） | 亮色 |
| `mobile-light` | 375×812（iPhone SE） | 亮色 |
| `desktop-dark` | 1440×900 | 深色 |
| `mobile-dark` | 375×812 | 深色 |

### UI 覆盖 URL 清单

以下为当前自动化回归测试使用/规划覆盖的页面 URL：

```text
/index.html
/?tmpui_page=/login
/?tmpui_page=/reg
/?tmpui_page=/vx&module=filelist&view=list
/?tmpui_page=/vx&module=direct&tab=dashboard
/?tmpui_page=/vx&module=direct&tab=files&sort_by=0&sort_type=0
/?tmpui_page=/vx&module=direct&tab=folders&sort_by=0&sort_type=0
/?tmpui_page=/vx&module=direct&tab=domain
/?tmpui_page=/vx&module=direct&tab=api
/?tmpui_page=/vx&module=notes
/?tmpui_page=/vx&module=ai
/?tmpui_page=/vx&module=shop
/?tmpui_page=/vx&module=shop&tab=purchased
/?tmpui_page=/vx&module=points
/?tmpui_page=/vx&module=points&tab=selling
/?tmpui_page=/vx&module=points&tab=mall
/?tmpui_page=/vx&module=points&tab=orders
/?tmpui_page=/vx&module=settings
/?tmpui_page=/404
/?tmpui_page=/403
/?tmpui_page=/504
/?tmpui_page=/tos.html
/?tmpui_page=/privacy.html
```

---

## 前置条件

```bash
# 安装依赖（首次）
npm install

# 安装 Playwright 浏览器（首次）
npx playwright install chromium
```

---

## 凭据配置

i18n 测试无需凭据，**API 和 UI 测试需要有效的钛盘账号**。

**首次运行**时，程序会交互式提示输入：

```
请输入测试凭据:
  钛盘用户名 (邮箱): your@email.com
  密码: yourpassword
  密记解密密钥: yourkey
```

凭据会保存到 `tests/credentials.json`（已被 `.gitignore` 排除，不会同步到 git）。

**再次运行**时，程序会询问是否复用已保存的凭据：

```
检测到已保存的凭据（用户: your@email.com）
是否使用已保存的凭据? [Y/n]
```

**更换凭据**：直接删除 `tests/credentials.json`，下次运行时会重新提示输入。

---

## 运行命令

### 单项测试

```bash
npm run test:i18n      # i18n 键对齐（无需凭据，几秒内完成）
npm run test:api       # API 可用性检查
npm run test:ui        # UI 截图回归（全部 4 个视口）
```

### 按视口/主题筛选

```bash
npm run test:desktop   # 桌面端（亮色 + 深色）
npm run test:mobile    # 移动端（亮色 + 深色）
npm run test:dark      # 深色模式（桌面 + 移动）
```

### 全量测试

```bash
npm run test           # 运行 i18n + API + UI 全部测试（已保存凭据时会询问是否复用）
npm run test:auto      # 同上，但已保存凭据时自动静默使用，无任何交互（AI / CI 专用）
```

### 基线管理

```bash
npm run baseline       # 更新全部基线（自动使用已保存凭据，无交互）
npm run baseline:ui    # 仅更新 UI 截图基线（自动使用已保存凭据，无交互）
```

---

## 开发流程

```
┌─────────────────────────────────────────────────────────┐
│  开始新功能 / Bug 修复前                                  │
│  npm run baseline   ← 建立基线                           │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
                    开始开发 / 修改代码
                           │
                           ▼
                    npm run test
                           │
               ┌───────────┴───────────┐
               │                       │
             全部通过               有测试失败
               │                       │
               ▼                       ▼
     调整基线以接受变更         检查 test-results/ 中的
     npm run baseline          diff 截图，定位问题
               │                       │
               ▼                       ▼
            提交代码              回到修改代码
```

### 典型工作节奏

1. **开始开发前** — 确保 `npm run test` 全部通过，建立干净基线
2. **开发中** — 随时运行相关模块的测试，例如只改了 filelist 模块时跑 `npm run test:desktop`
3. **提交前** — 运行 `npm run test` 全量检查
4. **接受预期变更** — 确认变更符合预期后，用 `npm run baseline` 更新本地基线，再提交代码到 git

---

## 查看测试结果

### HTML 报告

```bash
npx playwright show-report
```

### 截图 diff

测试失败时，`test-results/` 目录下会生成三张对比图：

```
test-results/
  ui-spec-desktop-light-filelist-list/
    filelist-list-actual.png    ← 本次截图
    filelist-list-expected.png  ← 基线截图
    filelist-list-diff.png      ← 差异高亮图
```

### 基线截图位置

```
tests/screenshots/
  desktop-light/    ← 桌面亮色基线
  mobile-light/     ← 移动端亮色基线
  desktop-dark/     ← 桌面深色基线
  mobile-dark/      ← 移动端深色基线
```

---

## 测试内容详解

### i18n 测试

检查 `json/cn.json`、`json/en.json`、`json/hk.json`、`json/jp.json` 四个文件：

- **键集一致**：四个文件的键集合完全相同（报告缺失/多余的键名及所属文件）
- **无空值**：所有键的值为非空字符串
- **命名规范**：键名匹配 `^[a-z][a-z0-9_]*$`（小写字母、数字、下划线）
- **数量一致**：四个文件的键数量相同

### API 测试

通过 storageState 中的 `app_token` 调用以下端点，验证 HTTP 200 + 响应结构：

| 端点 | Action | 验证内容 |
|------|--------|---------|
| `/api_v2/token` | `challenge` | data 存在 |
| `/api_v2/user` | `get_detail` | status=1, data 含 uid |
| `/api_v2/file` | `my_file_count` | status=1 |
| `/api_v2/meetingroom` | `list` | status=1 |
| `/api_v2/direct` | `dashboard` | status=1 |
| `/api_v2/notes` | `list` | status=1 |
| `/api_v2/ai` | `history` | status=1 |
| `/api_v2/shop` | `products` | status=1 |

### UI 截图测试

每个页面的测试流程：

1. 导航到页面，等待网络空闲（`networkidle`）
2. 等待关键元素出现
3. 额外等待 2 秒（确保动画/异步渲染完成）
4. 深色模式下验证 `html.system-dark` class 是否激活
5. 全页滚动截图，动态区域（文件列表内容、统计数字、聊天记录等）使用 `mask` 遮罩
6. 截图与基线对比，差异超过 1% 则失败
7. 检查 `console.error` 和未捕获异常（白名单之外的错误导致失败）

**动态区域遮罩**（对比时忽略这些区域，其余区域正常对比）：

| 页面 | 遮罩的动态区域 |
|------|--------------|
| 文件列表 | 文件列表内容、文件/文件夹数量、总大小、刷新时间 |
| 直链 Dashboard | 统计数字、流量图表、品牌设置状态 |
| 直链文件/文件夹列表 | 列表内容 |
| 密记 | 笔记列表、笔记内容编辑区 |
| AI 助手 | 聊天记录、配额显示 |
| 商城 | 首次赞助优惠区块 |
| 点数 | 余额、交易记录 |
| 设置 | OAuth 状态、用户头像/名称/UID |

---

## 文件结构

```
tests/
  helpers/
    config.js               # 凭据读写
    pages.js                # 21 个页面定义 + mask 配置
    console-allowlist.js    # 可忽略的 console 消息白名单
    api-endpoints.js        # API 端点定义
  setup/
    credentials.setup.js    # globalSetup：凭据管理（交互式/环境变量）
    auth.setup.js           # 浏览器登录，保存 storageState
  specs/
    i18n.spec.js            # i18n 对齐测试
    api.spec.js             # API 可用性测试
    ui.spec.js              # UI 截图测试（4 个 project 共用）
  credentials.json          # 本地凭据（.gitignore，不入 git）
  .auth/
    state.json              # 登录 storageState（.gitignore，不入 git）
  screenshots/              # 基线截图（本地基线，已排除 git）
    desktop-light/
    mobile-light/
    desktop-dark/
    mobile-dark/
playwright.config.js
package.json
```

---

## 常见问题

**Q: i18n 测试报告键不对齐，怎么处理？**

这是真实的 i18n 缺失问题，需要补全对应语言文件中缺失的键。参考 copilot-instructions.md 中的 i18n 规范，四个语言文件（cn/en/hk/jp）必须同步更新。

**Q: UI 测试因为动态内容变化而失败怎么办？**

检查失败页面的 diff 截图，如果差异确实来自动态内容（如用户数据），可以在 `tests/helpers/pages.js` 的对应页面配置中添加该元素到 `masks` 数组。

**Q: 截图在不同机器上有像素差异导致失败怎么办？**

可以在 `playwright.config.js` 中调整 `maxDiffPixelRatio`（默认 0.01，即 1%），或对特定截图使用更宽松的容差。建议基线在同一台机器上建立和维护。

**Q: 首次运行如何跳过凭据提示直接跑 i18n？**

```bash
npm run test:i18n
```

i18n 测试不依赖 auth setup，无需提供任何凭据。
