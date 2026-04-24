# Shop API 文档

**接口地址**：`POST /api_v2/shop`  
**认证方式**：所有接口须在请求体中携带 `token` 字段（用户登录后获取）。  
**响应格式**：JSON

> 说明：私有空间相关接口已整合进 `/api_v2/shop`，与原有商城接口共用同一入口。

```json
{
  "status": 1,
  "data": {},
  "debug": ""
}
```

`status` 为 `1` 代表成功，其它值代表失败，具体错误信息在 `data.message` 或 `debug` 中。

---

## 接口列表

| action | 说明 | 需要登录 |
|---|---|:---:|
| `shop_buy` | 使用点数购买商品（通过商品代码） | ✅ |
| `shop_my` | 查询已购买的商品 | ✅ |

---

## 私有空间 API（新增接口）

**接口地址**：`POST /api_v2/shop`（与原有商城接口共用）

### 接口列表

| action | 说明 | 需要登录 |
|---|---|:---:|
| `space_buy` | 购买私有空间（256GB / 1TB） | ✅ |
| `space_renew` | 续费私有空间（支持单个 / 批量） | ✅ |
| `space_list` | 查询用户的私有空间列表 | ✅ |

### 规格与计费

| 规格参数 `spec` | 空间大小 | 单次购买点数 | 单次续费点数 | 有效期 |
|---|---:|---:|---:|---:|
| `256g` | 256GB | 600 | 600 | 31天 |
| `1t` | 1TB | 2000 | 2000 | 31天 |

说明：

- 支持多次购买，空间自动叠加。
- 当前有效私有空间叠加总量上限为 `10TB`，超出上限时不可继续购买。
- 续费按单条空间记录独立延期，延期规则为：`max(当前到期时间, 当前时间) + 30天`。
- 购买与续费均仅支持点数支付。

---

### space_buy — 购买私有空间

#### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `action` | string | ✅ | 固定值 `space_buy` |
| `token` | string | ✅ | 用户认证 Token |
| `spec` | string | ✅ | 规格：`256g` 或 `1t` |

#### 请求示例

```json
{
  "action": "space_buy",
  "token": "USER_TOKEN",
  "spec": "256g"
}
```

#### 响应示例

**成功**

```json
{
  "status": 1,
  "data": {
    "id": 123,
    "spec": "256g",
    "label": "256GB",
    "size": 274877906944,
    "etime": "2026-05-23 12:00:00",
    "price": 6
  },
  "debug": ""
}
```

**失败（规格无效）**

```json
{
  "status": 2101,
  "data": {
    "message": "无效的规格，可选值：256g / 1t"
  },
  "debug": ""
}
```

**失败（超过 10TB 上限）**

```json
{
  "status": 2102,
  "data": {
    "message": "可叠加私有空间总量不能超过 10TB"
  },
  "debug": ""
}
```

---

### space_renew — 续费私有空间（单个 / 批量）

#### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `action` | string | ✅ | 固定值 `space_renew` |
| `token` | string | ✅ | 用户认证 Token |
| `ids` | string / array | ✅ | 目标空间 ID。支持 `"1,2,3"` 或 `[1,2,3]` |

#### 请求示例

```json
{
  "action": "space_renew",
  "token": "USER_TOKEN",
  "ids": "123,124"
}
```

#### 响应示例

**成功**

```json
{
  "status": 1,
  "data": {
    "renewed": [
      {
        "id": 123,
        "spec": "256g",
        "label": "256GB",
        "etime": "2026-06-22 12:00:00",
        "renew_price": 6
      },
      {
        "id": 124,
        "spec": "1t",
        "label": "1TB",
        "etime": "2026-06-22 12:00:00",
        "renew_price": 18
      }
    ],
    "cost": 24
  },
  "debug": ""
}
```

**失败（ID无效）**

```json
{
  "status": 2103,
  "data": {
    "message": "部分或全部 ID 无效"
  },
  "debug": ""
}
```

---

### space_list — 查询私有空间列表

#### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `action` | string | ✅ | 固定值 `space_list` |
| `token` | string | ✅ | 用户认证 Token |

#### 请求示例

```json
{
  "action": "space_list",
  "token": "USER_TOKEN"
}
```

#### 响应示例

**成功**

