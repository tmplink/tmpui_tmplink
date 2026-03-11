# FileList IndexedDB 持久化缓存说明

本文档说明当前 VXUI 文件列表将目录快照持久化到 IndexedDB 的实现方式，基于现有前端源码整理。

## 适用范围

- 当前生效实现：`js/vxui/vxui-filelist.js`
- 缓存对象：VXUI 文件列表模块 `VX_FILELIST`
- 不适用范围：旧版 `js/core/` 文件列表逻辑

本功能对应最近一轮 VXUI 缓存增强改动，核心目标是让文件夹详情、子文件夹列表、文件列表以及部分附加状态能够在前端本地保留，并在再次进入同一目录时直接命中。

## 设计目标

当前这套缓存不是单纯的“接口结果临时存一下”，而是围绕目录页状态做的快照持久化，主要解决以下问题：

1. 再次进入同一目录时，优先秒开本地快照，减少白屏和骨架屏等待。
2. 降低同一目录反复打开时的远端请求次数。
3. 在上传、移动、删除、同步完成等本地增量变化发生后，立即把最新 UI 状态回写到本地缓存。
4. 在多个标签页同时打开同一目录时，通过广播机制同步缓存变更。
5. 对有剩余有效期的文件，缓存恢复时自动扣减剩余时间，避免显示过期脏数据。

## 存储结构

### 数据库与对象仓库

- 数据库名：`tmplink_vxui_cache`
- 版本号：`1`
- Object Store：`filelist_rooms`
- 主键：`key`

数据库由 `openCacheDb()` 懒加载打开。如果浏览器不支持 `indexedDB`，则自动降级为不使用持久化缓存，不会阻塞页面主流程。

### 缓存作用域

缓存不是只按目录 ID 区分，而是按“站点 + token + mrid”隔离：

```text
scope = host + '::' + token
key   = scope + '::' + mrid
```

这样做有两个直接好处：

1. 同一浏览器下不同站点不会串缓存。
2. 不同用户或不同访客 token 访问同一目录时不会共用缓存。

这里的 token 来源和页面实际请求保持一致，优先读取 `TL.api_token`，其次才会回退到本地存储或 cookie。

## 快照内容

每个目录会被序列化为一个快照对象，大致结构如下：

```js
{
  key,
  scope,
  mrid,
  savedAt,
  room,
  subRooms,
  fileList,
  fullPath,
  directState: {
    directDomain,
    directProtocol,
    directDomainReady,
    directDirEnabled,
    directDirKey
  },
  meta: {
    isOwner,
    isDesktop,
    startMrid
  }
}
```

其中几个关键点：

- `savedAt` 用于恢复缓存时计算文件剩余时间衰减。
- `room`、`subRooms`、`fileList` 是目录主体数据。
- `fullPath` 用于恢复面包屑，避免每次都重新请求完整路径。
- `directState` 保存直链侧边栏相关状态，避免目录基础信息恢复后还需要等待直链接口才能完整显示侧边栏。
- `meta` 保存目录归属、桌面态、起始根目录等 UI 决策信息。

缓存写入前会通过 `cloneCacheData()` 做深拷贝，避免直接把运行时对象引用放进 IndexedDB。

## 读取流程

### 首次进入目录

`VX_FILELIST.init()` 完成基础状态初始化后，会调用 `loadRoom()`。

当本次加载不是强制远端刷新时，`loadRoom()` 会先执行：

1. `loadCachedRoomSnapshot()`
2. `readCacheSnapshot(mrid)` 从 IndexedDB 读取快照
3. `normalizeCacheSnapshot(snapshot)` 校验作用域并修正数据
4. `applySnapshot(snapshot)` 直接恢复页面状态和 UI

如果本地缓存命中成功，当前目录会直接用快照渲染，远端详情接口不会立刻再发。

如果缓存未命中、缓存损坏、作用域不匹配，或者读取失败，则回退到正常远端加载流程。

### 缓存恢复时的修正逻辑

恢复快照时不会原样信任旧数据，而是会做一次标准化处理：

1. 校验 `scope` 是否与当前用户上下文一致。
2. 深拷贝快照，避免直接操作原始缓存对象。
3. 对 `fileList` 执行 `adjustCachedFileList()`。
4. 根据 `savedAt` 到当前时间的秒差，扣减每个文件的 `lefttime`。
5. 已过期的临时文件会直接从快照中过滤掉。
6. 如果恢复过程中剔除了已过期文件，会立刻把修正后的快照重新写回本地，但不会广播。

这意味着缓存恢复后显示的有效期是“按时间流逝修正后的结果”，而不是保存瞬间的旧值。

## 远端刷新流程

以下场景会明确走远端：

- 用户点击刷新按钮 `refresh()`
- `loadRoom({ forceRemote: true })`
- 本地缓存未命中后自动回退远端

远端加载主流程如下：

1. 请求 `meetingroom/details` 获取目录详情。
2. 写入 `room`、`subRooms`、`isOwner`、`isDesktop` 等基础状态。
3. 异步补充面包屑 `loadFullPath()`。
4. 异步补充直链侧边栏状态 `loadDirectFolderState()`。
5. 调用 `loadFileList(0, { forceRemote: true, persist: true })` 拉第一页文件列表。
6. 第 0 页加载完成后，将完整快照持久化到 IndexedDB。

这里有一个很重要的实现约束：

- 只有第一页加载完成时会持久化目录快照。
- 后续翻页得到的数据只保存在当前内存中，不会持续覆盖本地快照。

