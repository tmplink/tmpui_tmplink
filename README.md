# 钛盘前端

[tmp.link](https://tmp.link) 的前端开源仓库。纯静态 SPA，无构建工具，直接在浏览器运行。

---

## 技术栈

- **框架**：tmpUI（自研 SPA 路由/模板/i18n，见 `tmpui.js`）
- **UI 体系**：VXUI（`js/vxui/` + `tpl/vxui/` + `css/vxui/`）
- **依赖**：Bootstrap 4.6、jQuery、ApexCharts、CryptoJS、Iconpark — 均以静态文件引入，无 npm 依赖
- **多语言**：中文简体 / 繁体 / 英文 / 日文（`json/*.json`）

---

## 目录结构

```
index.html          # 入口
tmpui.js            # SPA 框架（只读，勿修改）
js/
  vxui/             # VXUI 模块（新功能写这里）
  core/             # 旧版业务逻辑（仅供参考）
  init/             # 页面初始化器
tpl/
  vxui/             # VXUI HTML 模板
css/
  vxui/             # VXUI 样式
  dark.css          # 深色模式
json/               # i18n 翻译文件
plugin/             # 第三方库（只读）
docs/               # 技术文档
tests/              # Playwright 自动化测试
```

---

## VXUI 模块

| 全局对象 | 文件 | 功能 |
|----------|------|------|
| `VXUI` | `vxui-core.js` | 框架核心、Toast、i18n |
| `VX_FILELIST` | `vxui-filelist.js` | 文件列表、相册视图、拖放上传、IndexedDB 缓存 |
| `VX_UPLOADER` | `vxui-uploader.js` | 上传队列（默认 80 MB 分片，最多 10 并发，单文件上限 50 GB） |
| `VX_DOWNLOAD` | `vxui-download.js` | 批量下载（8 MB 分片，3 线程） |
| `VX_DIRECT` | `vxui-direct.js` | 直链管理、自定义域名、流量分析 |
| `VX_AI` | `vxui-ai.js` | AI 聊天 |
| `VX_NOTES` | `vxui-notes.js` | 加密密记（AES 客户端加密） |
| `VX_SHOP` | `vxui-shop.js` | 商城 |
| `VX_ACCOUNT` | `vxui-account.js` | 账户设置、OAuth |
| `VX_POINTS` | `vxui-points.js` | 积分商城 |
| `VxSort` | `vxui-sort.js` | 通用排序 |

---

## 开发约定

- 新功能一律写入 VXUI 体系，不改旧版 `js/core/`
- 样式类以 `vx-` 开头；深色模式覆盖写在 `css/dark.css`
- 新增文案需同步更新四个 `json/*.json`，键名用小写下划线
- 使用 icon 前先在 `plugin/icon/lib.js` 查找实际可用的名称
- **禁止修改**：`tmpui.js`、`tmpui.txt`、`plugin/`、`js/tools/`

---

## 本地开发

无需安装依赖，用任意静态文件服务器托管根目录即可：

```bash
# 示例：用 npx serve
npx serve .

# 或者 Python
python -m http.server 8080
```

---

## 自动化测试

基于 Playwright，覆盖 i18n 键对齐、API 可用性、UI 截图回归（4 个视口 × 21 页 = 84 组截图）。

```bash
npm install                    # 首次安装依赖
npx playwright install chromium

npm run test                   # 全量测试
npm run test:i18n              # 仅 i18n 键对齐（无需账号，秒级完成）
npm run test:desktop           # 仅桌面端 UI 截图
npm run test:auto              # 无交互模式（CI / AI 场景）
npm run baseline               # 接受变更后更新基线
```

> 第一次运行 API / UI 测试时会提示输入钛盘账号，凭据保存在 `tests/credentials.json`（已被 `.gitignore` 排除）。

完整说明见 [docs/TEST.md](docs/TEST.md)。

---

## 技术文档

| 文档 | 内容 |
|------|------|
| [docs/upload-performance.md](docs/upload-performance.md) | 分片大小、并发数、服务器选择逻辑 |
| [docs/filelist-indexeddb-cache.md](docs/filelist-indexeddb-cache.md) | 目录快照 IndexedDB 缓存方案 |
| [docs/points-mall-products.md](docs/points-mall-products.md) | 积分商城当前商品列表 |
| [docs/img.md](docs/img.md) | CDN 图片处理服务 URL 格式 |
| [docs/test.md](docs/test.md) | 自动化测试完整说明 |

---

## 反馈与贡献

- 提 issue 时请附上复现步骤和截图/录屏
- 欢迎 PR，改动请先确保 `npm run test` 全部通过
- 社区论坛：[bbs.tmp.link](https://bbs.tmp.link)

