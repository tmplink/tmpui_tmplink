## 图片处理服务器用法总结

### 服务器地址

| 图片服务器 | 对应存储服务器 |
|-----------|---------------|
| `img-hd100.5t-cdn.com:998` | `storage-hd100.tmp.link:1000` |
| `img-hd101.5t-cdn.com:998` | `storage-hd101.tmp.link:1001` |
| `img-hd105.5t-cdn.com:998` | `storage-hd105.tmp.link:1000` |
| `img-hd106.5t-cdn.com:998` | `storage-hd106.tmp.link:1001` |

---

### URL 格式

```
https://img-hd100.5t-cdn.com:998/{操作}/{参数}/{图片sha1}.{扩展名}
```

**扩展名要求：** `.jpg` `.jpeg` `.png` `.gif` `.webp`（用于 nginx 识别图片类型，转发时自动去掉）

---

### 支持的操作

#### 1. 缩略图 `/thumb` - 保持比例缩放

| URL | 效果 |
|-----|------|
| `/thumb/0x0/id.jpg` | **原图 JPG 压缩版** (90% 质量) |
| `/thumb/200x0/id.jpg` | 宽度 200，高度保持比例 |
| `/thumb/0x200/id.jpg` | 高度 200，宽度保持比例 |
| `/thumb/200x200/id.jpg` | 缩放至 200x200 内 |

**示例：**
```
https://img-hd100.5t-cdn.com:998/thumb/0x0/1fb173329cf63c8f4a82d44c1a32f603eb5ba633.jpg
https://img-hd100.5t-cdn.com:998/thumb/200x200/1fb173329cf63c8f4a82d44c1a32f603eb5ba633.jpg
```

---

#### 2. 裁剪 `/crop` - 居中裁剪

保持比例从中心裁剪，输出精确尺寸。

```
/crop/{宽}x{高}/{图片sha1}.{扩展名}
```

**示例：**
```
https://img-hd100.5t-cdn.com:998/crop/100x100/1fb173329cf63c8f4a82d44c1a32f603eb5ba633.jpg
```

---

#### 3. 旋转 `/rotate` - 图片旋转

支持 90°、180°、270°。

```
/rotate/{角度}/{图片sha1}.{扩展名}
```

**示例：**
```
https://img-hd100.5t-cdn.com:998/rotate/90/1fb173329cf63c8f4a82d44c1a32f603eb5ba633.jpg
```

---

### 配置参数

| 参数 | 值 |
|------|-----|
| 最大处理尺寸 | 100MB |
| 输出格式 | JPEG |
| 图片质量 | 90% |
| 隔行扫描 | 开启 |

---

### 防盗链设置

**允许的来源：**
- `*.5t-cdn.com` / `5t-cdn.com`
- `*.ttttt.link` / `ttttt.link`
- `*.tmp.link` / `tmp.link`
- `127.0.0.1` / `localhost`
- 无 Referer 或 Referer 被删除

非法来源返回 `403 Forbidden`。

---

### thumb vs crop 区别

| 原图 1000x500 | thumb/200x200 | crop/200x200 |
|--------------|---------------|--------------|
| 结果尺寸 | 200x100 | 200x200 |
| 处理方式 | 等比缩放，完整显示 | 等比缩放后居中裁剪 |
