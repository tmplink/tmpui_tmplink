---
description: "Use when reading or referencing old legacy code in js/core/ (tmplink.js, dir.js, download.js, uploader.js, notes.js, ai.js, direct.js, etc.). These are legacy modules; new features should use VXUI equivalents. Read for business logic reference only."
applyTo: "js/core/**"
---
# js/core/ 旧版核心模块

## ⚠️ 注意：这是旧版代码
- 这些模块正在被 VXUI (`js/vxui/`) 体系逐步替代
- 新功能**不要**在这里开发，应在 `js/vxui/` 中实现
- 仅在需要理解业务逻辑、兼容旧代码时参考

## 模块对应关系（旧 → 新）
| 旧模块 | 新模块 |
|--------|--------|
| `tmplink.js` (类 `tmplink`) | `api.js` (类 `tmplink_api`) — VXUI 使用轻量 API |
| `dir.js` | `VX_FILELIST` (vxui-filelist.js) |
| `uploader.js` | `VX_UPLOADER` (vxui-uploader.js) |
| `download.js` | `VX_DOWNLOAD` (vxui-download.js) |
| `notes.js` | `VX_NOTES` (vxui-notes.js) |
| `ai.js` | `VX_AI` (vxui-ai.js) |
| `direct.js` | `VX_DIRECT` (vxui-direct.js) |

## 仍在活跃使用的模块
- `api.js` — VXUI 的 HTTP 层
- `function.js` — 通用工具函数
- `navbar.js` — 导航栏逻辑
- `stream.js` — 视频播放器
- `media.js` — 媒体类型检测
- `oauth.js` — Google OAuth
- `dynamic.js` — 工作区路由（转跳 VXUI）
