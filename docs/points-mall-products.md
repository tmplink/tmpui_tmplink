# 积分商城商品清单

本文档根据当前前端代码整理，来源为 [js/vxui/vxui-points.js](js/vxui/vxui-points.js) 中的积分商城商品定义。

## 当前商品

| 商品代码 | 商品名称 | 面额 | 兑换所需点数 |
|---|---|---:|---:|
| `JD50` | 京东 E 卡 | ¥50 | 6500 |
| `JD100` | 京东 E 卡 | ¥100 | 13000 |
| `JD500` | 京东 E 卡 | ¥500 | 65000 |

## 说明

- 当前前端积分商城商品定义为静态数组，位于 [js/vxui/vxui-points.js](js/vxui/vxui-points.js#L196)。
- 商品名称在界面中统一使用翻译键 `vx_mall_jd_ecard`，中文显示为“京东 E 卡”。
- 兑换按钮向 `VX_POINTS.exchangeMallItem(itemCode, cardId)` 传入的商品代码分别为 `JD50`、`JD100`、`JD500`。
- 若后续商城新增商品，需同步更新本文件。