这说明当前缓存设计更偏向“目录首页快照缓存”，而不是“全分页离线镜像”。

## 写回时机

### 1. 远端首屏加载完成后写回

`loadFileList(0)` 在第一页请求成功且 `persist !== false` 时，会执行 `persistCurrentSnapshot()`。

这是最核心的一次写回，负责把最新目录主快照落地。

### 2. 异步补充信息写回

以下异步补充数据在成功更新后也会回写缓存，但默认不广播：

- `loadFullPath()` 更新面包屑后
- `loadDirectFolderState()` 更新直链状态后
- 文件同步完成 `onFileSyncComplete()` 后

这些数据通常是对当前页面的补充，不需要强制其它标签页立即刷新，因此使用了 `broadcast: false`。

### 3. 本地增量修改后写回

模块内部提供了一组本地数据操作方法，都会在默认情况下自动回写缓存：

- `removeFilesLocally()`
- `removeFoldersLocally()`
- `updateFileLocally()`
- `updateFolderLocally()`
- `insertFolderLocally()`

这样做的意义是：只要 UI 中的数据已经被本地更新，缓存也会同步保持一致，不必等待下一次全量刷新。

### 4. 业务操作成功后写回

以下典型业务动作成功后，也会触发缓存持久化：

- 上传完成后的增量刷新
- 批量移动成功后从当前目录移除项目
- 批量删除成功后从当前目录移除项目
- 某些文件或文件夹属性更新完成后

整体设计倾向于“先更新内存与 UI，再立即回写快照”。

## 删除与失效策略

### 目录不存在时删除缓存

如果远端 `details` 接口返回当前目录不存在，页面会：

1. 显示“文件夹不存在”状态。
2. 调用 `deleteCacheSnapshot(this.mrid, { broadcast: false })` 删除该目录快照。

这样可以避免已经被删除的目录在后续访问时继续被旧缓存命中。

### 过期文件的两层处理

当前实现对有剩余有效期的文件用了两层保护：

1. 缓存恢复阶段：根据 `savedAt` 扣减 `lefttime`，直接过滤已经过期的文件。
2. 页面运行阶段：每次 `render()` 后会调用 `rebuildExpireTimers()`，为临时文件重新安排本地过期清理定时器。

到达过期时间后，定时器会触发本地删除并回写缓存，因此内存态和持久化态会一起收敛。

## 跨标签页同步

除了 IndexedDB 本地存储，本功能还使用了 `BroadcastChannel` 做目录级同步：

- Channel 名称：`vx-filelist-cache`
- 广播事件类型：`vx-filelist-cache-update`

写入或删除缓存时，默认会广播：

```js
{
  type: 'vx-filelist-cache-update',
  action: 'upsert' | 'delete',
  mrid,
  scope
}
```

接收端只会处理满足以下条件的消息：

1. `type` 正确。
2. `scope` 与当前标签页一致。
3. `mrid` 与当前正在浏览的目录一致。
4. 当前不处于 `refreshing` 状态。

处理策略如下：

- `delete`：直接清空当前目录的文件和子目录列表，并刷新计数。
- `upsert`：重新从 IndexedDB 读取当前目录快照并应用到页面。

这意味着多个标签页之间同步的是“缓存结果”，而不是直接同步某个内存对象引用。

## 降级与容错

当前实现对失败场景做了显式兜底：

- 浏览器不支持 IndexedDB：直接返回 `null`，页面继续按远端加载。
- IndexedDB 打开失败、阻塞、读写异常：打印 `console.warn`，但不阻塞页面。
- BroadcastChannel 不可用：只失去跨标签页同步，不影响单标签页缓存。
- 缓存 JSON 深拷贝失败：回退到默认空结构。

因此这套能力是“增强型能力”，不会成为目录页的硬依赖。

## 当前实现边界

从现有代码看，这套缓存能力的边界比较明确：

1. 当前持久化的重点是目录首页状态，不是全分页离线缓存。
2. 缓存只落在 VXUI `js/vxui/vxui-filelist.js`，没有迁移到旧版 `js/core/`。
3. 快照中保存了目录 UI 所需的大部分信息，但不是所有瞬时状态都会被持久化，例如选中态、当前弹窗状态等不会入库。
4. 某些补充状态为了避免循环刷新，采用 `broadcast: false` 静默写回，不主动触发其它标签页同步。

## 维护建议

如果后续继续扩展这套能力，建议优先遵守以下原则：

1. 新增需要持久化的目录级状态时，优先补到 `buildCacheSnapshot()` 和 `applySnapshot()` 两端，保持读写结构对称。
2. 所有会修改当前目录列表的本地操作，尽量复用 `removeFilesLocally()`、`updateFileLocally()` 这类统一入口，避免 UI 已变但缓存没变。
3. 如果未来要支持“分页缓存”或“离线浏览更多页”，需要单独设计页级 key，而不是直接覆盖现有首页快照。
4. 如果未来需要更强的一致性，可考虑在广播消息里带版本号或时间戳，减少多标签页并发写入时的覆盖歧义。

## 结论

当前 filelist 的 IndexedDB 持久化缓存，本质上是一套“目录快照缓存 + 本地增量回写 + BroadcastChannel 同步”的组合方案。

它解决的不是纯接口缓存，而是让 VXUI 文件列表在以下方面更稳定：

- 再次进入目录时更快显示内容
- 本地操作后的 UI 与缓存保持一致
- 临时文件过期后自动清理
- 多标签页之间共享同一目录的最新快照结果

在现阶段，这套设计已经足以覆盖文件列表首页的高频访问和大多数本地变更场景。