```json
{
  "status": 1,
  "data": [
    {
      "id": 123,
      "spec": "256g",
      "label": "256GB",
      "size": 274877906944,
      "etime": "2026-06-22 12:00:00",
      "ctime": "2026-04-23 12:00:00",
      "is_active": 1,
      "renew_price": 6
    },
    {
      "id": 124,
      "spec": "1t",
      "label": "1TB",
      "size": 1099511627776,
      "etime": "2026-05-23 12:00:00",
      "ctime": "2026-04-23 12:00:30",
      "is_active": 1,
      "renew_price": 18
    }
  ],
  "debug": ""
}
```

`is_active`：`1` 为有效，`0` 为已过期。

---

## 错误码

| status | 说明 |
|---|---|
| `1` | 成功 |
| `0` | 通用错误（如认证失败） |
| `2001` | 商品不存在或已售罄 |
| `2003` | 点数不足 |
| `2004` | 购买失败（系统错误） |
| `2101` | 私有空间规格无效 |
| `2102` | 私有空间总量超过 10TB 上限 |
| `2103` | 私有空间 ID 无效 |
| `2104` | 私有空间规格数据异常 |

---

## shop_buy — 使用点数购买商品

通过商品代码 `item_code` 购买一件点卡商品，系统自动从库存中取出一件，扣除点数后返回点卡内容（卡号）。

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `action` | string | ✅ | 固定值 `shop_buy` |
| `token` | string | ✅ | 用户认证 Token |
| `item_code` | string | ✅ | 商品代码，如 `VIP30` |

### 请求示例

```json
{
  "action": "shop_buy",
  "token": "USER_TOKEN",
  "item_code": "VIP30"
}
```

### 响应示例

**成功**
```json
{
  "status": 1,
  "data": {
    "id": 1,
    "item_code": "VIP30",
    "content": "XXXX-XXXX-XXXX",
    "pirce": 600
  },
  "debug": ""
}
```

**失败（商品不存在或已售罄）**
```json
{
  "status": 2001,
  "data": { "message": "商品不存在或已售罄" },
  "debug": ""
}
```

**失败（点数不足）**
```json
{
  "status": 2003,
  "data": { "message": "点数不足" },
  "debug": ""
}
```

### 备注

- 购买成功后返回的 `content` 即为点卡卡号，请妥善保存。
- 用户账户点数将被扣除，同时在 `log_point` 中记录消费日志（`action` 值为 `shop_buy`）。
- 同一 `item_code` 可能有多件库存，系统按先进先出顺序自动分配。

---

## shop_my — 查询已购买的商品

查询当前登录用户已购买的商品列表，按购买时间倒序排列。

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `action` | string | ✅ | 固定值 `shop_my` |
| `token` | string | ✅ | 用户认证 Token |
| `page` | int | | 页码，从 `0` 开始，默认 `0`，每页 20 条 |

### 请求示例

```json
{
  "action": "shop_my",
  "token": "USER_TOKEN",
  "page": 0
}
```

### 响应示例

**成功**
```json
{
  "status": 1,
  "data": [
    {
      "id": 1,
      "item_code": "VIP30",
      "pirce": 600,
      "content": "XXXX-XXXX-XXXX",
      "ctime": "2026-03-01 10:00:00",
      "mtime": "2026-03-10 08:30:00"
    }
  ],
  "debug": ""
}
```

**成功（无购买记录）**
```json
{
  "status": 1,
  "data": [],
  "debug": ""
}
```

### 字段说明

| 字段 | 说明 |
|---|---|
| `id` | 商品 ID |
| `item_code` | 商品代码 |
| `pirce` | 购买时消耗的点数 |
| `content` | 商品内容（点卡卡号等） |
| `ctime` | 商品创建时间 |
| `mtime` | 购买时间 |

---

## 数据库表结构

### shop 表

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | int(11) | 主键，自增 |
| `item_code` | varchar(20) | 商品代码 |
| `pirce` | int(10) unsigned | 购买所需点数 |
| `uid` | int(11) | 购买者 ID（`0` 表示未售出） |
| `content` | varchar(100) | 商品内容（点卡卡号等） |
| `ctime` | datetime | 创建时间 |
| `mtime` | datetime | 修改时间（购买时更新） |
