/**
 * VXUI FileList (文件列表) Module
 * 支持列表视图和相册视图的文件夹管理模块
 * @version 2.0.0
 */
var VX_FILELIST = VX_FILELIST || {
    // 状态
    mrid: 0,
    room: {},
    subRooms: [],
    fileList: [],
    selectedItems: [],
    isOwner: false,
    isDesktop: false,
    pageNumber: 0,
    selectMode: false,
    
    // 视图模式: 'list' | 'album'
    viewMode: 'list',
    
    // 相册网格大小: 'normal' | 'large' | 'small'
    gridSize: 'normal',
    
    // 图片文件列表（用于相册模式）
    photoList: [],
    
    // 灯箱状态
    lightboxOpen: false,
    lightboxIndex: 0,
    lightboxRotation: 0,
    
    // 右键菜单目标
    contextTarget: null,

    // 右键菜单模式：'context'（右键）|'more'（行内更多）
    contextMode: 'context',
    
    // 图片扩展名
    imageExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'],
    
    // 下载器
    downloader: null,

    // 批量下载器
    batchDownloader: null,

    // 刷新状态
    refreshing: false,

    // 排序管理器 (VxSort)
    sorter: null,

    // Folder privacy toggle state
    _privacyLoading: false,

    // Folder publish toggle state
    _publishLoading: false,

    // Full path breadcrumb cache
    fullPath: null,
    fullPathMrid: null,
    _fullPathReqId: 0,

    // Non-owner start root
    startMrid: null,

    // 全局搜索状态
    _gsOpen: false,
    _gsDebounceTimer: null,
    _gsCurrentKeyword: '',
    _gsRemoteReqId: 0,
    _gsLastResults: [],

    // 文件同步状态检查器
    _syncCheckTimers: {},

    // 文件过期清理定时器
    _expireTimers: {},

    // 上传增量更新合并标记
    _uploadUpdatePending: false,

    // IndexedDB 缓存
    _cacheDbPromise: null,
    _cacheChannel: null,
    _cacheSavedAt: null,
    _staleCacheThresholdMs: 60 * 60 * 1000,
    _cacheRepaintMinGapMs: 1000,

    /**
     * Get translation text safely (prefers TL.tpl, falls back to app.languageData).
     */
    t(key, fallback) {
        try {
            if (typeof TL !== 'undefined' && TL && TL.tpl && TL.tpl[key] !== undefined) return TL.tpl[key];
        } catch (e) { /* ignore */ }
        try {
            if (typeof app !== 'undefined' && app && app.languageData && app.languageData[key] !== undefined) return app.languageData[key];
        } catch (e) { /* ignore */ }
        return fallback;
    },

    /**
     * Simple placeholder formatter: replaces {name} with params.name
     */
    fmt(key, params, fallback) {
        const text = String(this.t(key, fallback) || '');
        if (!params) return text;
        return text.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
    },

    initCacheLayer() {
        if (this._cacheChannel || typeof BroadcastChannel === 'undefined') return;
        try {
            this._cacheChannel = new BroadcastChannel('vx-filelist-cache');
            this._cacheChannel.onmessage = (event) => {
                this.handleCacheBroadcast(event && event.data ? event.data : null);
            };
        } catch (error) {
            console.warn('[VX_FILELIST] BroadcastChannel unavailable:', error);
        }
    },

    getCacheScope() {
        const host = (typeof window !== 'undefined' && window.location) ? window.location.host : 'unknown';
        const token = this.getToken() || '';
        const uid = (typeof TL !== 'undefined' && TL.uid) ? String(TL.uid) : '0';
        return `${host}::${token}::${uid}`;
    },

    getCacheKey(mrid) {
        const roomId = (mrid !== undefined && mrid !== null) ? mrid : this.mrid;
        return `${this.getCacheScope()}::${roomId}`;
    },

    cloneCacheData(data, fallback) {
        if (data === undefined || data === null) {
            return fallback;
        }
        try {
            return JSON.parse(JSON.stringify(data));
        } catch (error) {
            return fallback;
        }
    },

    formatTimeAgo(timestamp) {
        const savedAt = Number(timestamp || 0);
        if (!savedAt) return '--';
        const diff = Math.floor((Date.now() - savedAt) / 1000);
        if (diff < 60) {
            return this.t('vx_cache_ago_fresh', '正在使用最新数据');
        }
        if (diff < 3600) {
            return this.fmt('vx_cache_ago_min', { n: Math.floor(diff / 60) }, '{n}分钟前');
        }
        if (diff < 86400) {
            return this.fmt('vx_cache_ago_hour', { n: Math.floor(diff / 3600) }, '{n}小时前');
        }
        return this.fmt('vx_cache_ago_day', { n: Math.floor(diff / 86400) }, '{n}天前');
    },

    formatCacheSavedAt(value) {
        return this.formatTimeAgo(value);
    },

    formatCacheSavedAtFull(value) {
        return this.formatTimeAgo(value);
    },

    openCacheDb() {
        if (typeof indexedDB === 'undefined') {
            return Promise.resolve(null);
        }

        if (this._cacheDbPromise) {
            return this._cacheDbPromise;
        }

        this._cacheDbPromise = new Promise((resolve) => {
            let settled = false;
            const req = indexedDB.open('tmplink_vxui_cache', 1);

            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains('filelist_rooms')) {
                    db.createObjectStore('filelist_rooms', { keyPath: 'key' });
                }
            };

            req.onsuccess = () => {
                settled = true;
                resolve(req.result);
            };

            req.onerror = () => {
                settled = true;
                console.warn('[VX_FILELIST] IndexedDB open failed:', req.error);
                resolve(null);
            };

            req.onblocked = () => {
                if (settled) return;
                console.warn('[VX_FILELIST] IndexedDB open blocked');
                resolve(null);
            };
        });

        return this._cacheDbPromise;
    },

    readCacheSnapshot(mrid) {
        return this.openCacheDb().then((db) => new Promise((resolve) => {
            if (!db) {
                resolve(null);
                return;
            }

            try {
                const tx = db.transaction('filelist_rooms', 'readonly');
                const store = tx.objectStore('filelist_rooms');
                const req = store.get(this.getCacheKey(mrid));
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => {
                    console.warn('[VX_FILELIST] IndexedDB read failed:', req.error);
                    resolve(null);
                };
            } catch (error) {
                console.warn('[VX_FILELIST] IndexedDB read exception:', error);
                resolve(null);
            }
        }));
    },

    writeCacheSnapshot(snapshot, options = {}) {
        if (!snapshot) return Promise.resolve(false);
        return this.openCacheDb().then((db) => new Promise((resolve) => {
            if (!db) {
                resolve(false);
                return;
            }

            try {
                const tx = db.transaction('filelist_rooms', 'readwrite');
                const store = tx.objectStore('filelist_rooms');
                store.put(snapshot);

                tx.oncomplete = () => {
                    if (String(snapshot.mrid) === String(this.mrid)) {
                        this._cacheSavedAt = Number(snapshot.savedAt || 0) || null;
                        this.updateSidebarCacheInfo();
                    }
                    if (options.broadcast !== false) {
                        this.broadcastCacheUpdate('upsert', snapshot.mrid);
                    }
                    resolve(true);
                };

                tx.onerror = () => {
                    console.warn('[VX_FILELIST] IndexedDB write failed:', tx.error);
                    resolve(false);
                };
            } catch (error) {
                console.warn('[VX_FILELIST] IndexedDB write exception:', error);
                resolve(false);
            }
        }));
    },

    deleteCacheSnapshot(mrid, options = {}) {
        return this.openCacheDb().then((db) => new Promise((resolve) => {
            if (!db) {
                resolve(false);
                return;
            }

            try {
                const tx = db.transaction('filelist_rooms', 'readwrite');
                const store = tx.objectStore('filelist_rooms');
                store.delete(this.getCacheKey(mrid));

                tx.oncomplete = () => {
                    if (options.broadcast !== false) {
                        this.broadcastCacheUpdate('delete', mrid);
                    }
                    resolve(true);
                };

                tx.onerror = () => {
                    console.warn('[VX_FILELIST] IndexedDB delete failed:', tx.error);
                    resolve(false);
                };
            } catch (error) {
                console.warn('[VX_FILELIST] IndexedDB delete exception:', error);
                resolve(false);
            }
        }));
    },

    buildCacheSnapshot() {
        const roomId = (this.mrid !== undefined && this.mrid !== null) ? String(this.mrid) : '0';
        return {
            key: this.getCacheKey(roomId),
            scope: this.getCacheScope(),
            mrid: roomId,
            savedAt: Date.now(),
            room: this.cloneCacheData(this.room, {}),
            subRooms: this.cloneCacheData(this.subRooms, []),
            fileList: this.cloneCacheData(this.fileList, []),
            fullPath: (Array.isArray(this.fullPath) && String(this.fullPathMrid) === roomId)
                ? this.cloneCacheData(this.fullPath, [])
                : null,
            directState: {
                directDomain: this.directDomain,
                directProtocol: this.directProtocol,
                directDomainReady: this.directDomainReady,
                directDirEnabled: this.directDirEnabled,
                directDirKey: this.directDirKey
            },
            meta: {
                isOwner: !!this.isOwner,
                isDesktop: !!this.isDesktop,
                startMrid: this.startMrid
            }
        };
    },

    persistCurrentSnapshot(options = {}) {
        const hasContent = !!(this.room && Object.keys(this.room).length);
        if (!hasContent && (!Array.isArray(this.fileList) || this.fileList.length === 0) && (!Array.isArray(this.subRooms) || this.subRooms.length === 0)) {
            return Promise.resolve(false);
        }
        return this.writeCacheSnapshot(this.buildCacheSnapshot(), options);
    },

    adjustCachedFileList(fileList, savedAt) {
        const source = Array.isArray(fileList) ? fileList : [];
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - Number(savedAt || 0)) / 1000));
        const nextList = [];
        let removedExpired = false;

        source.forEach((item) => {
            const file = this.cloneCacheData(item, null);
            if (!file) return;

            const isPermanent = Number(file.model) === 99;
            const lefttime = Number(file.lefttime) || 0;

            if (!isPermanent && lefttime > 0) {
                const nextLefttime = lefttime - elapsedSeconds;
                if (nextLefttime <= 0) {
                    removedExpired = true;
                    return;
                }
                file.lefttime = nextLefttime;
            }

            nextList.push(file);
        });

        return {
            fileList: nextList,
            removedExpired
        };
    },

    normalizeCacheSnapshot(snapshot) {
        if (!snapshot || snapshot.scope !== this.getCacheScope()) return null;

        const normalized = this.cloneCacheData(snapshot, null);
        if (!normalized) return null;

        const adjusted = this.adjustCachedFileList(normalized.fileList, normalized.savedAt);
        normalized.fileList = adjusted.fileList;
        normalized.savedAt = Date.now();
        normalized._removedExpired = adjusted.removedExpired;

        if (!Array.isArray(normalized.subRooms)) normalized.subRooms = [];
        if (!normalized.room || typeof normalized.room !== 'object') normalized.room = {};
        if (!normalized.meta || typeof normalized.meta !== 'object') normalized.meta = {};

        return normalized;
    },

    applySnapshot(snapshot, options = {}) {
        if (!snapshot) return false;

        this.room = snapshot.room || {};
        this.subRooms = Array.isArray(snapshot.subRooms) ? snapshot.subRooms : [];
        this.fileList = Array.isArray(snapshot.fileList) ? snapshot.fileList : [];
        this.photoList = this.fileList.filter(file => this.isImageFile(file.ftype));

        this.isOwner = snapshot.meta && snapshot.meta.isOwner !== undefined
            ? !!snapshot.meta.isOwner
            : (this.room && this.room.owner === 1);
        this.isDesktop = snapshot.meta && snapshot.meta.isDesktop !== undefined
            ? !!snapshot.meta.isDesktop
            : (this.room && this.room.top == 99);

        if (snapshot.meta && snapshot.meta.startMrid !== undefined) {
            this.startMrid = snapshot.meta.startMrid;
        }

        if (Array.isArray(snapshot.fullPath) && snapshot.fullPath.length > 0) {
            this.fullPath = snapshot.fullPath;
            this.fullPathMrid = String(this.mrid);
        } else {
            this.fullPath = null;
            this.fullPathMrid = null;
        }

        if (snapshot.directState && typeof snapshot.directState === 'object') {
            this.directDomain = snapshot.directState.directDomain || null;
            this.directProtocol = snapshot.directState.directProtocol || 'http://';
            this.directDomainReady = !!snapshot.directState.directDomainReady;
            this.directDirEnabled = !!snapshot.directState.directDirEnabled;
            this.directDirKey = snapshot.directState.directDirKey || null;
        }

        this.updateRoomUI();
        this.updateBreadcrumb();
        this.applyFolderPrivacyUI();
        this.applyFolderPublishUI();
        this.applyDirectSidebarUI();
        this.hideLoading();
        this.render();
        this.updateItemCount();

        if (options.trackView !== false) {
            this.trackRoomView();
        }

        if (snapshot._removedExpired) {
            this.persistCurrentSnapshot({ broadcast: false });
        }

        return true;
    },

    loadCachedRoomSnapshot(options = {}) {
        return this.readCacheSnapshot(this.mrid).then((snapshot) => {
            if (snapshot) {
                const savedAt = Number(snapshot.savedAt || 0);
                this._cacheSavedAt = savedAt || null;
                this.updateSidebarCacheInfo();
                console.log('[VX_FILELIST] IndexedDB cache hit:', {
                    savedAt: savedAt || null,
                    savedAtText: savedAt ? new Date(savedAt).toLocaleString() : null,
                    mrid: String(this.mrid)
                });
            } else {
                this._cacheSavedAt = null;
                this.updateSidebarCacheInfo();
            }
            const normalized = this.normalizeCacheSnapshot(snapshot);
            if (!normalized) return false;

            this.applySnapshot(normalized, options);
            return true;
        }).catch((error) => {
            console.warn('[VX_FILELIST] Failed to load cached snapshot:', error);
            return false;
        });
    },

    broadcastCacheUpdate(action, mrid) {
        if (!this._cacheChannel) return;
        try {
            this._cacheChannel.postMessage({
                type: 'vx-filelist-cache-update',
                action: action,
                mrid: String(mrid !== undefined && mrid !== null ? mrid : this.mrid),
                scope: this.getCacheScope()
            });
        } catch (error) {
            console.warn('[VX_FILELIST] Broadcast cache update failed:', error);
        }
    },

    handleCacheBroadcast(payload) {
        if (!payload || payload.type !== 'vx-filelist-cache-update') return;
        if (payload.scope !== this.getCacheScope()) return;
        if (String(payload.mrid) !== String(this.mrid)) return;
        if (this.refreshing) return;

        if (payload.action === 'delete') {
            this.fileList = [];
            this.photoList = [];
            this.subRooms = [];
            this.render();
            this.updateItemCount();
            return;
        }

        this.loadCachedRoomSnapshot({ trackView: false });
    },

    stopAllExpireTimers() {
        Object.keys(this._expireTimers).forEach((ukey) => {
            if (this._expireTimers[ukey]) {
                clearTimeout(this._expireTimers[ukey]);
                delete this._expireTimers[ukey];
            }
        });
    },

    rebuildExpireTimers() {
        this.stopAllExpireTimers();
        (this.fileList || []).forEach((file) => this.scheduleExpireCleanup(file));
    },

    scheduleExpireCleanup(file) {
        if (!file || !file.ukey) return;
        const isPermanent = Number(file.model) === 99;
        const lefttime = Number(file.lefttime) || 0;
        if (isPermanent || lefttime <= 0) return;

        const delay = Math.min(lefttime * 1000, 2147483647);
        this._expireTimers[file.ukey] = setTimeout(() => {
            delete this._expireTimers[file.ukey];
            this.removeFilesLocally([file.ukey], { persist: true, render: true, clearSelection: true });
        }, delay);
    },

    removeFilesLocally(ukeys, options = {}) {
        const target = new Set((Array.isArray(ukeys) ? ukeys : [ukeys]).map(item => String(item)));
        if (target.size === 0) return false;

        const nextFiles = (this.fileList || []).filter(file => !target.has(String(file.ukey)));
        if (nextFiles.length === (this.fileList || []).length) return false;

        this.fileList = nextFiles;
        this.photoList = this.fileList.filter(file => this.isImageFile(file.ftype));

        if (options.clearSelection !== false) {
            this.selectedItems = (this.selectedItems || []).filter(item => !(item.type === 'file' && target.has(String(item.id))));
            this.updateSelectionBar();
        }

        if (options.render !== false) {
            this.render();
            this.updateItemCount();
        }

        if (options.persist !== false) {
            this.persistCurrentSnapshot();
        }

        return true;
    },

    removeFoldersLocally(mrids, options = {}) {
        const target = new Set((Array.isArray(mrids) ? mrids : [mrids]).map(item => String(item)));
        if (target.size === 0) return false;

        const nextFolders = (this.subRooms || []).filter(folder => !target.has(String(folder.mr_id)));
        if (nextFolders.length === (this.subRooms || []).length) return false;

        this.subRooms = nextFolders;

        if (options.clearSelection !== false) {
            this.selectedItems = (this.selectedItems || []).filter(item => !(item.type === 'folder' && target.has(String(item.id))));
            this.updateSelectionBar();
        }

        if (options.render !== false) {
            this.render();
            this.updateItemCount();
        }

        if (options.persist !== false) {
            this.persistCurrentSnapshot();
        }

        return true;
    },

    updateFileLocally(ukey, updater, options = {}) {
        const file = (this.fileList || []).find(item => String(item.ukey) === String(ukey));
        if (!file) return false;

        updater(file);
        this.photoList = this.fileList.filter(item => this.isImageFile(item.ftype));

        if (options.patchRow !== false) {
            this._patchFileRow(ukey);
        }

        if (options.render) {
            this.render();
        }

        if (options.persist !== false) {
            this.persistCurrentSnapshot();
        }

        return true;
    },

    updateFolderLocally(mrid, updater, options = {}) {
        const folder = (this.subRooms || []).find(item => String(item.mr_id) === String(mrid));
        if (!folder) return false;

        updater(folder);

        if (options.render !== false) {
            this.render();
            this.updateItemCount();
        }

        if (options.persist !== false) {
            this.persistCurrentSnapshot();
        }

        return true;
    },

    insertFolderLocally(folder, options = {}) {
        if (!folder || folder.mr_id === undefined || folder.mr_id === null) return false;
        const exists = (this.subRooms || []).some(item => String(item.mr_id) === String(folder.mr_id));
        if (exists) return false;

        this.subRooms = [folder].concat(this.subRooms || []);

        if (options.render !== false) {
            this.render();
            this.updateItemCount();
        }

        if (options.persist !== false) {
            this.persistCurrentSnapshot();
        }

        return true;
    },

    normalizeCopyStyle(style) {
        switch (String(style || '').trim()) {
            case 'with_title':
            case '带有标题':
            case '包含文件名和链接':
                return 'with_title';
            case 'markdown':
            case 'markdown格式':
                return 'markdown';
            case 'plain_link':
            case '纯链接':
            default:
                return 'plain_link';
        }
    },

    getCopyStyle() {
        if (typeof TL !== 'undefined' && typeof TL.profile_copy_style_get === 'function') {
            return this.normalizeCopyStyle(TL.profile_copy_style_get());
        }
        return this.normalizeCopyStyle(localStorage.getItem('pref_copy_style') || 'plain_link');
    },

    escapeMarkdownLabel(label) {
        return String(label || '')
            .replace(/\\/g, '\\\\')
            .replace(/\[/g, '\\[')
            .replace(/\]/g, '\\]')
            .replace(/\r?\n/g, ' ');
    },

    getCopyTitle(name, itemType, style) {
        const title = String(name || '').trim();
        const copyStyle = this.normalizeCopyStyle(style || this.getCopyStyle());
        if (!title) return '';

        if (copyStyle === 'with_title') {
            if (itemType === 'folder') return `📁 ${title}`;
            if (itemType === 'file') return `📄 ${title}`;
        }

        return title;
    },

    formatCopyText(name, url, style, itemType) {
        const link = String(url || '').trim();
        const title = this.getCopyTitle(name, itemType, style);
        if (!link) return '';

        switch (this.normalizeCopyStyle(style || this.getCopyStyle())) {
            case 'with_title':
                return title ? `${title}\n${link}` : link;
            case 'markdown':
                return title ? `[${this.escapeMarkdownLabel(title)}](${link})` : link;
            case 'plain_link':
            default:
                return link;
        }
    },

    getCopyTextSeparator(style) {
        return this.normalizeCopyStyle(style || this.getCopyStyle()) === 'with_title' ? '\n\n' : '\n';
    },

    getSelectedItemsInDisplayOrder() {
        const selected = Array.isArray(this.selectedItems) ? this.selectedItems.slice() : [];
        if (selected.length <= 1) return selected;

        const ordered = [];
        const seen = {};
        const nodes = document.querySelectorAll('.vx-list-row.selected, .photo-card.selected');

        nodes.forEach((node) => {
            if (!node || !node.dataset) return;

            let type = '';
            let id = '';

            if (node.classList.contains('photo-card')) {
                type = 'file';
                id = node.dataset.ukey || '';
            } else {
                type = node.dataset.type || '';
                if (type === 'folder') {
                    id = node.dataset.mrid || '';
                } else if (type === 'file') {
                    id = node.dataset.ukey || '';
                }
            }

            if (!type || !id) return;

            const key = `${type}:${id}`;
            if (seen[key]) return;

            const match = selected.find((item) => item.type === type && String(item.id) === String(id));
            if (match) {
                ordered.push(match);
                seen[key] = true;
            }
        });

        selected.forEach((item) => {
            const key = `${item.type}:${item.id}`;
            if (!seen[key]) {
                ordered.push(item);
                seen[key] = true;
            }
        });

        return ordered;
    },

    copyText(text) {
        if (!text) return;
        VXUI.copyToClipboard(text);
    },

    /**
     * 按钮点击反馈：临时替换为 ok 图标，2 秒后恢复
     * @param {HTMLElement} [btn]
     */
    flashButtonOk(btn) {
        if (!btn) return;
        const icon = btn.querySelector('iconpark-icon');
        if (!icon) return;
        const orig = icon.getAttribute('name');
        icon.setAttribute('name', 'circle-check');
        btn.classList.add('vx-btn-ok-flash');
        setTimeout(() => {
            icon.setAttribute('name', orig);
            btn.classList.remove('vx-btn-ok-flash');
        }, 2000);
    },

    getFolderCopyName(mrid) {
        if (!mrid || String(mrid) === String(this.mrid)) {
            return (this.room && this.room.name) ? this.room.name : this.getRoomDisplayTitle();
        }
        const folder = (this.subRooms || []).find(item => String(item.mr_id) === String(mrid));
        return folder ? folder.name : '';
    },

    getFileCopyName(ukey) {
        const file = (this.fileList || []).find(item => String(item.ukey) === String(ukey));
        return file ? (file.fname_ex || file.fname || '') : '';
    },

    /**
     * 记录 UI 行为（event_ui）
     */
    trackUI(title) {
        try {
            if (!title) return;
            if (typeof VXUI !== 'undefined' && VXUI && typeof VXUI.trackUI === 'function') {
                VXUI.trackUI(title);
                return;
            }
            if (typeof TL !== 'undefined' && TL && typeof TL.ga === 'function') {
                TL.ga(title);
            }
        } catch (e) {
            // ignore
        }
    },

    /**
     * 记录当前目录/相册浏览
     */
    trackRoomView() {
        const name = this.getRoomDisplayTitle();
        const prefix = (this.viewMode === 'album') ? 'vui_photo' : 'vui_dir';
        this.trackUI(`${prefix}[${name}]`);
    },

    // ==================== Folder Direct (直链文件夹) ====================
    directDomain: null,
    directProtocol: 'http://',
    directDomainReady: false,
    directDirEnabled: false,
    directDirKey: null,
    directLoading: false,
    
    /**
     * 初始化模块
     */
    init(params = {}) {
        console.log('[VX_FILELIST] Initializing...', params);

        if (document.body) {
            document.body.classList.remove('vx-fl-initializing');
            // 清理可能遗留在 body 的旧的全局搜索弹窗，防止 SPA 同模块跳转时多开导致死锁
            document.querySelectorAll('body > .vx-gs-overlay').forEach(el => el.remove());
        }

        this.initCacheLayer();

        // 初始化排序管理器
        if (!this.sorter) {
            if (typeof VxSort !== 'undefined') {
                this.sorter = new VxSort({
                    key: 'vx_room_',
                    onSortChange: (by, type) => {
                         // 排序变更时，重新加载列表 (reset page to 0)
                        this.loadFileList(0);
                    }
                });
            } else {
                console.error('VxSort module not loaded');
            }
        }

        // 防止事件监听器重复绑定
        this.unbindEvents();
        this.hideContextMenu();

        const previousMrid = this.mrid;
        
        // 获取 mrid 参数（mrid=0 代表桌面，不能用 || 兜底）
        const hasMridParam = (params && Object.prototype.hasOwnProperty.call(params, 'mrid'));
        const targetMrid = hasMridParam ? params.mrid : (this.getUrlMrid() || 0);
        const hasWarmState = String(previousMrid) === String(targetMrid)
            && !!this.room
            && typeof this.room === 'object'
            && (Object.keys(this.room).length > 0
                || (Array.isArray(this.subRooms) && this.subRooms.length > 0)
                || (Array.isArray(this.fileList) && this.fileList.length > 0));

        // 获取 start 参数（非属主路径根），未传时默认当前目录
        const hasStartParam = (params && Object.prototype.hasOwnProperty.call(params, 'start'));
        const urlStart = this.getUrlStart();
        const targetStart = hasStartParam ? params.start : urlStart;
        this.startMrid = (targetStart !== undefined && targetStart !== null && String(targetStart) !== '')
            ? targetStart
            : targetMrid;

        if (String(previousMrid) !== String(targetMrid)) {
            this._cacheSavedAt = null;
        }
        
        // 检查登录状态：访问桌面(mrid=0)需要登录，访问子文件夹允许未登录（公开文件夹）
        const isDesktopAccess = String(targetMrid) === '0' || targetMrid === 0;
        if (isDesktopAccess && typeof TL !== 'undefined' && !TL.isLogin()) {
            VXUI.toastWarning(this.t('vx_need_login', '请先登录'));
            setTimeout(() => {
                app.open('/login');
            }, 300);
            return;
        }
        
        // mrid 已在上面获取
        this.mrid = targetMrid;
        
        // 获取视图模式参数或从存储恢复
        this.viewMode = params.view || localStorage.getItem('vx_view_mode') || 'list';
        this.gridSize = localStorage.getItem('vx_album_grid_size') || 'small';
        
        // 重置状态
        this.selectedItems = [];
        this.selectMode = false;
        this.lightboxOpen = false;

        if (!hasWarmState) {
            this.photoList = [];

            // reset direct state
            this.directDomain = null;
            this.directProtocol = 'http://';
            this.directDomainReady = false;
            this.directDirEnabled = false;
            this.directDirKey = null;
            this.directLoading = false;
        } else {
            this.photoList = (this.fileList || []).filter(file => this.isImageFile(file.ftype));
        }

        // reset folder privacy state
        this._privacyLoading = false;
        this._publishLoading = false;
        
        // 停止之前的同步检查
        this.stopAllSyncChecks();
        this.stopAllExpireTimers();
        
        // 初始化上传模块（预加载服务器列表）
        if (typeof VX_UPLOADER !== 'undefined') {
            VX_UPLOADER.init();
        }

        // 初始先隐藏骨架屏，是否显示由 loadRoom 根据是否需要远端请求决定。
        this.hideLoading();
        
        // 更新侧边栏
        this.updateSidebar();
        
        // 应用视图模式
        this.applyViewMode();

        if (hasWarmState) {
            this.updateRoomUI();
            this.updateBreadcrumb();
            this.applyFolderPrivacyUI();
            this.applyFolderPublishUI();
            this.applyDirectSidebarUI();
            this.render();
            this.updateItemCount();
        }
        
        // 加载文件夹数据
        this.loadRoom({ showLoading: !hasWarmState });
        
        // 绑定事件
        this.bindEvents();

        // 同步登录态显示（模块内容已加载）
        if (typeof VXUI !== 'undefined' && typeof VXUI.applyAuthVisibility === 'function') {
            VXUI.applyAuthVisibility();
        }
    },
    
    /**
     * 更新侧边栏内容
     */
    updateSidebar() {
        const tpl = document.getElementById('vx-filelist-sidebar-tpl');
        const container = document.getElementById('vx-sidebar-dynamic');
        
        if (!tpl || !container) return;
        
        // 克隆模板内容
        const content = tpl.content.cloneNode(true);
        container.innerHTML = '';
        container.appendChild(content);

        if (typeof VXUI !== 'undefined' && typeof VXUI.refreshSidebarDivider === 'function') {
            VXUI.refreshSidebarDivider();
        }

        // Translate dynamic sidebar content (language should be ready via VXUI core).
        if (typeof TL !== 'undefined' && typeof TL.tpl_lang === 'function') {
            TL.tpl_lang(container);
        }
        
        // 更新标题（桌面使用多语言）
        const title = this.getRoomDisplayTitle();
        const sidebarTitle = document.getElementById('vx-fl-sidebar-title');
        if (sidebarTitle) {
            sidebarTitle.textContent = title;
        }

        this.updateSidebarCacheInfo();
        this.setRefreshing(this.refreshing);

        // 同步直链侧边栏区域（模板每次都会被重建）
        this.applyDirectSidebarUI();

        // 同步文件夹公开/私有开关
        this.applyFolderPrivacyUI();

        // 同步文件夹发布开关
        this.applyFolderPublishUI();
        
        // 更新相册视图控制显示
        this.updateAlbumViewControls();

        if (document.body) {
            document.body.classList.add('vx-fl-active');
        }

        // 显示移动端视图切换按钮
        this.setMobileViewToggleVisible(true);

        // 显示移动端操作按钮（上传/新建）
        this.setMobileActionToggleVisible(true);

        // 显示移动端文件夹名称栏
        this.setMobileFolderBarVisible(true);
    },

    updateSidebarCacheInfo() {
        const cacheIconEl = document.getElementById('vx-fl-cache-icon');
        const cacheSavedAtEl = document.getElementById('vx-fl-cache-saved-at');
        const mobileCacheIconEl = document.getElementById('vx-mobile-cache-icon');
        const mobileCacheSavedAtEl = document.getElementById('vx-mobile-cache-saved-at');
        const hasCache = !!this._cacheSavedAt;
        const iconName = this.refreshing ? 'rotate' : (hasCache ? 'clock' : 'rotate');

        [cacheIconEl, mobileCacheIconEl].forEach((el) => {
            if (!el) return;
            el.setAttribute('name', iconName);
            if (this.refreshing) {
                el.setAttribute('spin', '');
            } else {
                el.removeAttribute('spin');
            }
        });

        const agoText = this._cacheSavedAt ? this.formatTimeAgo(this._cacheSavedAt) : '--';
        const diff = this._cacheSavedAt ? Math.floor((Date.now() - Number(this._cacheSavedAt)) / 1000) : -1;
        const fullText = this._cacheSavedAt
            ? (diff < 60 ? agoText : this.fmt('vx_cache_fetched_at', { time: agoText }, 'Data loaded {time}'))
            : '--';
        if (cacheSavedAtEl) cacheSavedAtEl.textContent = fullText;
        if (mobileCacheSavedAtEl) mobileCacheSavedAtEl.textContent = fullText;

        if (this._cacheSavedAt) {
            this.startCacheAgoTimer();
        } else {
            this.stopCacheAgoTimer();
        }
    },

    startCacheAgoTimer() {
        // 重启计时器，确保以当前时刻为起点每分钟刷新一次
        this.stopCacheAgoTimer();
        this._cacheAgoTimer = setInterval(() => {
            this.updateSidebarCacheInfo();
        }, 60000);
    },

    stopCacheAgoTimer() {
        if (this._cacheAgoTimer) {
            clearInterval(this._cacheAgoTimer);
            this._cacheAgoTimer = null;
        }
    },

    applyFolderPrivacyUI() {
        const section = document.getElementById('vx-fl-privacy-section');
        const toggle = document.getElementById('vx-fl-privacy-toggle');

        // 仅在文件夹（非桌面）且拥有者时展示
        const show = !!this.isOwner && !this.isDesktop && this.mrid && String(this.mrid) !== '0';
        if (section) section.style.display = show ? '' : 'none';
        if (!show) return;

        const current = (this.room && this.room.model === 'private') ? 'private' : 'public';

        if (toggle) {
            // checked = private (开=私有)
            toggle.checked = (current === 'private');
            toggle.disabled = !!this._privacyLoading;
        }
    },

    onFolderPrivacyToggleChange(checked) {
        const desired = checked ? 'private' : 'public';
        this.onFolderPrivacyChange(desired);
    },

    onFolderPrivacyChange(next) {
        const desired = (String(next) === 'private') ? 'private' : 'public';

        // 仅 owner 的非桌面文件夹可改
        const allowed = !!this.isOwner && !this.isDesktop && this.mrid && String(this.mrid) !== '0';
        if (!allowed) {
            VXUI.toastWarning(this.t('vx_no_permission', '无权限'));
            this.applyFolderPrivacyUI();
            return;
        }

        const current = (this.room && this.room.model === 'private') ? 'private' : 'public';
        if (desired === current) {
            this.applyFolderPrivacyUI();
            return;
        }

        const token = this.getToken();
        if (!token) {
            VXUI.toastError(this.t('vx_not_logged_in', '未登录'));
            this.applyFolderPrivacyUI();
            return;
        }

        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';

        this._privacyLoading = true;
        this.applyFolderPrivacyUI();

        $.post(apiUrl, {
            action: 'set_model',
            token: token,
            mr_id: this.mrid,
            model: desired
        }, (rsp) => {
            // Legacy-compatible: some backends return plain text instead of JSON.
            const isJson = rsp && typeof rsp === 'object';
            const ok = !isJson || (rsp.status === 1);

            if (ok) {
                if (!this.room || typeof this.room !== 'object') this.room = {};
                this.room.model = desired;
                VXUI.toastSuccess(this.t('vx_update_success', '修改成功'));
                return;
            }

            VXUI.toastError(this.t('vx_update_failed', '修改失败'));
        }).fail(() => {
            VXUI.toastError(this.t('vx_update_failed', '修改失败'));
        }).always(() => {
            this._privacyLoading = false;
            this.applyFolderPrivacyUI();
        });
    },

    applyFolderPublishUI() {
        const section = document.getElementById('vx-fl-publish-section');
        const toggle = document.getElementById('vx-fl-publish-toggle');

        // Show only if owner, not desktop, not root (0)
        const show = !!this.isOwner && !this.isDesktop && this.mrid && String(this.mrid) !== '0';
        if (section) section.style.display = show ? '' : 'none';
        if (!show) return;

        const isPublished = (this.room && this.room.publish === 'yes');

        if (toggle) {
            toggle.checked = isPublished;
            toggle.disabled = !!this._publishLoading;
        }
    },

    onFolderPublishToggleChange(checked) {
         if (this._publishLoading) return;
         
         const token = this.getToken();
         if (!token) {
             VXUI.toastError(this.t('vx_not_logged_in', '未登录'));
             this.applyFolderPublishUI();
             return;
         }

         const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';
         
         // Preserve existing sort options if available, otherwise default to "Name" (1) and "Asc" (1)
         const sort_by = (this.room && this.room.sort_by) !== undefined ? this.room.sort_by : 1;
         const sort_type = (this.room && this.room.sort_type) !== undefined ? this.room.sort_type : 1;
         const pf_publish = checked ? 'yes' : 'no';
         
         this._publishLoading = true;
         this.applyFolderPublishUI();

         $.post(apiUrl, {
             action: 'pf_set',
             token: token,
             mr_id: this.mrid,
             sort_by: sort_by,
             sort_type: sort_type,
             pf_publish: pf_publish
         }, (rsp) => {
             // Standard TMPLINK API response check
             if (rsp && rsp.status === 1) {
                  if (!this.room) this.room = {};
                  this.room.publish = pf_publish;
                  VXUI.toastSuccess(this.t('vx_update_success', '修改成功'));
             } else {
                  VXUI.toastError(this.t('vx_update_failed', '修改失败'));
             }
         }, 'json').fail(() => {
             VXUI.toastError(this.t('vx_update_failed', '修改失败'));
         }).always(() => {
             this._publishLoading = false;
             this.applyFolderPublishUI();
         });
    },

    getDesktopTitle() {
        return this.t('navbar_meetingroom', '桌面');
    },

    getRoomDisplayTitle() {
        const isDesktop = !!this.isDesktop || String(this.mrid) === '0' || (this.room && (this.room.top == 99 || String(this.room.mr_id) === '0'));
        if (isDesktop) return this.getDesktopTitle();
        return (this.room && this.room.name) ? this.room.name : this.getDesktopTitle();
    },
    
    /**
     * 更新相册视图控制区域显示
     */
    updateAlbumViewControls() {
        const albumControls = document.getElementById('vx-fl-album-controls');
        
        if (albumControls) {
            albumControls.style.display = this.viewMode === 'album' ? '' : 'none';
        }
        
        // 更新视图切换按钮状态
        const listBtn = document.getElementById('vx-fl-view-list');
        const albumBtn = document.getElementById('vx-fl-view-album');
        
        if (listBtn) listBtn.classList.toggle('active', this.viewMode === 'list');
        if (albumBtn) albumBtn.classList.toggle('active', this.viewMode === 'album');

        // 移动端视图切换按钮状态
        ['vx-mobile-view-list', 'vx-fl-mob-view-list'].forEach((id) => {
            const button = document.getElementById(id);
            if (button) button.classList.toggle('active', this.viewMode === 'list');
        });
        ['vx-mobile-view-album', 'vx-fl-mob-view-album'].forEach((id) => {
            const button = document.getElementById(id);
            if (button) button.classList.toggle('active', this.viewMode === 'album');
        });
        
        // 更新网格大小按钮状态
        const normalBtn = document.getElementById('view-normal');
        const smallBtn = document.getElementById('view-small');
        if (normalBtn) normalBtn.classList.toggle('active', this.gridSize === 'normal');
        if (smallBtn) smallBtn.classList.toggle('active', this.gridSize === 'small');
    },
    
    /**
     * 销毁模块 - 恢复侧边栏
     */
    destroy() {
        this.unbindEvents();
        this.hideContextMenu();
        this.closeLightbox();

        if (document.body) {
            document.body.classList.remove('vx-fl-active');
            document.body.classList.remove('vx-gs-no-scroll');
            // 清理可能脱离了 SPA 容器而遗留在 body 上的全局搜索弹窗，防止多开或污染
            const orphanedOverlays = document.querySelectorAll('body > .vx-gs-overlay');
            orphanedOverlays.forEach(el => el.remove());
        }

        // 停止上传队列刷新定时器
        this.stopUploadQueueRefresh();

        // 停止缓存时间刷新定时器
        this.stopCacheAgoTimer();

        // 停止本地过期清理定时器
        this.stopAllExpireTimers();

        // 隐藏移动端视图切换按钮
        this.setMobileViewToggleVisible(false);

        // 隐藏移动端操作按钮（上传/新建）
        this.setMobileActionToggleVisible(false);

        // 隐藏移动端文件夹名称栏
        this.setMobileFolderBarVisible(false);
        
        // 恢复静态导航
        const staticNav = document.getElementById('vx-sidebar-static');
        const container = document.getElementById('vx-sidebar-dynamic');
        
        if (staticNav) {
            staticNav.style.display = '';
        }
        if (container) {
            container.innerHTML = '';
        }
    },

    // ==================== 上传队列刷新 ====================

    /**
     * 启动上传队列刷新定时器
     * 定期更新"其它文件夹上传"提示条的进度
     */
    startUploadQueueRefresh() {
        this.stopUploadQueueRefresh();
        this._uploadRefreshTimer = setInterval(() => {
            if (typeof VX_UPLOADER !== 'undefined') {
                VX_UPLOADER.refreshOtherFolderBanner(this.mrid);
            }
        }, 3000);
    },

    /**
     * 停止上传队列刷新定时器
     */
    stopUploadQueueRefresh() {
        if (this._uploadRefreshTimer) {
            clearInterval(this._uploadRefreshTimer);
            this._uploadRefreshTimer = null;
        }
    },

    /**
     * 移动端顶部视图切换按钮显示/隐藏
     */
    setMobileViewToggleVisible(show) {
        ['vx-mobile-view-toggle', 'vx-fl-mob-view-toggle'].forEach((id) => {
            const toggle = document.getElementById(id);
            if (!toggle) return;
            toggle.style.display = show ? 'flex' : 'none';
        });
    },

    /**
     * 移动端顶部操作按钮显示/隐藏
     */
    setMobileActionToggleVisible(show) {
        ['vx-mobile-action-toggle', 'vx-fl-mob-action-toggle'].forEach((id) => {
            const toggle = document.getElementById(id);
            if (!toggle) return;
            toggle.style.display = show ? 'flex' : 'none';
        });
    },

    /**
     * 移动端文件夹名称栏显示/隐藏
     */
    setMobileFolderBarVisible(show) {
        ['vx-fl-mobile-folder-bar', 'vx-fl-mob-folder-bar'].forEach((id) => {
            const bar = document.getElementById(id);
            if (!bar) return;
            if (typeof window !== 'undefined' && window.matchMedia) {
                const isMobile = window.matchMedia('(max-width: 768px)').matches;
                bar.style.display = (show && isMobile) ? 'flex' : 'none';
                return;
            }
            bar.style.display = show ? 'flex' : 'none';
        });
    },
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 行内“更多”按钮（事件委托，避免 inline onclick 在部分环境失效）
        document.addEventListener('click', this._onMoreClick = (e) => {
            const btn = e && e.target && e.target.closest ? e.target.closest('.vx-more-btn') : null;
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            const row = btn.closest ? btn.closest('.vx-list-row') : null;
            if (!row) return;
            
            // 检查菜单是否已打开且是同一个目标，如果是则关闭
            const menu = document.getElementById('vx-fl-context-menu');
            if (menu && menu.classList.contains('show') && this.contextTarget === row) {
                this.hideContextMenu();
                return;
            }
            
            this.openMoreMenu(e, row);
        }, true);

        // 右键菜单（已禁用）
        document.addEventListener('contextmenu', this._onContextMenu = () => {
            return;
        });
        
        // 点击隐藏右键菜单（点击任何区域都关闭，更多按钮由 capture phase 的 _onMoreClick 处理）
        document.addEventListener('click', this._onDocClick = (e) => {
            // 更多按钮的点击已由 _onMoreClick 在 capture phase 处理并 stopPropagation
            // 所以这里不会收到更多按钮的点击事件，直接关闭菜单即可
            this.hideContextMenu();
        });
        
        // ESC 退出选择模式和灯箱
        document.addEventListener('keydown', this._onKeydown = (e) => {
            if (e.key === 'Escape') {
                if (this.lightboxOpen) {
                    this.closeLightbox();
                } else {
                    this.clearSelection();
                    this.hideContextMenu();
                }
            }
            // 灯箱快捷键
            if (this.lightboxOpen) {
                if (e.key === 'ArrowLeft') this.lightboxPrev();
                if (e.key === 'ArrowRight') this.lightboxNext();
            }
        });
        
        // 拖拽上传
        document.addEventListener('dragenter', this._onDragEnter = (e) => {
            e.preventDefault();
            e.stopPropagation();
            // 非所有者不显示拖拽上传提示
            if (!this.isOwner) return;
            this._dragCounter = (this._dragCounter || 0) + 1;
            const overlay = document.getElementById('vx-drag-overlay');
            if (overlay) overlay.classList.add('active');
        });
        
        document.addEventListener('dragleave', this._onDragLeave = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._dragCounter = (this._dragCounter || 1) - 1;
            if (this._dragCounter <= 0) {
                this._dragCounter = 0;
                const overlay = document.getElementById('vx-drag-overlay');
                if (overlay) overlay.classList.remove('active');
            }
        });
        
        document.addEventListener('dragover', this._onDragOver = (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        
        document.addEventListener('drop', this._onDrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._dragCounter = 0;
            const overlay = document.getElementById('vx-drag-overlay');
            if (overlay) overlay.classList.remove('active');
            
            // 非所有者不允许拖拽上传
            if (!this.isOwner) return;
            
            // 处理拖拽文件
            if (typeof VX_UPLOADER !== 'undefined') {
                VX_UPLOADER.current_mrid = this.mrid;
                VX_UPLOADER.handleDrop(e);
            }
        });
        
        // 粘贴上传
        document.addEventListener('paste', this._onPaste = (e) => {
            // 忽略在输入框中的粘贴
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            // 非所有者不允许粘贴上传
            if (!this.isOwner) return;
            
            if (typeof VX_UPLOADER !== 'undefined') {
                VX_UPLOADER.current_mrid = this.mrid;
                VX_UPLOADER.handlePaste(e);
            }
        });
        
        // 上传模态框拖拽区域
        const dropzone = document.getElementById('vx-upload-dropzone');
        if (dropzone) {
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('dragover');
            });
            dropzone.addEventListener('dragleave', () => {
                dropzone.classList.remove('dragover');
            });
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                if (typeof VX_UPLOADER !== 'undefined') {
                    VX_UPLOADER.current_mrid = this.mrid;
                    VX_UPLOADER.handleDrop(e);
                    VX_UPLOADER.closeModal();
                }
            });
        }
        
        // 窗口大小调整时重新计算文件名溢出
        window.addEventListener('resize', this._onResize = () => {
            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => {
                this.initFilenameScroll();
            }, 200);
        });
    },
    
    /**
     * 解绑事件
     */
    unbindEvents() {
        if (this._onResize) {
            window.removeEventListener('resize', this._onResize);
        }
        if (this._onMoreClick) {
            document.removeEventListener('click', this._onMoreClick, true);
        }
        if (this._onContextMenu) {
            document.removeEventListener('contextmenu', this._onContextMenu);
        }
        if (this._onDocClick) {
            document.removeEventListener('click', this._onDocClick);
        }
        if (this._onKeydown) {
            document.removeEventListener('keydown', this._onKeydown);
        }
        if (this._onDragEnter) {
            document.removeEventListener('dragenter', this._onDragEnter);
        }
        if (this._onDragLeave) {
            document.removeEventListener('dragleave', this._onDragLeave);
        }
        if (this._onDragOver) {
            document.removeEventListener('dragover', this._onDragOver);
        }
        if (this._onDrop) {
            document.removeEventListener('drop', this._onDrop);
        }
        if (this._onPaste) {
            document.removeEventListener('paste', this._onPaste);
        }
    },
    
    /**
     * 从 URL 获取 mrid
     */
    getUrlMrid() {
        if (typeof get_url_params === 'function') {
            const params = get_url_params();
            return params.mrid || 0;
        }
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('mrid') || 0;
    },

    /**
     * 从 URL 获取 start
     */
    getUrlStart() {
        if (typeof get_url_params === 'function') {
            const params = get_url_params();
            return params.start || '';
        }
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('start') || '';
    },
    
    /**
     * 设置视图模式
     */
    setViewMode(mode) {
        if (this.viewMode === mode) return;
        
        this.viewMode = mode;
        localStorage.setItem('vx_view_mode', mode);

        // 同步 URL（便于复制链接/下次直达 list/album 模式）
        if (typeof VXUI !== 'undefined' && VXUI && typeof VXUI.updateUrl === 'function') {
            const currentParams = (typeof VXUI.getUrlParams === 'function') ? (VXUI.getUrlParams() || {}) : {};
            delete currentParams.module;
            VXUI.updateUrl('filelist', {
                ...currentParams,
                mrid: this.mrid,
                view: this.viewMode
            });
            if (typeof VXUI.updateNavState === 'function') {
                VXUI.updateNavState('filelist', { mrid: this.mrid, view: this.viewMode });
            }
        }
        
        // 应用视图模式
        this.applyViewMode();

        // 记录视图切换后的浏览
        this.trackRoomView();
        
        // 重新渲染
        this.render();
        
        // 更新控制区域
        this.updateAlbumViewControls();
    },
    
    /**
     * 应用视图模式
     */
    applyViewMode() {
        const listContainer = document.getElementById('vx-fl-list');
        const albumContainer = document.getElementById('vx-fl-album');
        
        if (this.viewMode === 'list') {
            if (listContainer) listContainer.style.display = '';
            if (albumContainer) albumContainer.style.display = 'none';
        } else {
            if (listContainer) listContainer.style.display = 'none';
            if (albumContainer) albumContainer.style.display = '';
        }
        
        // 更新按钮状态
        this.updateAlbumViewControls();
    },
    
    /**
     * 设置网格大小（相册模式）
     */
    setGridSize(size) {
        this.gridSize = size;
        localStorage.setItem('vx_album_grid_size', size);
        
        // 应用网格大小
        const grid = document.getElementById('vx-fl-album-grid');
        if (grid) {
            grid.classList.remove('small', 'normal', 'large');
            if (size !== 'normal') {
                grid.classList.add(size);
            }
        }
        
        // 更新侧边栏按钮状态
        ['normal', 'large', 'small'].forEach(s => {
            const navItem = document.getElementById(`nav-grid-${s}`);
            const viewBtn = document.getElementById(`view-${s}`);
            if (navItem) navItem.classList.toggle('active', s === size);
            if (viewBtn) viewBtn.classList.toggle('active', s === size);
        });
    },
    
    /**
     * 显示/隐藏状态
     */
    showLoading() {
        const loading = document.getElementById('vx-fl-loading');
        const list = document.getElementById('vx-fl-list');
        const album = document.getElementById('vx-fl-album');
        const empty = document.getElementById('vx-fl-empty');
        
        if (loading) loading.style.display = 'flex';
        if (list) list.style.display = 'none';
        if (album) album.style.display = 'none';
        if (empty) empty.style.display = 'none';
    },
    
    hideLoading() {
        const loading = document.getElementById('vx-fl-loading');
        if (loading) loading.style.display = 'none';
    },
    
    /**
     * 获取 API Token
     */
    getToken() {
        if (typeof TL !== 'undefined' && TL.api_token) {
            return TL.api_token;
        }
        const stored = localStorage.getItem('app_token');
        if (stored) {
            return stored;
        }
        if (typeof getCookie === 'function') {
            return getCookie('token');
        }
        return null;
    },

    /**
     * 加载文件夹数据
     */
    loadRoom(options = {}) {
        const opts = options || {};
        const finalize = () => {
            if (opts.refreshing) {
                this.setRefreshing(false);
            }
        };

        const shouldShowLoading = opts.showLoading !== false;

        if (opts.refreshing) {
            this.setRefreshing(true);
        }

        // 获取 token（可能是登录用户的 token 或访客 token）
        // 访客也可以通过 TL.api_token 访问公开文件夹
        let token = this.getToken();
        if (!token && typeof TL !== 'undefined' && TL.api_token) {
            token = TL.api_token;
        }
        
        if (!token) {
            console.warn('[VX_FILELIST] No token available');
            this.hideLoading();
            this.showEmpty();
            finalize();
            return;
        }

        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';

        const fetchRemote = (remoteOptions = {}) => {
            const remoteOpts = remoteOptions || {};
            if (shouldShowLoading && !remoteOpts.silent) {
                this.showLoading();
            }

            $.post(apiUrl, {
                action: 'details',
                token: token,
                mr_id: this.mrid
            }, (rsp) => {
                if (rsp.status === 0) {
                    this.hideLoading();
                    this.showFolderNotFound();
                    this.deleteCacheSnapshot(this.mrid, { broadcast: false });
                    finalize();
                    return;
                }

                if (rsp.status === 3) {
                    VXUI.toastWarning(this.t('vx_need_login', '请先登录'));
                    setTimeout(() => {
                        app.open('/login');
                    }, 300);
                    finalize();
                    return;
                }

                // 保存文件夹信息
                this.room = rsp.data;
                this.isOwner = rsp.data.owner === 1;
                this.isDesktop = (rsp.data.top == 99);
                this.subRooms = rsp.data.sub_rooms || [];

                if (this.isOwner) {
                    this.startMrid = 0;
                }

                // 特殊处理桌面
                if (this.mrid == 0 || this.mrid === '0') {
                    this.isDesktop = true;
                    if (!this.room || typeof this.room !== 'object') {
                        this.room = {};
                    }
                    this.room.mr_id = 0;
                    this.room.top = 99;
                    this.room.parent = 0;
                    this.room.name = (typeof app !== 'undefined' && app.languageData && app.languageData.navbar_meetingroom)
                        ? app.languageData.navbar_meetingroom : '桌面';
                }

                this.updateRoomUI();
                this.loadFullPath();
                this.applyFolderPrivacyUI();
                this.applyFolderPublishUI();
                this.loadDirectFolderState();
                this.loadFileList(0, {
                    forceRemote: true,
                    onComplete: finalize,
                    persist: true,
                    trackView: remoteOpts.trackView !== false,
                    preserveCurrent: !!remoteOpts.preserveCurrent,
                    minRenderAt: remoteOpts.minRenderAt
                });
            }, 'json').fail(() => {
                this.hideLoading();
                if (!remoteOpts.silentError) {
                    VXUI.toastError(this.t('vx_load_failed', '加载失败'));
                }
                finalize();
            });
        };

        if (opts.forceRemote) {
            fetchRemote();
            return;
        }

        this.loadCachedRoomSnapshot().then((loaded) => {
            if (loaded) {
                const cacheSavedAt = Number(this._cacheSavedAt || 0);
                const cacheAge = cacheSavedAt ? (Date.now() - cacheSavedAt) : 0;
                const shouldRefreshInBackground = cacheSavedAt
                    && cacheAge >= this._staleCacheThresholdMs;

                if (shouldRefreshInBackground) {
                    const minRenderAt = Date.now() + this._cacheRepaintMinGapMs;
                    console.log('[VX_FILELIST] Stale cache hit, refreshing in background:', {
                        mrid: String(this.mrid),
                        cacheSavedAt: cacheSavedAt,
                        cacheAgeMs: cacheAge,
                        thresholdMs: this._staleCacheThresholdMs,
                        minRepaintGapMs: this._cacheRepaintMinGapMs,
                        minRenderAt: minRenderAt
                    });
                    fetchRemote({
                        trackView: false,
                        preserveCurrent: true,
                        silent: true,
                        silentError: true,
                        minRenderAt: minRenderAt
                    });
                }
                finalize();
                return;
            }
            fetchRemote();
        }).catch(() => {
            fetchRemote();
        });
    },

    /**
     * 加载完整路径（面包屑）
     */
    loadFullPath() {
        const currentMrid = this.mrid;
        const isDesktop = String(currentMrid) === '0' || currentMrid === 0;

        if (isDesktop) {
            this.fullPath = [{ id: '0', name: this.getDesktopTitle() }];
            this.fullPathMrid = String(currentMrid);
            this.updateBreadcrumb();
            this.persistCurrentSnapshot({ broadcast: false });
            return;
        }

        if (Array.isArray(this.fullPath) && this.fullPath.length > 0 && this.fullPathMrid) {
            const idx = this.fullPath.findIndex(item => String(item && item.id) === String(currentMrid));
            if (idx >= 0) {
                this.fullPath = this.fullPath.slice(0, idx + 1);
                this.fullPathMrid = String(currentMrid);
                this.updateBreadcrumb();
                return;
            }
        }

        let token = this.getToken();
        if (!token && typeof TL !== 'undefined' && TL.api_token) {
            token = TL.api_token;
        }

        if (!token) {
            this.fullPath = null;
            this.fullPathMrid = null;
            this.updateBreadcrumb();
            return;
        }

        const isLoggedIn = (typeof TL !== 'undefined' && TL.isLogin && TL.isLogin());
        let startMrid = currentMrid;

        if (this.isOwner && isLoggedIn) {
            startMrid = 0;
        } else if (this.startMrid !== null && this.startMrid !== undefined && String(this.startMrid) !== '') {
            startMrid = this.startMrid;
        }

        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';
        const reqId = ++this._fullPathReqId;

        $.post(apiUrl, {
            action: 'get_full_path',
            token: token,
            start: String(startMrid),
            current: String(currentMrid)
        }, (rsp) => {
            if (reqId !== this._fullPathReqId) return;
            if (rsp && rsp.status === 1 && Array.isArray(rsp.data) && rsp.data.length > 0) {
                this.fullPath = rsp.data;
                this.fullPathMrid = String(currentMrid);
            } else {
                this.fullPath = null;
                this.fullPathMrid = null;
            }
            this.updateBreadcrumb();
            this.persistCurrentSnapshot({ broadcast: false });
        }, 'json').fail(() => {
            if (reqId !== this._fullPathReqId) return;
            this.fullPath = null;
            this.fullPathMrid = null;
            this.updateBreadcrumb();
        });
    },

    /**
     * 设置刷新按钮状态
     */
    setRefreshing(on) {
        this.refreshing = !!on;

        this.updateSidebarCacheInfo();

        [document.getElementById('vx-fl-sidebar-refresh'), document.getElementById('vx-mobile-cache-refresh')].forEach((btn) => {
            if (!btn) return;
            if (this.refreshing) {
                btn.disabled = true;
                btn.dataset.refreshing = '1';
                btn.textContent = this.t('vx_refreshing', '刷新中');
            } else {
                btn.disabled = false;
                delete btn.dataset.refreshing;
                btn.textContent = this.t('album_refresh', '刷新');
            }
        });
    },
    
    /**
     * 更新文件夹 UI
     */
    updateRoomUI() {
        // 标题
        const title = this.getRoomDisplayTitle();
        
        const titleEl = document.getElementById('vx-fl-title');
        if (titleEl) titleEl.textContent = title;
        
        const sidebarTitle = document.getElementById('vx-fl-sidebar-title');
        if (sidebarTitle) sidebarTitle.textContent = title;
        
        document.title = title;
        
        // 如果上传器正在显示进度前缀，重新附加
        if (typeof VX_UPLOADER !== 'undefined' && VX_UPLOADER.hasActiveUploads()) {
            VX_UPLOADER._updateUploadIndicators();
        }
        
        // 更新面包屑
        this.updateBreadcrumb();
        
        // 显示/隐藏返回按钮
        const backBtn = document.getElementById('vx-fl-back-btn');
        const mobileBackBtns = [document.getElementById('vx-mobile-back'), document.getElementById('vx-fl-mob-back')];
        
        const isLoggedIn = (typeof TL !== 'undefined' && TL.isLogin && TL.isLogin());
        // 不在桌面时显示返回按钮，但未登录且父文件夹是桌面时隐藏
        const hasParent = this.room && this.room.parent && String(this.room.parent) !== '0';
        const hasStart = (this.startMrid !== null && this.startMrid !== undefined && String(this.startMrid) !== '');
        const isAtStart = hasStart && String(this.mrid) === String(this.startMrid);
        const showBack = this.mrid != 0 && (this.isOwner ? (isLoggedIn || hasParent) : !isAtStart);
        
        if (backBtn) {
            backBtn.style.display = showBack ? '' : 'none';
        }
        
        // 移动端 header: 显示后退按钮（菜单按钮始终显示）
        mobileBackBtns.forEach((button) => {
            if (button) button.style.display = showBack ? '' : 'none';
        });
        
        // 更新移动端顶部标题（保持为产品名）
        const mobileTitle = document.getElementById('vx-mobile-title');
        if (mobileTitle) {
            mobileTitle.textContent = this.t('product_name', '钛盘');
        }

        // 更新移动端文件夹名称栏
        // 确保移动端文件夹名称栏显示（仅移动端）
        this.setMobileFolderBarVisible(true);
        
        // 更新分享按钮显示（桌面隐藏）
        const shareBtn = document.getElementById('vx-fl-share-btn');
        if (shareBtn) {
            shareBtn.style.display = this.isDesktop ? 'none' : '';
        }

        // 更新顶部栏右侧的分享链接按钮
        // 逻辑：如果用户在某个子文件夹内，并且这个子文件夹不是私有文件夹，则显示
        const shareLnkBtn = document.getElementById('vx-fl-share-lnk-btn');
        if (shareLnkBtn) {
            const isPrivate = (this.room && this.room.model === 'private');
            const showShare = (!this.isDesktop && !isPrivate);
            shareLnkBtn.style.display = showShare ? '' : 'none';
        }
        
        // 根据是否为文件夹所有者控制上传/创建文件夹按钮的显示
        // 非所有者不应看到这些操作按钮
        document.querySelectorAll('[data-owner="true"]').forEach((el) => {
            el.style.display = this.isOwner ? '' : 'none';
        });

        // 举报按钮：仅在非拥有者且当前为文件夹时显示
        const reportBtn = document.getElementById('vx-fl-report-btn');
        if (reportBtn) {
            const mr_id = (this.room && this.room.mr_id !== undefined && this.room.mr_id !== null) ? this.room.mr_id : this.mrid;
            const top = (this.room && this.room.top !== undefined && this.room.top !== null) ? this.room.top : 0;
            const showReport = !this.isOwner && !this.isDesktop && mr_id && String(mr_id) !== '0' && Number(top) !== 99;
            reportBtn.style.display = showReport ? '' : 'none';
        }

        const mr_id = (this.room && this.room.mr_id !== undefined && this.room.mr_id !== null) ? this.room.mr_id : this.mrid;
        const top = (this.room && this.room.top !== undefined && this.room.top !== null) ? this.room.top : 0;
        const showReport = !this.isOwner && !this.isDesktop && mr_id && String(mr_id) !== '0' && Number(top) !== 99;

        ['vx-mobile-report-btn', 'vx-fl-mob-report-btn'].forEach((id) => {
            const button = document.getElementById(id);
            if (button) button.style.display = showReport ? '' : 'none';
        });

        ['vx-mobile-action-toggle', 'vx-fl-mob-action-toggle'].forEach((id) => {
            const actionToggle = document.getElementById(id);
            if (!actionToggle) return;
            if (showReport) {
                actionToggle.style.display = 'none';
                return;
            }
            const hasVisibleBtn = Array.from(actionToggle.querySelectorAll('[data-owner="true"]')).some((child) => child.style.display !== 'none');
            actionToggle.style.display = hasVisibleBtn ? 'flex' : 'none';
        });

        // 非属主模式下显示赞助者信息卡片
        this.applySponsorInfoUI();
    },

    /**
     * 非属主文件夹：显示赞助者信息卡片
     */
    applySponsorInfoUI() {
        const card = document.getElementById('vx-fl-sponsor-card');
        if (!card) return;

        const room = this.room || {};
        const shouldShow = !this.isOwner
            && room.ui_publish === 'yes'
            && room.ui_publish_status === 'ok'
            && room.ui_nickname;

        card.style.display = shouldShow ? '' : 'none';
        document.body.classList.toggle('vx-fl-has-sponsor', shouldShow);
        if (!shouldShow) return;

        const nicknameEl = card.querySelector('.userinfo_card_nickname');
        const avatarEl = card.querySelector('.userinfo_avatar_card_img');
        const proEl = card.querySelector('.userinfo_card_pro');
        const sdEl = card.querySelector('.userinfo_sd');

        if (nicknameEl) {
            nicknameEl.textContent = room.ui_nickname || '';
        }

        if (avatarEl) {
            if (room.ui_avatar_id) {
                avatarEl.src = `https://tmp-static.vx-cdn.com/static/avatar?id=${room.ui_avatar_id}`;
            } else {
                avatarEl.src = '/img/loading.svg';
            }
        }

        const isPro = room.ui_pro === 'yes';
        if (proEl) proEl.style.display = isPro ? '' : 'none';
        if (sdEl) sdEl.style.display = isPro ? 'none' : '';
        if (nicknameEl) nicknameEl.classList.toggle('is-pro', isPro);
    },

    // ==================== Folder Direct (直链文件夹) ====================
    applyDirectSidebarUI() {
        const section = document.getElementById('vx-fl-direct-section');
        const toggle = document.getElementById('vx-fl-direct-toggle');
        const disabled = document.getElementById('vx-fl-direct-disabled');
        const wrap = document.getElementById('vx-fl-direct-link-wrap');
        const linkEl = document.getElementById('vx-fl-direct-link');

        // 仅在文件夹（非桌面）且拥有者时展示
        const show = this.isOwner && !this.isDesktop && this.mrid && String(this.mrid) !== '0';
        if (section) section.style.display = show ? '' : 'none';
        if (!show) return;

        const domainReady = !!this.directDomainReady;

        if (toggle) {
            toggle.disabled = !domainReady;
            toggle.checked = !!this.directDirEnabled;
        }

        if (disabled) {
            disabled.style.display = domainReady ? 'none' : '';
        }

        const link = this.getFolderDirectLink();
        if (wrap) wrap.style.display = (domainReady && this.directDirEnabled && !!link) ? '' : 'none';
        if (linkEl) linkEl.textContent = link || '';
    },

    apiDirectPost(data) {
        return new Promise((resolve, reject) => {
            if (typeof TL === 'undefined') {
                reject(new Error('TL not ready'));
                return;
            }
            const token = this.getToken();
            if (token && !TL.api_token) {
                TL.api_token = token;
            }
            if (!token) {
                reject(new Error('token missing'));
                return;
            }
            const apiUrl = TL.api_direct ? TL.api_direct : '/api_v2/direct';
            $.post(apiUrl, { ...data, token: token }, (rsp) => resolve(rsp), 'json')
                .fail((xhr) => reject(xhr));
        });
    },

    async loadDirectFolderState() {
        // hide fast if not applicable
        const show = this.isOwner;
        if (!show) {
            this.directDomain = null;
            this.directDomainReady = false;
            this.directDirEnabled = false;
            this.directDirKey = null;
            this.applyDirectSidebarUI();
            this.persistCurrentSnapshot({ broadcast: false });
            return;
        }

        if (this.directLoading) return;
        this.directLoading = true;

        try {
            const details = await this.apiDirectPost({ action: 'details' });
            if (details && details.status === 1 && details.data) {
                const d = details.data;
                const rawDomain = d.domain;
                this.directDomain = (rawDomain && typeof rawDomain === 'string')
                    ? rawDomain.replace(/^https?:\/\//i, '')
                    : rawDomain;
                const ssl = d.ssl_status === 'yes';
                this.directProtocol = ssl ? 'https://' : 'http://';
                this.directDomainReady = !!(this.directDomain && this.directDomain !== 0);
            } else {
                this.directDomain = null;
                this.directDomainReady = false;
            }

            if (!this.directDomainReady) {
                this.directDirEnabled = false;
                this.directDirKey = null;
                this.applyDirectSidebarUI();
                this.persistCurrentSnapshot({ broadcast: false });
                return;
            }

            if (this.isDesktop || !this.mrid || String(this.mrid) === '0') {
                this.directDirEnabled = false;
                this.directDirKey = null;
            } else {
                const rsp = await this.apiDirectPost({ action: 'dir_details', mrid: this.mrid });
                if (rsp && rsp.status === 1) {
                    this.directDirEnabled = true;
                    this.directDirKey = rsp.data;
                } else {
                    this.directDirEnabled = false;
                    this.directDirKey = null;
                }
            }

            this.applyDirectSidebarUI();

            // 直链状态变化会影响文件操作按钮
            this.render();
            this.persistCurrentSnapshot({ broadcast: false });
        } catch (e) {
            console.error('[VX_FILELIST] loadDirectFolderState error:', e);
            this.directDomain = null;
            this.directDomainReady = false;
            this.directDirEnabled = false;
            this.directDirKey = null;
            this.applyDirectSidebarUI();
            this.persistCurrentSnapshot({ broadcast: false });
        } finally {
            this.directLoading = false;
        }
    },

    async toggleDirectForFolder() {
        const toggle = document.getElementById('vx-fl-direct-toggle');
        if (!toggle) return;

        this.trackUI('vui_filelist[toggle_direct]');
        if (!this.directDomainReady) {
            toggle.checked = false;
            VXUI.toastWarning(this.t('vx_bind_direct_domain_toast', '请先绑定直链域名'));
            return;
        }

        const wantEnable = !!toggle.checked;

        if (!wantEnable) {
            // disable
            VXUI.confirm({
                title: this.t('vx_direct_disable_title', '关闭文件夹直链'),
                message: this.t('vx_direct_disable_confirm', '确定要关闭此文件夹的直链分享吗？'),
                confirmClass: 'vx-btn-danger',
                onConfirm: async () => {
                    try {
                        await this.apiDirectPost({ action: 'del_dir', direct_key: this.directDirKey });
                        VXUI.toastSuccess(this.t('vx_closed', '已关闭'));
                        await this.loadDirectFolderState();
                    } catch (e) {
                        console.error(e);
                        VXUI.toastError(this.t('vx_operation_failed', '操作失败'));
                        toggle.checked = true;
                    }
                },
                onCancel: () => {
                    toggle.checked = true;
                }
            });
            return;
        }

        // enable
        try {
            const rsp = await this.apiDirectPost({ action: 'add_dir', mrid: this.mrid });
            if (rsp && rsp.status === 1) {
                VXUI.toastSuccess(this.t('vx_enabled', '已开启'));
                await this.loadDirectFolderState();
            } else {
                toggle.checked = false;
                VXUI.alert({
                    title: this.t('vx_enable_failed', '开启失败'),
                    message: this.t('vx_direct_not_configured_msg', '无法启用文件夹直链，因为您的账号尚未配置直链功能。')
                });
            }
        } catch (e) {
            console.error(e);
            // 失败时统一使用弹窗提示，增强可见性
            VXUI.alert({
                title: this.t('vx_enable_failed', '开启失败'),
                message: this.t('vx_operation_error', '操作发生错误，请稍后重试。')
            });
            toggle.checked = false;
        }
    },

    getFolderDirectLink() {
        if (!this.directDomainReady || !this.directDirEnabled || !this.directDirKey) return '';
        return `${this.directProtocol}${this.directDomain}/share/${this.directDirKey}/`;
    },

    copyFolderDirectLink() {
        const link = this.getFolderDirectLink();
        if (!link) {
            VXUI.toastWarning(this.t('vx_direct_not_enabled', '未开启文件夹直链'));
            return;
        }
        this.trackUI('vui_filelist[copy_folder_direct]');
        VXUI.copyToClipboard(link);
        VXUI.toastSuccess(this.t('vx_link_copied', '链接已复制'));
    },

    openFolderDirectLink() {
        const link = this.getFolderDirectLink();
        if (!link) {
            VXUI.toastWarning(this.t('vx_direct_not_enabled', '未开启文件夹直链'));
            return;
        }
        window.open(link, '_blank');
    },

    getDirectFileShareLink(file) {
        if (!this.directDomainReady || !this.directDirEnabled || !this.directDirKey) return '';
        const name = file && (file.fname_ex || file.fname) ? String(file.fname_ex || file.fname) : '';
        const encoded = encodeURIComponent(name);
        return `${this.directProtocol}${this.directDomain}/share/${this.directDirKey}/${encoded}`;
    },

    getDirectFileDownloadLink(dkey, filename) {
        if (!this.directDomainReady || !this.directDomain || !dkey) return '';
        const name = filename ? encodeURIComponent(String(filename)) : '';
        return `${this.directProtocol}${this.directDomain}/files/${dkey}/${name}`;
    },

    async copyDirectFileLinkByUkey(ukey) {
        const file = (this.fileList || []).find(f => String(f.ukey) === String(ukey));
        if (!file) {
            VXUI.toastError(this.t('vx_file_not_found', '文件不存在'));
            return;
        }
        this.trackUI('vui_filelist[copy_file_direct]');
        if (!this.directDomainReady || !this.directDomain) {
            VXUI.toastWarning(this.t('vx_bind_direct_domain_toast', '请先绑定直链域名'));
            return;
        }

        let link = this.getDirectFileShareLink(file);
        if (!link) {
            try {
                const rsp = await this.apiDirectPost({ action: 'add_link', ukey: file.ukey });
                if (rsp && rsp.status === 1 && Array.isArray(rsp.data) && rsp.data.length > 0) {
                    const item = rsp.data[0] || {};
                    const dkey = item.dkey || item.direct_key || item.key;
                    const name = item.name || item.fname || item.filename || (file.fname_ex || file.fname);
                    link = this.getDirectFileDownloadLink(dkey, name);
                }
            } catch (e) {
                console.error('[VX_FILELIST] add_link error:', e);
            }
        }

        if (!link) {
            VXUI.toastWarning(this.t('vx_operation_error', '操作发生错误，请稍后重试。'));
            return;
        }

        VXUI.copyToClipboard(link);
        VXUI.toastSuccess(this.t('vx_link_copied', '链接已复制'));
    },
    
    /**
     * 更新面包屑
     */
    updateBreadcrumb() {
        const container = document.getElementById('vx-fl-breadcrumb');
        const mobileContainer = document.getElementById('vx-fl-mob-breadcrumb') || document.getElementById('vx-fl-mobile-breadcrumb');
        if (!container) return;

        const isLoggedIn = (typeof TL !== 'undefined' && TL.isLogin && TL.isLogin());
        const desktopTitle = this.getDesktopTitle();
        let html = '';

        if (Array.isArray(this.fullPath) && this.fullPath.length > 0 && String(this.fullPathMrid) === String(this.mrid)) {
            const isOwner = !!this.isOwner && isLoggedIn;
            const list = [...this.fullPath];
            if (isOwner && list.length > 0 && String(list[0] && list[0].id) !== '0') {
                list.unshift({ id: '0', name: desktopTitle });
            }
            list.forEach((item, idx) => {
                const isLast = idx === list.length - 1;
                const id = (item && item.id !== undefined && item.id !== null) ? String(item.id) : '';
                const name = (item && item.name) ? String(item.name) : (id === '0' ? desktopTitle : '');

                if (!name && !id) return;

                if (html) {
                    html += '<span class="vx-breadcrumb-sep">›</span>';
                }

                // 所有项都添加 title 属性以便悬停显示完整名称
                if (!isLast) {
                    // 未登录时避免展示桌面链接（桌面需登录）
                    if (id === '0' && !isLoggedIn) {
                        html += `<span title="${this.escapeHtml(desktopTitle)}">${this.escapeHtml(desktopTitle)}</span>`;
                    } else {
                        html += `<a href="javascript:;" title="${this.escapeHtml(name)}" onclick="VX_FILELIST.openFolder('${this.escapeHtml(id)}')">${this.escapeHtml(name)}</a>`;
                    }
                } else {
                    html += `<span title="${this.escapeHtml(name)}">${this.escapeHtml(name)}</span>`;
                }
            });
        } else {
            // 未登录时不显示桌面链接（桌面需要登录才能访问）
            if (isLoggedIn) {
                html = `<a href="javascript:;" title="${this.escapeHtml(desktopTitle)}" onclick="VX_FILELIST.openFolder(0)">${this.escapeHtml(desktopTitle)}</a>`;
            }

            if (this.mrid != 0 && this.room.name) {
                if (html) {
                    html += '<span class="vx-breadcrumb-sep">›</span>';
                }
                html += `<span title="${this.escapeHtml(this.room.name)}">${this.escapeHtml(this.room.name)}</span>`;
            }
        }
        
        container.innerHTML = html;
        if (mobileContainer) {
            mobileContainer.innerHTML = html;
        }
    },
    
    /**
     * 设置排序
     * @param {number} column 0:时间, 1:名称, 2:大小
     */
    setSort(column) {
        if (this.sorter) {
            this.sorter.set(column);
        }
    },

    /**
     * 更新排序图标
     */
    updateSortIcons() {
        if (this.sorter) {
            this.sorter.updateIcons();
        }
    },

    /**
     * 清除所有排序偏好
     */
    clearAllSortSettings() {
        try {
            if (this.sorter) {
                 this.sorter.clearAll();
            } else {
                 // Fallback manually clearing
                 const toRemove = [];
                 for (let i = 0; i < localStorage.length; i++) {
                     const key = localStorage.key(i);
                     if (key && (key.startsWith('vx_room_sort_by_') || key.startsWith('vx_room_sort_type_'))) {
                         toRemove.push(key);
                     }
                 }
                 toRemove.forEach(key => localStorage.removeItem(key));
            }

            VXUI.toastSuccess(this.t('vx_sort_cleared', '排序设置已重置'));
            
            // 如果在文件列表页面，重置当前状态并刷新
            if (this.mrid !== undefined && this.sorter) {
                // Reset to default
                this.sorter.setRaw(0, 0); 
                this.loadFileList(0);
            }
        } catch (e) {
            console.error(e);
        }
    },

    /**
     * 加载文件列表
     */
    loadFileList(page, options = {}) {
        const opts = options || {};
        if (page === 0) {
            this.pageNumber = 0;
            if (opts.forceRemote && !opts.preserveCurrent) {
                this.fileList = [];
                this.photoList = [];
            }
        } else {
            this.pageNumber++;
        }

        // 优先使用当前内存中的状态，如果未初始化（page=0且可能是首次），则从 storage 读取
        if (page === 0) {
            // Load sort state for this room
            if (this.sorter) {
                const defaultBy = (this.room && this.room.sort_by) !== undefined ? this.room.sort_by : 0;
                const defaultType = (this.room && this.room.sort_type) !== undefined ? this.room.sort_type : 0;
                this.sorter.load(this.mrid, defaultBy, defaultType);
                setTimeout(() => this.updateSortIcons(), 0);
            }
        }

        if (!opts.forceRemote) {
            this.hideLoading();
            this.photoList = this.fileList.filter(file => this.isImageFile(file.ftype));
            this.render();
            this.updateItemCount();
            if (opts.trackView) {
                this.trackRoomView();
            }
            if (typeof opts.onComplete === 'function') {
                opts.onComplete();
            }
            return;
        }

        const token = this.getToken();
        if (!token) {
            this.hideLoading();
            this.render();
            if (typeof opts.onComplete === 'function') {
                opts.onComplete();
            }
            return;
        }

        const sortBy = this.sorter ? this.sorter.currentBy : 0;
        const sortType = this.sorter ? this.sorter.currentType : 0;

        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';
        
        const applyRemoteRender = (renderFn) => {
            const minRenderAt = Number(opts.minRenderAt || 0);
            const waitMs = Math.max(0, minRenderAt - Date.now());
            if (waitMs > 0) {
                console.log('[VX_FILELIST] Delayed repaint scheduled:', {
                    mrid: String(this.mrid),
                    waitMs: waitMs,
                    minRenderAt: minRenderAt,
                    now: Date.now()
                });
                setTimeout(renderFn, waitMs);
                return;
            }
            renderFn();
        };

        $.post(apiUrl, {
            action: 'file_list_page',
            mr_id: this.mrid,
            page: this.pageNumber,
            sort_by: sortBy,
            sort_type: sortType,
            token: token
        }, (rsp) => {
            applyRemoteRender(() => {
                this.hideLoading();

                if (rsp.status === 1 && rsp.data && rsp.data.length > 0) {
                    this.fileList = page === 0 ? rsp.data.slice() : this.fileList.concat(rsp.data);

                    // 提取图片文件用于相册模式
                    this.photoList = this.fileList.filter(file =>
                        this.isImageFile(file.ftype)
                    );
                } else if (page === 0) {
                    this.fileList = [];
                    this.photoList = [];
                }

                // 渲染
                this.render();

                // 更新项目数量
                this.updateItemCount();

                if (opts.trackView) {
                    this.trackRoomView();
                }

                if (page === 0 && opts.persist !== false) {
                    this.persistCurrentSnapshot();
                }

                if (typeof opts.onComplete === 'function') {
                    opts.onComplete();
                }
            });
            
        }, 'json').fail(() => {
            applyRemoteRender(() => {
                this.hideLoading();
                this.render();
                if (typeof opts.onComplete === 'function') {
                    opts.onComplete();
                }
            });
        });
    },
    
    /**
     * 判断是否是图片文件
     */
    isImageFile(ftype) {
        return this.imageExtensions.includes((ftype || '').toLowerCase());
    },
    
    /**
     * 构建图片 URL
     */
    buildImageUrl(photo, op, size) {
        const sid = photo && photo.sid;
        const sha1 = photo && photo.sha1;
        const ext = (photo && photo.ftype ? String(photo.ftype) : 'jpg').toLowerCase();

        if (!sid || !sha1) {
            return '';
        }

        return `https://img-${sid}.5t-cdn.com:998/${op}/${size}/${sha1}.${ext}`;
    },
    
    /**
     * 将格式化的大小字符串（如 "46.21 MB"）转换回字节数
     */
    parseSizeFromFormatted(sizeStr) {
        if (!sizeStr) return 0;
        const units = { 'B': 1, 'KB': 1024, 'MB': 1048576, 'GB': 1073741824, 'TB': 1099511627776 };
        const match = String(sizeStr).match(/^([\.\d]+)\s*(B|KB|MB|GB|TB)$/i);
        if (!match) return 0;
        return parseFloat(match[1]) * (units[match[2].toUpperCase()] || 1);
    },

    /**
     * 更新项目数量
     */
    updateItemCount() {
        const folderCount = this.subRooms ? this.subRooms.length : 0;
        const fileCount = this.fileList ? this.fileList.length : 0;
        const totalSize = this.fileList ? this.fileList.reduce((sum, f) => {
            const raw = Number(f.filesize) || Number(f.fsize);
            return sum + ((raw > 0 && !isNaN(raw)) ? raw : this.parseSizeFromFormatted(f.fsize_formated));
        }, 0) : 0;

        const folderCountEl = document.getElementById('vx-fl-folder-count');
        const fileCountEl = document.getElementById('vx-fl-file-count');
        const totalSizeEl = document.getElementById('vx-fl-total-size');
        const statsEl = document.getElementById('vx-sidebar-stats');

        if (statsEl) statsEl.style.display = 'flex';

        if (folderCountEl) {
            folderCountEl.textContent = folderCount;
            const parent = folderCountEl.closest('.vx-sidebar-stat-item');
            if (parent) parent.style.display = folderCount === 0 ? 'none' : 'flex';
        }
        if (fileCountEl) {
            fileCountEl.textContent = fileCount;
            const parent = fileCountEl.closest('.vx-sidebar-stat-item');
            if (parent) parent.style.display = fileCount === 0 ? 'none' : 'flex';
        }
        if (totalSizeEl) {
            totalSizeEl.textContent = this.formatSize(totalSize);
            const parent = totalSizeEl.closest('.vx-sidebar-stat-item');
            if (parent) parent.style.display = totalSize === 0 ? 'none' : 'flex';
        }
    },
    
    /**
     * 显示空状态
     */
    showEmpty() {
        const list = document.getElementById('vx-fl-list');
        const album = document.getElementById('vx-fl-album');
        const empty = document.getElementById('vx-fl-empty');
        
        if (list) list.style.display = 'none';
        if (album) album.style.display = 'none';
        if (empty) empty.style.display = 'flex';
    },

    /**
     * 显示“文件夹不存在”状态（替代弹窗提示）
     */
    showFolderNotFound() {
        const empty = document.getElementById('vx-fl-empty');
        if (!empty) {
            this.showEmpty();
            return;
        }

        const titleEl = empty.querySelector('.vx-empty-title');
        const textEl = empty.querySelector('.vx-empty-text');
        const btnEl = empty.querySelector('button');

        if (titleEl) titleEl.textContent = this.t('vx_folder_not_found', '文件夹不存在');
        if (textEl) textEl.textContent = this.t('vx_folder_not_found_desc', '该文件夹可能已删除或暂无访问权限');
        if (btnEl) btnEl.style.display = 'none';

        this.showEmpty();
    },
    
    /**
     * 渲染（根据当前视图模式）
     */
    render() {
        if (this.viewMode === 'list') {
            this.renderList();
        } else {
            this.renderAlbum();
        }
        this.rebuildExpireTimers();
    },
    
    /**
     * 对文件夹列表进行排序
     */
    sortSubRooms() {
        if (!this.subRooms || this.subRooms.length <= 1) return;
        if (!this.sorter) return;
        
        this.subRooms = this.sorter.sortArray(this.subRooms, {
            0: (a) => parseInt(a.ctime || 0),
            1: (a) => (a.name || a.mr_name || '').toLowerCase(),
            2: (a) => parseInt(a.file_count || 0)
        });
    },

    /**
     * 对文件列表进行客户端排序（修正服务端字典序问题）
     */
    sortFileList() {
        if (!this.fileList || this.fileList.length <= 1) return;
        if (!this.sorter) return;

        this.fileList = this.sorter.sortArray(this.fileList, {
            0: (a) => parseInt(a.ctime || a.time || 0),
            1: (a) => (a.fname_ex || a.fname || '').toLowerCase(),
            2: (a) => parseInt(a.fsize || 0)
        });

        // 同步更新相册用的 photoList
        if (this.photoList && this.photoList.length > 0) {
            this.photoList = this.sorter.sortArray(this.photoList, {
                0: (a) => parseInt(a.ctime || a.time || 0),
                1: (a) => (a.fname_ex || a.fname || '').toLowerCase(),
                2: (a) => parseInt(a.fsize || 0)
            });
        }
    },

    /**
     * 渲染列表视图
     */
    renderList() {
        // 先对文件夹和文件排序（自然排序，避免字典序混乱）
        this.sortSubRooms();
        this.sortFileList();

        const listContainer = document.getElementById('vx-fl-list');
        const albumContainer = document.getElementById('vx-fl-album');
        const listBody = document.getElementById('vx-fl-list-body');
        const empty = document.getElementById('vx-fl-empty');
        
        if (!listBody) return;
        
        listBody.innerHTML = '';
        
        const hasContent = (this.subRooms && this.subRooms.length > 0) || (this.fileList && this.fileList.length > 0);
        // 检查是否有活跃上传任务（包括当前文件夹和其它文件夹）
        const hasActiveUploads = typeof VX_UPLOADER !== 'undefined' && VX_UPLOADER.hasActiveUploads();
        
        if (!hasContent && !hasActiveUploads) {
            if (empty) empty.style.display = 'flex';
            if (listContainer) listContainer.style.display = 'none';
            if (albumContainer) albumContainer.style.display = 'none';
            return;
        }
        
        if (empty) empty.style.display = 'none';
        if (listContainer) listContainer.style.display = '';
        if (albumContainer) albumContainer.style.display = 'none';
        
        // 渲染文件夹
        if (this.subRooms && this.subRooms.length > 0) {
            this.subRooms.forEach(folder => {
                listBody.appendChild(this.createFolderRow(folder));
            });
        }
        
        // 渲染文件
        if (this.fileList && this.fileList.length > 0) {
            this.fileList.forEach(file => {
                listBody.appendChild(this.createFileRow(file));
            });
        }
        
        // 恢复上传队列显示：如果有正在上传的文件，重新渲染上传进度行
        if (typeof VX_UPLOADER !== 'undefined' && hasActiveUploads) {
            VX_UPLOADER.restoreUploadRows(this.mrid);
            this.startUploadQueueRefresh();
        } else {
            this.stopUploadQueueRefresh();
        }
        
        // 初始化剩余时间倒计时
        this.initLeftTimeCountdown();

        // 处理超长文件名滚动效果
        this.initFilenameScroll();

        // Translate any dynamic rows (e.g. folder type label)
        if (typeof TL !== 'undefined' && typeof TL.tpl_lang === 'function') {
            TL.tpl_lang(listBody);
        }

        // 重新绑定 tmpui 链接
        if (typeof app !== 'undefined' && typeof app.linkRebind === 'function') {
            app.linkRebind();
        }
        
        // 启动同步中文件的状态检查
        this.checkAllSyncingFiles();
    },
    
    /**
     * 渲染相册视图
     */
    renderAlbum() {
        // 先对文件夹和文件排序（自然排序，避免字典序混乱）
        this.sortSubRooms();
        this.sortFileList();

        const listContainer = document.getElementById('vx-fl-list');
        const albumContainer = document.getElementById('vx-fl-album');
        const albumGrid = document.getElementById('vx-fl-album-grid');
        const empty = document.getElementById('vx-fl-empty');
        
        if (!albumGrid) return;
        
        albumGrid.innerHTML = '';
        
        const hasContent = (this.subRooms && this.subRooms.length > 0) || (this.photoList && this.photoList.length > 0);
        // 检查是否有活跃上传任务
        const hasActiveUploads = typeof VX_UPLOADER !== 'undefined' && VX_UPLOADER.hasActiveUploads();
        
        if (!hasContent && !hasActiveUploads) {
            if (empty) empty.style.display = 'flex';
            if (listContainer) listContainer.style.display = 'none';
            if (albumContainer) albumContainer.style.display = 'none';
            return;
        }
        
        if (empty) empty.style.display = 'none';
        if (albumContainer) albumContainer.style.display = '';
        
        // 如果有活跃上传，同时显示列表视图以展示上传进度
        if (hasActiveUploads) {
            if (listContainer) listContainer.style.display = '';
        } else {
            if (listContainer) listContainer.style.display = 'none';
        }
        
        // 应用网格大小
        albumGrid.classList.remove('small', 'normal', 'large');
        if (this.gridSize !== 'normal') {
            albumGrid.classList.add(this.gridSize);
        }
        
        // 渲染文件夹
        this.renderAlbumFolders(albumGrid);
        
        // 渲染图片
        this.renderAlbumPhotos(albumGrid);
        
        // 绑定图片加载事件
        this.bindPhotoImageLoading();
        
        // 恢复上传队列显示：在相册模式下，上传进度行显示在列表视图中
        if (typeof VX_UPLOADER !== 'undefined' && hasActiveUploads) {
            VX_UPLOADER.restoreUploadRows(this.mrid);
            this.startUploadQueueRefresh();
        } else {
            this.stopUploadQueueRefresh();
        }
    },
    
    /**
     * 渲染相册文件夹
     */
    renderAlbumFolders(container) {
        if (!this.subRooms || this.subRooms.length === 0) return;
        
        const tpl = document.getElementById('tpl-vx-folder-card');
        if (!tpl) return;
        
        const template = tpl.innerHTML;
        
        this.subRooms.forEach(folder => {
            const name = folder.name || folder.mr_name || '未命名文件夹';
            const mrid = folder.mr_id;
            const count = folder.file_count || 0;
            
            const html = template
                .replace(/{mrid}/g, mrid)
                .replace(/{name}/g, this.escapeHtml(name))
                .replace(/{count}/g, count);
            
            container.insertAdjacentHTML('beforeend', html);
        });
    },
    
    /**
     * 渲染相册图片
     */
    renderAlbumPhotos(container) {
        if (!this.photoList || this.photoList.length === 0) return;
        
        const tpl = document.getElementById('tpl-vx-photo-card');
        if (!tpl) return;
        
        const template = tpl.innerHTML;
        const syncText = this.t('upload_sync_onprogress', '同步中...');
        
        this.photoList.forEach((photo, index) => {
            const name = photo.fname || '未命名';
            const fid = photo.ukey;
            const size = photo.fsize_formated || this.formatSize(photo.fsize || 0);
            const isSyncing = photo.sync === 1 || photo.sync === '1';
            const isNsfw = photo.nsfw === 'yes';
            const isRestricted = isNsfw && !this.isOwner;
            
            // 同步中的图片使用占位图，同步完成后再加载真实图片
            let thumbnail;
            if (isSyncing) {
                thumbnail = '/img/loading.svg';
            } else if (isRestricted) {
                thumbnail = '/img/nsfw.jpg';
            } else {
                thumbnail = this.buildImageUrl(photo, 'thumb', '800x600');
            }
            
            let html = template
                .replace(/{index}/g, index)
                .replace(/{fid}/g, fid)
                .replace(/{thumbnail}/g, thumbnail)
                .replace(/{name}/g, this.escapeHtml(name))
                .replace(/{size}/g, size);
            
            container.insertAdjacentHTML('beforeend', html);
            
            // 获取刚添加的卡片
            const card = container.querySelector(`.photo-card[data-index="${index}"]`);
            if (card) {
                card.dataset.ukey = fid;
                
                // 如果是受限内容，标记一下（可选，这里直接用状态判断即可）
                if (isRestricted) {
                    card.classList.add('vx-nsfw-restricted');
                }

                // 如果正在同步，添加同步中遮罩并保持 loading 状态
                if (isSyncing) {
                    // 保存真实的图片 URL 供同步完成后使用
                    card.dataset.realThumbnail = this.buildImageUrl(photo, 'thumb', '800x600');
                    
                    const overlay = document.createElement('div');
                    overlay.className = 'vx-photo-sync-overlay';
                    overlay.innerHTML = `
                        <img src="/img/loading-outline.svg" class="vx-sync-spinner" alt="syncing" />
                        <span class="vx-sync-text">${syncText}</span>
                    `;
                    card.appendChild(overlay);
                    this.startSyncCheck(fid);
                }
            }
        });
    },
    
    /**
     * 绑定图片加载事件
     */
    bindPhotoImageLoading() {
        document.querySelectorAll('.photo-card').forEach(card => {
            const img = card.querySelector('.photo-card-image');
            if (!img) return;
            
            const markLoaded = () => card.classList.add('is-loaded');
            
            img.addEventListener('load', markLoaded, { once: true });
            img.addEventListener('error', markLoaded, { once: true });
            
            if (img.complete) {
                markLoaded();
            }
        });
    },
    
    /**
     * 初始化剩余时间倒计时
     */
    initLeftTimeCountdown() {
        const lang = (typeof TL !== 'undefined' && TL.currentLanguage) ? TL.currentLanguage : 'cn';
        
        document.querySelectorAll('.vx-lefttime').forEach((el) => {
            const time = parseInt(el.getAttribute('data-tmplink-lefttime'), 10);
            const span = el.querySelector('span[id]');
            
            if (span && span.id && time > 0 && typeof countDown === 'function') {
                countDown(span.id, time, lang);
            }
        });
    },
    
    /**
     * 初始化超长文件名滚动效果
     * 移动端：对于不需要滚动的短文件名，添加 no-scroll 类禁用动画
     * 桌面端：对于溢出的文件名，添加 is-overflow 类启用悬停滚动，并设置动态滚动距离
     */
    initFilenameScroll() {
        const isMobile = window.innerWidth <= 768;
        
        // 在下一帧执行，确保DOM已渲染
        requestAnimationFrame(() => {
            document.querySelectorAll('.vx-list-filename').forEach((container) => {
                const link = container.querySelector('a');
                if (!link) return;
                
                // 检测文本是否溢出
                const containerWidth = container.offsetWidth;
                const linkWidth = link.scrollWidth;
                const isOverflow = linkWidth > containerWidth;
                
                if (isMobile) {
                    // 移动端：只有溢出时才启用滚动动画
                    if (isOverflow) {
                        link.classList.remove('no-scroll');
                        container.classList.add('is-overflow');
                        // 计算需要滚动的距离：文件名宽度 - 容器宽度 + 一点余量
                        const scrollDistance = linkWidth - containerWidth + 10;
                        link.style.setProperty('--scroll-distance', `-${scrollDistance}px`);
                    } else {
                        link.classList.add('no-scroll');
                        container.classList.remove('is-overflow');
                        link.style.removeProperty('--scroll-distance');
                    }
                } else {
                    // 桌面端：标记溢出状态，用于悬停时的动画，并设置动态滚动距离
                    if (isOverflow) {
                        container.classList.add('is-overflow');
                        // 计算需要滚动的距离：文件名宽度 - 容器宽度 + 一点余量
                        const scrollDistance = linkWidth - containerWidth + 20;
                        link.style.setProperty('--scroll-distance', `-${scrollDistance}px`);
                        // 根据滚动距离动态设置动画时长，确保滚动速度一致（约50px/s）
                        const duration = Math.max(3, Math.min(10, scrollDistance / 50));
                        link.style.setProperty('--scroll-duration', `${duration}s`);
                    } else {
                        container.classList.remove('is-overflow');
                        link.style.removeProperty('--scroll-distance');
                        link.style.removeProperty('--scroll-duration');
                    }
                }
            });
        });
    },
    
    /**
     * 构建文件夹分享链接
     */
    buildFolderShareUrl(mrid) {
        const domain = (typeof TL !== 'undefined' && TL.site_domain) ? TL.site_domain : location.host;
        const pathPrefix = this.viewMode === 'album' ? 'vx_photo' : 'vx_dir';
        return `https://${domain}/${pathPrefix}/${mrid}`;
    },

    /**
     * 格式化时间显示 (去除秒)
     */
    formatTime(timeStr) {
        if (!timeStr) return '--';
        if (typeof timeStr === 'string' && timeStr.length >= 16) {
            return timeStr.substring(0, 16);
        }
        return timeStr;
    },

    /**
     * 格式化日期显示 (仅日期)
     */
    formatDateOnly(timeStr) {
        if (!timeStr) return '--';
        if (typeof timeStr === 'string' && timeStr.length >= 10) {
            return timeStr.substring(0, 10);
        }
        return timeStr;
    },

    /**
     * 创建文件夹行
     */
    createFolderRow(folder) {
        const row = document.createElement('div');
        row.className = 'vx-list-row';
        row.dataset.type = 'folder';
        row.dataset.mrid = folder.mr_id;
        
        const iconInfo = this.getFolderIcon(folder);
        
        // 判断是否是文件夹的拥有者（基于每个文件夹的 type 属性）
        const isFolderOwner = folder.type === 'owner';
        // 是否是收藏的文件夹
        const isFavorite = folder.fav == 1;
        // 是否可以分享（公开或已发布的文件夹）
        const canShare = folder.publish === 'yes' || folder.model === 'public';
        
        // 构建操作按钮
        let actionsHtml = '';
        
        // 分享按钮 - 公开或已发布的文件夹显示
        if (canShare) {
            const shareUrl = this.buildFolderShareUrl(folder.mr_id);
            actionsHtml += `
                <button class="vx-list-action-btn" onclick="event.stopPropagation(); VX_FILELIST.shareFolder('${folder.mr_id}', '${this.escapeHtml(shareUrl)}', this)" title="分享">
                    <iconpark-icon name="share-from-square"></iconpark-icon>
                </button>
            `;
        }
        
        // 重命名和删除按钮 - 只有文件夹拥有者才能操作
        if (isFolderOwner) {
            actionsHtml += `
                <button class="vx-list-action-btn" onclick="event.stopPropagation(); VX_FILELIST.renameFolder('${folder.mr_id}')" title="重命名">
                    <iconpark-icon name="pen-to-square"></iconpark-icon>
                </button>
                <button class="vx-list-action-btn vx-action-danger" onclick="event.stopPropagation(); VX_FILELIST.deleteFolder('${folder.mr_id}')" title="删除">
                    <iconpark-icon name="trash"></iconpark-icon>
                </button>
            `;
        }
        
        // 收藏的文件夹显示取消收藏按钮
        if (isFavorite && !isFolderOwner) {
            actionsHtml += `
                <button class="vx-list-action-btn vx-action-danger" onclick="event.stopPropagation(); VX_FILELIST.unfavoriteFolder('${folder.mr_id}')" title="取消收藏">
                    <iconpark-icon name="trash"></iconpark-icon>
                </button>
            `;
        }
        
        // 更多按钮 (用于移动端)
        if (isFolderOwner || canShare || isFavorite) {
            actionsHtml += `
                <button type="button" class="vx-list-action-btn vx-more-btn" onclick="event.stopPropagation(); VX_FILELIST.openFolderMoreMenu(event, '${folder.mr_id}', ${isFolderOwner}, ${canShare}, ${isFavorite})" title="更多">
                    <iconpark-icon name="ellipsis"></iconpark-icon>
                </button>
            `;
        }
        
        // 移动端未登录时不显示多选框
        const showCheckbox = this.canUseSelectMode();
        
        row.innerHTML = `
            ${showCheckbox ? '<div class="vx-list-checkbox" onclick="event.stopPropagation(); VX_FILELIST.toggleItemSelect(this.parentNode)"></div>' : ''}
            <div class="vx-list-name">
                <div class="vx-list-icon vx-icon-folder">
                    <iconpark-icon name="${iconInfo.icon}" class="${iconInfo.color}"></iconpark-icon>
                </div>
                <div class="vx-list-filename">
                    <a href="javascript:;" onclick="event.stopPropagation(); VX_FILELIST.openFolder('${folder.mr_id}')">${this.escapeHtml(folder.name)}</a>
                </div>
            </div>
            <div class="vx-list-size">
                <span class="vx-type-folder" data-tpl="filelist_dir">文件夹</span>
            </div>
            <div class="vx-list-date vx-hide-mobile" title="${this.formatTime(folder.ctime)}">
                ${this.formatDateOnly(folder.ctime)}
            </div>
            <div class="vx-list-actions">
                ${actionsHtml}
            </div>
        `;
        
        row.onclick = () => this.openFolder(folder.mr_id);
        
        return row;
    },
    
    /**
     * 获取文件夹图标
     */
    getFolderIcon(folder) {
        if (folder.model === 'private') {
            return { icon: 'folder-lock-one', color: 'text-azure' };
        }
        if (folder.publish === 'yes') {
            return { icon: 'folder-conversion-one', color: 'text-yellow' };
        }
        return { icon: 'folder-open-e1ad2j7l', color: '' };
    },
    
    /**
     * 创建文件行
     */
    createFileRow(file) {
        const row = document.createElement('div');
        row.className = 'vx-list-row';
        row.dataset.type = 'file';
        row.dataset.ukey = file.ukey;
        
        const iconInfo = this.getFileIcon(file.ftype);
        const lefttimeId = `lefttime_${file.ukey}`;
        const isPermanent = Number(file.model) === 99;
        
        // 判断文件是否正在同步中
        const isSyncing = file.sync === 1 || file.sync === '1';
        
        // 移动端未登录时不显示多选框
        const showCheckbox = this.canUseSelectMode();
        
        // 同步状态文字
        const syncText = this.t('upload_sync_onprogress', '同步中...');

        // 检查是否为图片文件（用于显示缩略图）
        const isImage = this.isImageFile(file.ftype);
        const isNsfw = file.nsfw === 'yes';
        // 如果是 NSFW 且不是拥有者，则视为受限内容
        const isRestricted = isNsfw && !this.isOwner;

        let iconHtml = '';
        let filenameLink = '';

        if (isImage && !isSyncing) {
            if (isRestricted) {
                // NSFW 受限内容：显示占位图，不可预览
                iconHtml = `
                    <div class="vx-list-thumb">
                        <img src="/img/nsfw.jpg" alt="NSFW">
                    </div>
                `;
                // 恢复普通链接（不触发预览）
                filenameLink = `<a href="/file?ukey=${file.ukey}" tmpui-app="true" target="_blank" onclick="event.stopPropagation();">${this.escapeHtml(file.fname)}</a>`;
            } else {
                // 正常图片：显示缩略图，可预览
                // 使用 thumb 操作和 64x64 尺寸
                const thumbUrl = this.buildImageUrl(file, 'thumb', '64x64');
                iconHtml = `
                    <div class="vx-list-thumb" onclick="event.stopPropagation(); VX_FILELIST.previewImage('${file.ukey}')">
                        <img src="${thumbUrl}" alt="" loading="lazy">
                    </div>
                `;
                // 图片文件名点击预览
                filenameLink = `<a href="javascript:;" class="vx-filename-preview" onclick="event.stopPropagation(); VX_FILELIST.previewImage('${file.ukey}')">${this.escapeHtml(file.fname)}</a>`;
            }
        } else {
            // 非图片或同步中：显示图标
            iconHtml = `
                <div class="vx-list-icon ${iconInfo.class}">
                    <iconpark-icon name="${iconInfo.icon}"></iconpark-icon>
                </div>
            `;
            // 普通文件点击打开
            filenameLink = `<a href="/file?ukey=${file.ukey}" tmpui-app="true" target="_blank" onclick="event.stopPropagation();">${this.escapeHtml(file.fname)}</a>`;
        }
        
        // 售价标记（for_sale=true 时显示）
        const priceTag = (file.for_sale && file.price > 0)
            ? `<span class="vx-price-tag" title="${this.t('vx_file_for_sale', '付费文件')}: ${file.price} ${this.t('vx_points', '点数')}">
                   <iconpark-icon name="funds"></iconpark-icon>${file.price}
               </span>`
            : '';
        // 购买状态标记（purchased=false 且 for_sale=true 时标记为「待购买」）
        const unpurchasedTag = (file.for_sale && file.purchased === false)
            ? `<span class="vx-unpurchased-tag">${this.t('vx_unpurchased', '未购买')}</span>`
            : '';

        row.innerHTML = `
            ${showCheckbox ? '<div class="vx-list-checkbox" onclick="event.stopPropagation(); VX_FILELIST.toggleItemSelect(this.parentNode)"></div>' : ''}
            <div class="vx-list-name">
                ${iconHtml}
                <div class="vx-list-filename">
                    ${filenameLink}
                    ${file.hot > 0 ? '<span class="vx-hot-badge"><iconpark-icon name="fire"></iconpark-icon></span>' : ''}
                    ${file.like > 0 ? `<span class="vx-like-badge"><iconpark-icon name="like"></iconpark-icon>${file.like}</span>` : ''}
                    ${priceTag}
                    ${unpurchasedTag}
                    ${(file.lefttime > 0 && !isPermanent) ? `
                        <span class="vx-lefttime" data-tmplink-lefttime="${file.lefttime}">
                            <iconpark-icon name="clock"></iconpark-icon>
                            <span id="${lefttimeId}">--</span>
                        </span>
                    ` : ''}
                </div>
            </div>
            <div class="vx-list-size">
                ${file.fsize_formated || this.formatSize(file.fsize || 0)}
            </div>
            <div class="vx-list-date vx-hide-mobile" title="${this.formatTime(file.ctime)}">
                ${this.formatDateOnly(file.ctime)}
            </div>
            <!-- 正常状态的操作按钮 -->
            <div class="vx-list-actions vx-file-ok" data-ukey="${file.ukey}" style="${isSyncing ? 'display: none !important;' : ''}">
                <button class="vx-list-action-btn" data-role="download-btn" data-ukey="${file.ukey}" onclick="event.stopPropagation(); VX_FILELIST.downloadFile('${file.ukey}')" title="下载">
                    <iconpark-icon name="cloud-arrow-down"></iconpark-icon>
                </button>
                <button class="vx-list-action-btn" onclick="event.stopPropagation(); VX_FILELIST.shareFile('${file.ukey}', this)" title="${this.t('on_select_share', '复制分享链接')}">
                    <iconpark-icon name="share-from-square"></iconpark-icon>
                </button>
                ${(this.isOwner && this.directDomainReady && this.directDirEnabled && this.directDirKey) ? `
                    <button class="vx-list-action-btn" onclick="event.stopPropagation(); VX_FILELIST.copyDirectFileLinkByUkey('${file.ukey}')" title="复制直链">
                        <iconpark-icon name="copy"></iconpark-icon>
                    </button>
                ` : ''}
                ${this.isOwner ? `
                    <button type="button" class="vx-list-action-btn vx-more-btn" onclick="event.stopPropagation(); VX_FILELIST.openMoreMenu(event, this.closest('.vx-list-row'))" title="更多">
                        <iconpark-icon name="ellipsis"></iconpark-icon>
                    </button>
                ` : ''}
            </div>
            <!-- 同步中状态的操作按钮 -->
            <div class="vx-list-actions vx-file-sync" data-ukey="${file.ukey}" style="${isSyncing ? '' : 'display: none !important;'}">
                <span class="vx-sync-status">
                    <img src="/img/loading-outline.svg" class="vx-sync-spinner" alt="syncing" />
                    <span class="vx-sync-text">${syncText}</span>
                </span>
                ${this.isOwner ? `
                    <button type="button" class="vx-list-action-btn vx-more-btn" onclick="event.stopPropagation(); VX_FILELIST.openMoreMenu(event, this.closest('.vx-list-row'))" title="更多">
                        <iconpark-icon name="ellipsis"></iconpark-icon>
                    </button>
                ` : ''}
            </div>
        `;
        
        // 如果文件正在同步，启动轮询检查
        if (isSyncing) {
            this.startSyncCheck(file.ukey);
        }
        
        return row;
    },

    /**
     * 预览图片（模态框方式）
     */
    previewImage(ukey) {
        this._previewClosing = false;
        const file = (this.fileList || []).find(f => String(f.ukey) === String(ukey));
        if (!file) return;

        let modal = document.getElementById('vx-preview-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'vx-preview-modal';
            modal.className = 'vx-preview-modal';
            modal.innerHTML = `
                <div class="vx-preview-content" onclick="event.stopPropagation()">
                    <div class="vx-preview-close" onclick="VX_FILELIST.closePreview()">
                        <iconpark-icon name="circle-xmark"></iconpark-icon>
                    </div>
                    <div class="vx-preview-loading" id="vx-preview-loading">
                        <img src="/img/loading-outline.svg" class="vx-sync-spinner" alt="loading" />
                    </div>
                    <img class="vx-preview-image" id="vx-preview-image" src="" alt="" style="opacity: 0">
                    <div class="vx-preview-details" id="vx-preview-details"></div>
                </div>
            `;
            modal.onclick = (e) => {
                if (e.target === modal) this.closePreview();
            };
            document.body.appendChild(modal);
        }

        const img = modal.querySelector('#vx-preview-image');
        const loading = modal.querySelector('#vx-preview-loading');
        const details = modal.querySelector('#vx-preview-details');
        
        if (loading) {
            loading.style.display = 'flex';
            loading.style.opacity = '1';
        }
        if (img) {
            // Reset state
            img.classList.remove('loaded');
            // Remove inline style that might conflict
            img.style.opacity = ''; 
            img.src = ''; 
            
            // 使用大图预览
            const url = this.buildImageUrl(file, 'thumb', '1024x768'); 
            img.src = url;

            img.onload = () => {
                if (loading) {
                    loading.style.opacity = '0';
                    setTimeout(() => { if(loading) loading.style.display = 'none'; }, 200);
                }
                img.classList.add('loaded');
                if (details) details.classList.add('visible'); // Show details when image loaded
            };
            img.onerror = () => {
                if (loading) loading.style.display = 'none';
                if (!this._previewClosing) {
                    VXUI.toastError(this.t('vx_load_failed', '图片加载失败'));
                }
            };
        }

        if (details) {
            details.textContent = `${file.fname} (${file.fsize_formated || this.formatSize(file.fsize)})`;
            details.classList.remove('visible'); // Hide initially
        }

        // Reset closing class if exists
        modal.classList.remove('closing');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; 
    },

    closePreview() {
        this._previewClosing = true;
        const modal = document.getElementById('vx-preview-modal');
        if (modal) {
            modal.classList.add('closing');
            
            // Wait for animation to finish
            setTimeout(() => {
                modal.classList.remove('active');
                modal.classList.remove('closing');
                const img = modal.querySelector('#vx-preview-image');
                if (img) {
                    img.src = '';
                    img.classList.remove('loaded');
                }
            }, 250); // Matches CSS animation duration
        }
        document.body.style.overflow = '';
    },
    
    /**
     * 获取文件图标
     */
    getFileIcon(ftype) {
        const type = String(ftype || '').toLowerCase().replace('.', '').trim();

        // 优先使用 tmplink.js 提供的通用图标映射
        let icon = null;
        if (typeof TL !== 'undefined' && typeof TL.fileicon === 'function') {
            icon = TL.fileicon(type);
        }

        // 兜底：保持旧行为（避免 TL 未加载时图标丢失）
        if (!icon) {
            const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
            const videoTypes = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'];
            const audioTypes = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
            const docTypes = ['doc', 'docx', 'pdf', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];
            const archiveTypes = ['zip', 'rar', '7z', 'tar', 'gz'];
            const codeTypes = ['js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'css', 'html', 'json'];

            if (imageTypes.includes(type)) icon = 'file-image';
            else if (videoTypes.includes(type)) icon = 'file-video';
            else if (audioTypes.includes(type)) icon = 'file-music';
            else if (docTypes.includes(type)) icon = 'file-word';
            else if (archiveTypes.includes(type)) icon = 'file-zipper';
            else if (codeTypes.includes(type)) icon = 'file-code';
            else icon = 'file-lines';
        }

        // VXUI 现有颜色/样式 class 映射（仅用于样式，不参与图标选择）
        let cls = 'vx-icon-file';
        if (icon === 'file-image') cls = 'vx-icon-image';
        else if (icon === 'file-video') cls = 'vx-icon-video';
        else if (icon === 'file-music') cls = 'vx-icon-audio';
        else if (icon === 'file-zipper') cls = 'vx-icon-archive';
        else if (icon === 'file-code') cls = 'vx-icon-code';
        else if (['file-word', 'file-excel', 'file-powerpoint', 'file-pdf'].includes(icon)) cls = 'vx-icon-document';

        return { icon, class: cls };
    },

    // ==================== 文件同步状态检查 ====================
    
    /**
     * 启动文件同步状态检查
     * @param {string} ukey - 文件唯一标识
     */
    startSyncCheck(ukey) {
        // 如果已经有定时器在检查这个文件，不重复创建
        if (this._syncCheckTimers[ukey]) {
            return;
        }
        
        this._syncCheckTimers[ukey] = setTimeout(() => {
            this.checkFileSync(ukey);
        }, 5000);
    },
    
    /**
     * 检查文件同步状态
     * @param {string} ukey - 文件唯一标识
     */
    checkFileSync(ukey) {
        const token = this.getToken();
        if (!token) {
            delete this._syncCheckTimers[ukey];
            return;
        }
        
        const apiUrl = (typeof TL !== 'undefined' && TL.api_file) ? TL.api_file : '/api_v2/file';
        
        $.post(apiUrl, {
            action: 'is_file_ok',
            token: token,
            ukey: ukey
        }, (rsp) => {
            if (rsp.status === 1) {
                // 文件同步完成，更新 UI
                this.onFileSyncComplete(ukey);
                delete this._syncCheckTimers[ukey];
            } else {
                // 继续轮询
                this._syncCheckTimers[ukey] = setTimeout(() => {
                    this.checkFileSync(ukey);
                }, 5000);
            }
        }, 'json').fail(() => {
            // 请求失败，稍后重试
            this._syncCheckTimers[ukey] = setTimeout(() => {
                this.checkFileSync(ukey);
            }, 10000);
        });
    },
    
    /**
     * 文件同步完成时的回调
     * @param {string} ukey - 文件唯一标识
     */
    onFileSyncComplete(ukey) {
        // 更新内部数据
        const file = this.fileList.find(f => f.ukey === ukey);
        if (file) {
            file.sync = 0;
        }

        this.persistCurrentSnapshot({ broadcast: false });
        
        // 更新列表视图 UI
        const okEl = document.querySelector(`.vx-file-ok[data-ukey="${ukey}"]`);
        const syncEl = document.querySelector(`.vx-file-sync[data-ukey="${ukey}"]`);
        
        if (okEl) {
            okEl.style.display = '';
        }
        if (syncEl) {
            syncEl.style.display = 'none';
        }
        
        // 更新相册视图 UI（如果在相册模式下）
        const albumCard = document.querySelector(`.photo-card[data-ukey="${ukey}"]`);
        if (albumCard) {
            // 移除同步遮罩
            const syncOverlay = albumCard.querySelector('.vx-photo-sync-overlay');
            if (syncOverlay) {
                syncOverlay.remove();
            }
            
            // 加载真实的图片
            const realThumbnail = albumCard.dataset.realThumbnail;
            if (realThumbnail) {
                const img = albumCard.querySelector('.photo-card-image');
                if (img) {
                    // 显示加载中状态
                    albumCard.classList.remove('is-loaded');
                    
                    // 设置真实图片 URL
                    img.src = realThumbnail;
                    
                    // 图片加载完成后标记
                    const markLoaded = () => albumCard.classList.add('is-loaded');
                    img.addEventListener('load', markLoaded, { once: true });
                    img.addEventListener('error', markLoaded, { once: true });
                    
                    if (img.complete) {
                        markLoaded();
                    }
                }
                
                // 清除临时数据
                delete albumCard.dataset.realThumbnail;
            }
        }
    },
    
    /**
     * 停止所有同步检查（页面切换或模块销毁时调用）
     */
    stopAllSyncChecks() {
        Object.keys(this._syncCheckTimers).forEach(ukey => {
            if (this._syncCheckTimers[ukey]) {
                clearTimeout(this._syncCheckTimers[ukey]);
                delete this._syncCheckTimers[ukey];
            }
        });
    },
    
    /**
     * 检查并启动所有同步中文件的轮询
     */
    checkAllSyncingFiles() {
        this.fileList.forEach(file => {
            if (file.sync === 1 || file.sync === '1') {
                this.startSyncCheck(file.ukey);
            }
        });
    },
    
    // ==================== 相册模式操作 ====================
    
    /**
     * 图片卡片点击
     */
    photoCardClick(event, index) {
        if (this.selectMode) {
            this.togglePhotoSelect(index);
        } else {
            const photo = this.photoList[index];
            if (photo && photo.nsfw === 'yes' && !this.isOwner) {
                // NSFW 受限内容，不提供预览
                return;
            }
            this.openLightbox(index);
        }
    },
    
    /**
     * 切换图片选择
     */
    togglePhotoSelect(index) {
        const photo = this.photoList[index];
        if (!photo) return;
        
        const card = document.querySelector(`.photo-card[data-index="${index}"]`);
        const ukey = photo.ukey;
        
        const idx = this.selectedItems.findIndex(item => item.type === 'file' && item.id === ukey);
        if (idx >= 0) {
            this.selectedItems.splice(idx, 1);
            if (card) card.classList.remove('selected');
        } else {
            this.selectedItems.push({ type: 'file', id: ukey });
            if (card) card.classList.add('selected');
        }
        
        this.updateSelectionUI();
    },
    
    /**
     * 下载图片
     */
    downloadPhoto(index) {
        const photo = this.photoList[index];
        if (!photo) return;
        const name = photo.fname || photo.ukey || 'photo';
        this.trackUI(`vui_download[${name}]`);
        this.downloadByUkey(photo.ukey, {
            index,
            filename: photo.fname
        });
    },
    
    // ==================== 灯箱 ====================
    
    /**
     * 打开灯箱
     */
    openLightbox(index) {
        if (this.photoList.length === 0) return;
        
        this.lightboxIndex = index;
        this.lightboxOpen = true;
        this.lightboxRotation = 0;
        
        const lightbox = document.getElementById('vx-fl-lightbox');
        if (lightbox) {
            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden';
            this.updateLightboxImage();
        }
    },
    
    /**
     * 关闭灯箱
     */
    closeLightbox() {
        this.lightboxOpen = false;
        
        const lightbox = document.getElementById('vx-fl-lightbox');
        if (lightbox) {
            lightbox.classList.remove('active');
            document.body.style.overflow = '';
        }
    },
    
    /**
     * 上一张
     */
    lightboxPrev() {
        if (this.lightboxIndex > 0) {
            this.lightboxIndex--;
            this.lightboxRotation = 0;
            this.updateLightboxImage();
        }
    },
    
    /**
     * 下一张
     */
    lightboxNext() {
        if (this.lightboxIndex < this.photoList.length - 1) {
            this.lightboxIndex++;
            this.lightboxRotation = 0;
            this.updateLightboxImage();
        }
    },
    
    /**
     * 旋转灯箱图片
     */
    rotateLightbox() {
        this.lightboxRotation = (this.lightboxRotation + 90) % 360;
        const img = document.getElementById('vx-fl-lightbox-image');
        if (img) {
            img.style.transform = `rotate(${this.lightboxRotation}deg)`;
        }
    },
    
    /**
     * 更新灯箱图片
     */
    updateLightboxImage() {
        const photo = this.photoList[this.lightboxIndex];
        if (!photo) return;
        
        const img = document.getElementById('vx-fl-lightbox-image');
        const title = document.getElementById('vx-fl-lightbox-title');
        const counter = document.getElementById('vx-fl-lightbox-counter');
        const loading = document.getElementById('vx-fl-lightbox-loading');
        
        if (loading) loading.style.display = 'flex';
        if (img) {
            img.style.opacity = '0';
            img.style.transform = 'rotate(0deg)';
            
            const originalUrl = this.buildImageUrl(photo, 'crop', '1920x1080');
            img.src = originalUrl;
            
            img.onload = () => {
                if (loading) loading.style.display = 'none';
                img.style.opacity = '1';
            };
        }
        
        if (title) title.textContent = photo.fname || '';
        if (counter) counter.textContent = `${this.lightboxIndex + 1} / ${this.photoList.length}`;
        
        this.updateLightboxThumbnails();
    },
    
    /**
     * 更新灯箱缩略图
     */
    updateLightboxThumbnails() {
        const container = document.getElementById('vx-fl-lightbox-thumbnails');
        if (!container) return;
        
        const start = Math.max(0, this.lightboxIndex - 3);
        const end = Math.min(this.photoList.length, this.lightboxIndex + 4);
        
        let html = '';
        for (let i = start; i < end; i++) {
            const photo = this.photoList[i];
            const thumb = this.buildImageUrl(photo, 'thumb', '200x200');
            html += `
                <div class="lightbox-thumbnail ${i === this.lightboxIndex ? 'active' : ''}"
                    data-index="${i}" onclick="VX_FILELIST.goToLightboxPhoto(${i})">
                    <img src="${thumb}" alt="" onload="this.parentNode.classList.add('loaded')" onerror="this.parentNode.classList.add('loaded')">
                    <div class="lightbox-thumb-loading">
                        <div class="lightbox-thumb-spinner"></div>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
    },
    
    /**
     * 跳转到指定图片
     */
    goToLightboxPhoto(index) {
        this.lightboxIndex = index;
        this.lightboxRotation = 0;
        this.updateLightboxImage();
    },
    
    /**
     * 下载当前图片（灯箱模式）
     */
    downloadCurrentPhoto() {
        const photo = this.photoList[this.lightboxIndex];
        if (!photo) return;
        const name = photo.fname || photo.ukey || 'photo';
        this.trackUI(`vui_download[${name}]`);
        
        // 获取灯箱下载按钮
        const btn = document.querySelector('#vx-fl-lightbox .lightbox-action[onclick*="downloadCurrentPhoto"]');
        
        this.downloadByUkey(photo.ukey, {
            index: this.lightboxIndex,
            filename: photo.fname,
            lightboxBtn: btn
        });
    },
    
    // ==================== 文件操作 ====================
    
    /**
     * 打开文件夹
     */
    openFolder(mrid) {
        this.trackUI('vui_filelist[open_folder]');
        const params = { mrid: mrid, view: this.viewMode };
        if (this.isOwner) {
            params.start = 0;
        } else if (this.startMrid !== null && this.startMrid !== undefined && String(this.startMrid) !== '') {
            params.start = this.startMrid;
        }
        VXUI.navigate('filelist', params);
    },
    
    /**
     * 返回上级
     */
    goToParent() {
        const isLoggedIn = (typeof TL !== 'undefined' && TL.isLogin && TL.isLogin());

        if (!this.isOwner && this.startMrid !== null && this.startMrid !== undefined && String(this.startMrid) !== '') {
            if (String(this.mrid) === String(this.startMrid)) {
                VXUI.toastWarning(this.t('vx_no_permission', '无权限'));
                return;
            }
            if (this.room && this.room.parent && String(this.room.parent) !== '0') {
                this.openFolder(this.room.parent);
                return;
            }
            this.openFolder(this.startMrid);
            return;
        }
        
        if (this.room && this.room.parent && String(this.room.parent) !== '0') {
            // 有父文件夹且不是桌面，直接返回父文件夹
            this.openFolder(this.room.parent);
        } else if (isLoggedIn) {
            // 已登录，可以返回桌面
            this.openFolder(0);
        } else {
            // 未登录且没有可返回的父文件夹，不执行任何操作
            // 或者可以提示用户登录
            VXUI.toastWarning(this.t('vx_need_login', '请先登录'));
        }
    },
    
    /**
     * 刷新
     */
    refresh() {
        if (this.refreshing) return;
        this.loadRoom({ refreshing: true, showLoading: true, forceRemote: true });
    },
    
    /**
     * 文件上传完成后的增量更新
     * @param {string|number} mrid - 上传到的文件夹ID
     * @param {string} ukey - 新上传文件的 ukey（可选）
     */
    onFileUploaded(mrid, ukey) {
        // 如果上传的不是当前文件夹，忽略
        if (String(mrid) !== String(this.mrid)) {
            return;
        }
        
        // 防止短时间内重复更新
        if (this._uploadUpdatePending) {
            return;
        }
        this._uploadUpdatePending = true;
        
        // 延迟一小段时间，合并多个上传完成的更新
        setTimeout(() => {
            this._uploadUpdatePending = false;
            this.incrementalUpdate();
        }, 500);
    },
    
    /**
     * 增量更新文件列表
     * 请求服务器获取最新文件列表，然后与当前列表对比，只更新差异部分
     */
    incrementalUpdate() {
        const token = this.getToken();
        if (!token) return;
        
        const sortBy = localStorage.getItem(`vx_room_sort_by_${this.mrid}`) || this.room.sort_by || 0;
        const sortType = localStorage.getItem(`vx_room_sort_type_${this.mrid}`) || this.room.sort_type || 0;
        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';
        
        $.post(apiUrl, {
            action: 'file_list_page',
            mr_id: this.mrid,
            page: 0,
            sort_by: sortBy,
            sort_type: sortType,
            token: token
        }, (rsp) => {
            if (rsp.status !== 1 || !rsp.data) {
                return;
            }
            
            const newFiles = rsp.data || [];
            const oldUkeys = new Set(this.fileList.map(f => f.ukey));
            const newUkeys = new Set(newFiles.map(f => f.ukey));
            
            // 找出新增的文件
            const addedFiles = newFiles.filter(f => !oldUkeys.has(f.ukey));
            
            // 找出被删除的文件（当前有但新列表没有）
            const removedUkeys = this.fileList.filter(f => !newUkeys.has(f.ukey)).map(f => f.ukey);
            
            // 如果没有变化，不做任何操作
            if (addedFiles.length === 0 && removedUkeys.length === 0) {
                return;
            }
            
            // 更新内部数据
            // 移除已删除的文件
            if (removedUkeys.length > 0) {
                this.fileList = this.fileList.filter(f => !removedUkeys.includes(f.ukey));
            }
            
            // 添加新文件（按照服务器返回的顺序插入到开头）
            if (addedFiles.length > 0) {
                // 新文件应该在列表开头（最新上传的在前面）
                this.fileList = addedFiles.concat(this.fileList);
            }
            
            // 更新图片列表
            this.photoList = this.fileList.filter(file => this.isImageFile(file.ftype));
            
            // 局部更新 DOM
            if (this.viewMode === 'list') {
                this.incrementalUpdateListView(addedFiles, removedUkeys);
            } else {
                this.incrementalUpdateAlbumView(addedFiles, removedUkeys);
            }
            
            // 更新项目数量
            this.updateItemCount();

            // 回写缓存，供其它标签页和再次访问直接命中
            this.persistCurrentSnapshot();
            
        }, 'json');
    },
    
    /**
     * 列表视图的增量更新
     */
    incrementalUpdateListView(addedFiles, removedUkeys) {
        const listBody = document.getElementById('vx-fl-list-body');
        if (!listBody) return;
        
        // 移除已删除的行
        removedUkeys.forEach(ukey => {
            const row = listBody.querySelector(`.vx-list-row[data-ukey="${ukey}"]`);
            if (row) {
                row.classList.add('vx-row-removing');
                setTimeout(() => row.remove(), 300);
            }
        });
        
        // 添加新文件行（插入到文件夹之后、现有文件之前）
        if (addedFiles.length > 0) {
            // 找到第一个文件行的位置（文件夹之后）
            const firstFileRow = listBody.querySelector('.vx-list-row[data-type="file"]');
            
            // 反向遍历以保持顺序
            for (let i = addedFiles.length - 1; i >= 0; i--) {
                const file = addedFiles[i];
                const newRow = this.createFileRow(file);
                newRow.classList.add('vx-row-adding');
                
                if (firstFileRow) {
                    listBody.insertBefore(newRow, firstFileRow);
                } else {
                    // 没有文件，直接添加到末尾
                    listBody.appendChild(newRow);
                }
                
                // 移除动画类
                setTimeout(() => newRow.classList.remove('vx-row-adding'), 300);
            }
            
            // 初始化新添加行的倒计时
            this.initLeftTimeCountdown();

            // 重新绑定 tmpui 链接
            if (typeof app !== 'undefined' && typeof app.linkRebind === 'function') {
                app.linkRebind();
            }
        }
        
        // 检查是否需要显示/隐藏空状态
        this.updateEmptyState();
    },
    
    /**
     * 相册视图的增量更新
     */
    incrementalUpdateAlbumView(addedFiles, removedUkeys) {
        const albumGrid = document.getElementById('vx-fl-album-grid');
        if (!albumGrid) return;
        
        // 移除已删除的卡片
        removedUkeys.forEach(ukey => {
            const card = albumGrid.querySelector(`.photo-card[data-fid="${ukey}"]`);
            if (card) {
                card.classList.add('vx-card-removing');
                setTimeout(() => card.remove(), 300);
            }
        });
        
        // 添加新图片卡片（只添加图片类型的文件）
        const addedPhotos = addedFiles.filter(f => this.isImageFile(f.ftype));
        if (addedPhotos.length > 0) {
            const tpl = document.getElementById('tpl-vx-photo-card');
            if (!tpl) return;
            
            const template = tpl.innerHTML;
            const firstCard = albumGrid.querySelector('.photo-card');
            
            // 反向遍历以保持顺序
            for (let i = addedPhotos.length - 1; i >= 0; i--) {
                const photo = addedPhotos[i];
                // 在 photoList 中找到索引
                const index = this.photoList.findIndex(p => p.ukey === photo.ukey);
                
                const thumbnail = this.buildImageUrl(photo, 'ithumb', 's');
                const name = photo.fname || '未命名';
                const size = photo.fsize_formated || this.formatSize(photo.fsize || 0);
                
                const html = template
                    .replace(/{index}/g, index)
                    .replace(/{fid}/g, photo.ukey)
                    .replace(/{thumbnail}/g, thumbnail)
                    .replace(/{name}/g, this.escapeHtml(name))
                    .replace(/{size}/g, size);
                
                const wrapper = document.createElement('div');
                wrapper.innerHTML = html.trim();
                const newCard = wrapper.firstChild;
                newCard.classList.add('vx-card-adding');
                
                if (firstCard) {
                    albumGrid.insertBefore(newCard, firstCard);
                } else {
                    albumGrid.appendChild(newCard);
                }
                
                setTimeout(() => newCard.classList.remove('vx-card-adding'), 300);
            }
            
            // 绑定图片加载事件
            this.bindPhotoImageLoading();
        }
        
        // 检查是否需要显示/隐藏空状态
        this.updateEmptyState();
    },
    
    /**
     * 更新空状态显示
     */
    updateEmptyState() {
        const empty = document.getElementById('vx-fl-empty');
        const listContainer = document.getElementById('vx-fl-list');
        const albumContainer = document.getElementById('vx-fl-album');
        
        const hasContent = (this.subRooms && this.subRooms.length > 0) || 
                          (this.fileList && this.fileList.length > 0);
        
        if (empty) {
            empty.style.display = hasContent ? 'none' : 'flex';
        }
        
        if (this.viewMode === 'list') {
            if (listContainer) listContainer.style.display = hasContent ? '' : 'none';
            if (albumContainer) albumContainer.style.display = 'none';
        } else {
            if (listContainer) listContainer.style.display = 'none';
            if (albumContainer) albumContainer.style.display = hasContent ? '' : 'none';
        }
    },
    
    /**
     * 上传文件
     */
    upload() {
        // 非所有者不允许上传
        if (!this.isOwner) {
            VXUI.toastWarning(this.t('vx_no_permission', '无权限'));
            return;
        }
        this.trackUI(`vui_upload[${this.getRoomDisplayTitle()}]`);
        if (typeof VX_UPLOADER !== 'undefined') {
            VX_UPLOADER.openModal(this.mrid);
        } else {
            console.warn('[VX_FILELIST] VX_UPLOADER not loaded');
            VXUI.toastError(this.t('vx_upload_module_not_loaded', '上传模块未加载'));
        }
    },
    
    /**
     * 预览文件
     */
    previewFile(ukey) {
        // 查找文件
        const file = this.fileList.find(f => f.ukey === ukey);
        if (!file) return;
        
        // 如果是图片且在相册模式，打开灯箱
        if (this.isImageFile(file.ftype)) {
            const index = this.photoList.findIndex(p => p.ukey === ukey);
            if (index >= 0) {
                this.openLightbox(index);
                return;
            }
        }
        
        // 其他文件使用 TL.previewModel
        if (typeof TL !== 'undefined' && TL.previewModel) {
            TL.previewModel(file.ukey, file.fname, 0, file.sid, file.sha1, file.ftype);
        }
    },
    
    /**
     * 下载文件
     */
    downloadFile(ukey, filename) {
        // 如果没有提供文件名，尝试从当前文件列表中查找
        if (!filename) {
            const foundFile = this.fileList && this.fileList.find(f => f.ukey === ukey);
            if (foundFile && foundFile.fname) {
                filename = foundFile.fname;
            } else {
                const foundPhoto = this.photoList && this.photoList.find(p => p.ukey === ukey);
                if (foundPhoto && foundPhoto.fname) {
                    filename = foundPhoto.fname;
                }
            }
        }

        const name = filename || ukey || 'file';
        this.trackUI(`vui_download[${name}]`);

        // 先检查文件是否设有售价，再决定是否直接下载
        const listBtn = document.querySelector(`.vx-list-row[data-ukey="${ukey}"] [data-role="download-btn"]`);
        this._checkDownloadReqAndDownload(ukey, filename, listBtn);
    },

    /**
     * 调用 download_req 检查是否需要付费，若需要则显示付费弹窗，否则直接下载
     */
    async _checkDownloadReqAndDownload(ukey, filename, listBtn) {
        const fileApiUrl = (typeof TL !== 'undefined' && TL.api_file)
            ? TL.api_file
            : '/api_v2/file';
        const token = this.getToken() || '';

        try {
            const rsp = await new Promise((resolve, reject) => {
                $.post(fileApiUrl, {
                    action: 'download_req',
                    ukey: ukey,
                    token: token
                }, resolve, 'json').fail(reject);
            });

            if (rsp && rsp.status === 1) {
                // 免费或已购买，直接下载
                if (typeof VXUI !== 'undefined' && typeof VXUI.toastInfo === 'function') {
                    VXUI.toastInfo(this.t('vx_download_start', '开始下载'));
                }
                this.downloadByUkey(ukey, { filename, listBtn });
            } else if (rsp && rsp.status === 0 && rsp.data && rsp.data.for_sale) {
                // 付费文件，显示购买弹窗
                this.showFilePurchaseModal(ukey, rsp.data);
            } else {
                // 其他错误（例如需要登录）
                const msg = (rsp && rsp.data && rsp.data.message) || this.t('vx_download_failed_retry', '下载失败，请重试');
                if (typeof VXUI !== 'undefined') VXUI.toastError(msg);
            }
        } catch (e) {
            console.error('[VX_FILELIST] download_req check failed:', e);
            // 网络异常时回退到直接下载
            if (typeof VXUI !== 'undefined' && typeof VXUI.toastInfo === 'function') {
                VXUI.toastInfo(this.t('vx_download_start', '开始下载'));
            }
            this.downloadByUkey(ukey, { filename, listBtn });
        }
    },

    /**
     * 显示付费文件购买弹窗
     */
    showFilePurchaseModal(ukey, priceData) {
        const price = priceData.price || 0;
        const modalId = 'vx-fl-purchase-modal';

        // 动态创建或复用弹窗
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'vx-modal';
            document.body.appendChild(modal);
        }

        const file = (this.fileList || []).find(f => String(f.ukey) === String(ukey))
            || (this.photoList || []).find(f => String(f.ukey) === String(ukey));
        const fname = file ? (file.fname || ukey) : ukey;

        modal.innerHTML = `
            <div class="vx-modal-overlay" onclick="VX_FILELIST.closeFilePurchaseModal()"></div>
            <div class="vx-modal-container">
                <div class="vx-modal-header">
                    <h3 class="vx-modal-title">
                        <iconpark-icon name="coin"></iconpark-icon>
                        ${this.t('vx_file_purchase_title', '购买文件')}
                    </h3>
                    <button class="vx-modal-close" onclick="VX_FILELIST.closeFilePurchaseModal()">
                        <iconpark-icon name="circle-xmark"></iconpark-icon>
                    </button>
                </div>
                <div class="vx-modal-body">
                    <p style="color:var(--vx-text-secondary);font-size:14px;margin-bottom:16px;">
                        ${this.t('vx_file_purchase_desc', '该文件需要购买后才能下载。')}
                    </p>
                    <div style="background:var(--vx-bg-secondary);border-radius:var(--vx-radius-md);padding:16px;margin-bottom:16px;">
                        <div style="font-size:14px;color:var(--vx-text-secondary);margin-bottom:8px;">${this.t('vx_file_name', '文件名')}</div>
                        <div style="font-size:15px;font-weight:600;color:var(--vx-text);word-break:break-all;">${this.escapeHtml(fname)}</div>
                    </div>
                    <div style="text-align:center;padding:16px 0;">
                        <div style="font-size:13px;color:var(--vx-text-secondary);margin-bottom:4px;">${this.t('vx_file_price', '售价')}</div>
                        <div style="font-size:36px;font-weight:700;color:var(--vx-primary);">${price}</div>
                        <div style="font-size:13px;color:var(--vx-text-muted);">${this.t('vx_points', '点数')}</div>
                    </div>
                </div>
                <div class="vx-modal-footer">
                    <div></div>
                    <div class="vx-modal-actions">
                        <button class="vx-btn vx-btn-secondary" onclick="VX_FILELIST.closeFilePurchaseModal()">
                            ${this.t('btn_cancel', '取消')}
                        </button>
                        <button class="vx-btn vx-btn-primary" id="vx-fl-purchase-confirm-btn"
                            onclick="VX_FILELIST.purchaseFile('${ukey}')">
                            <iconpark-icon name="expenses-one"></iconpark-icon>
                            ${this.t('vx_purchase_confirm', '花费')} ${price} ${this.t('vx_points', '点数')}${this.t('vx_purchase_confirm2', '购买')}
                        </button>
                    </div>
                </div>
            </div>
        `;

        modal.classList.add('vx-modal-open');
        document.body.classList.add('vx-modal-body-open');
    },

    /**
     * 关闭购买文件弹窗
     */
    closeFilePurchaseModal() {
        const modal = document.getElementById('vx-fl-purchase-modal');
        if (modal) {
            modal.classList.remove('vx-modal-open');
            document.body.classList.remove('vx-modal-body-open');
        }
    },

    /**
     * 购买文件 (调用 file_purchase API)
     */
    async purchaseFile(ukey) {
        const token = this.getToken();
        if (!token) {
            if (typeof VXUI !== 'undefined') VXUI.toastWarning(this.t('vx_need_login', '请先登录'));
            return;
        }

        const btn = document.getElementById('vx-fl-purchase-confirm-btn');
        if (btn) { btn.disabled = true; }

        const fileApiUrl = (typeof TL !== 'undefined' && TL.api_file)
            ? TL.api_file
            : '/api_v2/file';

        try {
            const rsp = await new Promise((resolve, reject) => {
                $.post(fileApiUrl, {
                    action: 'file_purchase',
                    ukey: ukey,
                    token: token
                }, resolve, 'json').fail(reject);
            });

            if (rsp && rsp.status === 1) {
                this.closeFilePurchaseModal();
                if (typeof VXUI !== 'undefined') VXUI.toastSuccess(this.t('vx_purchase_success', '购买成功！'));
                // 购买成功后自动触发下载
                setTimeout(() => this.downloadFile(ukey), 600);
            } else {
                const msg = (rsp && rsp.data && rsp.data.message) || this.t('vx_purchase_failed', '购买失败');
                if (typeof VXUI !== 'undefined') VXUI.toastError(msg);
                if (btn) btn.disabled = false;
            }
        } catch (e) {
            console.error('[VX_FILELIST] purchaseFile error:', e);
            if (typeof VXUI !== 'undefined') VXUI.toastError(this.t('error_network', '网络错误'));
            if (btn) btn.disabled = false;
        }
    },

    /**
     * 检查当前用户是否为赞助者（需要赞助者才能使用文件售价功能）
     */
    _isSponsor() {
        return typeof TL !== 'undefined' && TL.logined === 1 && TL.sponsor !== false;
    },

    /**
     * 显示设定文件售价弹窗（仅赞助者 + 文件所有者可用）
     */
    setFilePriceModal(ukey) {
        if (!this.isOwner) {
            if (typeof VXUI !== 'undefined') VXUI.toastWarning(this.t('vx_no_permission', '无权限'));
            return;
        }
        if (!this._isSponsor()) {
            if (typeof VXUI !== 'undefined') VXUI.toastWarning(this.t('vx_sponsor_required', '此功能需要赞助者权益'));
            return;
        }

        this._currentSetPriceUkey = ukey;
        const file = (this.fileList || []).find(f => String(f.ukey) === String(ukey));
        const currentPrice = (file && file.for_sale && file.price) ? file.price : '';
        const fname = file ? (file.fname || ukey) : ukey;

        const modalId = 'vx-fl-setprice-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'vx-modal';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="vx-modal-overlay" onclick="VX_FILELIST.closeSetPriceModal()"></div>
            <div class="vx-modal-container" style="max-width:360px;">
                <div class="vx-modal-header" style="padding-top:12px;padding-bottom:12px;">
                    <h3 class="vx-modal-title" style="margin:0;">
                        <iconpark-icon name="funds"></iconpark-icon>
                        ${currentPrice ? this.t('vx_update_price', '调整价格') : this.t('vx_sell_file', '出售')}
                    </h3>
                    <button class="vx-modal-close" onclick="VX_FILELIST.closeSetPriceModal()">
                        <iconpark-icon name="circle-xmark"></iconpark-icon>
                    </button>
                </div>
                <div class="vx-modal-body" style="padding-top:12px;padding-bottom:12px;">
                    <div style="display:flex;align-items:center;justify-content:center;gap:2px;font-size:14px;color:var(--vx-text-secondary);margin-bottom:8px;">
                        <span>${this.t('vx_set_price_for_prefix', '为')}</span>
                        <span style="display:inline-block;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom;">${this.escapeHtml(fname)}</span>
                        <span>${this.t('vx_set_price_for_suffix', '设定售价。')}</span>
                    </div>
                    <input type="number" id="vx-fl-price-input" class="vx-input"
                        value="${currentPrice}" min="1" max="10000" step="1"
                        placeholder="${this.t('vx_price_placeholder', '\u51fa\u552e\u4ef7\u683c\uff08\u70b9\u6570\uff09')}"
                        style="width:100%;font-size:20px;text-align:center;padding:12px;">
                </div>
                <div class="vx-modal-footer">
                    <div></div>
                    <div class="vx-modal-actions">
                        <button class="vx-btn vx-btn-secondary" onclick="VX_FILELIST.closeSetPriceModal()">
                            ${this.t('btn_cancel', '\u53d6\u6d88')}
                        </button>
                        <button class="vx-btn vx-btn-primary" onclick="VX_FILELIST.confirmSetFilePrice()">
                            ${this.t('vx_save', '\u4fdd\u5b58')}
                        </button>
                    </div>
                </div>
            </div>
        `;

        modal.classList.add('vx-modal-open');
        document.body.classList.add('vx-modal-body-open');
        setTimeout(() => {
            const input = document.getElementById('vx-fl-price-input');
            if (input) input.focus();
        }, 100);
    },

    /**
     * 关闭设价弹窗
     */
    closeSetPriceModal() {
        const modal = document.getElementById('vx-fl-setprice-modal');
        if (modal) {
            modal.classList.remove('vx-modal-open');
            document.body.classList.remove('vx-modal-body-open');
        }
    },

    /**
     * 确认设定售价 (调用 file_price_set API)
     */
    async confirmSetFilePrice() {
        const ukey = this._currentSetPriceUkey;
        if (!ukey) return;

        const priceInput = document.getElementById('vx-fl-price-input');
        const price = priceInput ? parseInt(priceInput.value, 10) : 0;

        if (!price || price < 1 || price > 10000) {
            if (typeof VXUI !== 'undefined') VXUI.toastWarning(this.t('vx_price_invalid', '售价必须在 1 到 10000 之间'));
            return;
        }

        const token = this.getToken();
        if (!token) {
            if (typeof VXUI !== 'undefined') VXUI.toastWarning(this.t('vx_need_login', '请先登录'));
            return;
        }

        const fileApiUrl = (typeof TL !== 'undefined' && TL.api_file)
            ? TL.api_file
            : '/api_v2/file';

        try {
            const rsp = await new Promise((resolve, reject) => {
                $.post(fileApiUrl, {
                    action: 'file_price_set',
                    ukey: ukey,
                    token: token,
                    price: price
                }, resolve, 'json').fail(reject);
            });

            if (rsp && rsp.status === 1) {
                this.closeSetPriceModal();
                if (typeof VXUI !== 'undefined') VXUI.toastSuccess(this.t('vx_price_set_success', '售价设定成功'));
                // 原地更新本地数据和 DOM，无需整页刷新
                const fileToUpdate = (this.fileList || []).find(f => String(f.ukey) === String(ukey));
                if (fileToUpdate) {
                    fileToUpdate.for_sale = true;
                    fileToUpdate.price = price;
                }
                this._patchFileRow(ukey);
            } else {
                const msg = (rsp && rsp.data && rsp.data.message) || this.t('vx_update_failed', '修改失败');
                if (typeof VXUI !== 'undefined') VXUI.toastError(msg);
            }
        } catch (e) {
            console.error('[VX_FILELIST] confirmSetFilePrice error:', e);
            if (typeof VXUI !== 'undefined') VXUI.toastError(this.t('error_network', '网络错误'));
        }
    },

    /**
     * 取消文件售价 (调用 file_price_remove API)
     */
    async confirmRemoveFilePrice(ukey) {
        if (!this.isOwner) {
            if (typeof VXUI !== 'undefined') VXUI.toastWarning(this.t('vx_no_permission', '无权限'));
            return;
        }

        const token = this.getToken();
        if (!token) {
            if (typeof VXUI !== 'undefined') VXUI.toastWarning(this.t('vx_need_login', '请先登录'));
            return;
        }

        const confirmed = await new Promise(resolve => {
            if (typeof VXUI !== 'undefined' && typeof VXUI.confirm === 'function') {
                VXUI.confirm({
                    title: this.t('vx_title_confirm', '确认'),
                    message: this.t('vx_remove_price_confirm', '确定要取消此文件的售价吗？这将使文件恢复免费下载。'),
                    confirmText: this.t('btn_confirm', '确认'),
                    confirmClass: 'vx-btn-danger',
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false)
                });
            } else {
                resolve(window.confirm(this.t('vx_remove_price_confirm', '确定要取消此文件的售价吗？这将使文件恢复免费下载。')));
            }
        });

        if (!confirmed) return;

        const fileApiUrl = (typeof TL !== 'undefined' && TL.api_file)
            ? TL.api_file
            : '/api_v2/file';

        try {
            const rsp = await new Promise((resolve, reject) => {
                $.post(fileApiUrl, {
                    action: 'file_price_remove',
                    ukey: ukey,
                    token: token
                }, resolve, 'json').fail(reject);
            });

            if (rsp && rsp.status === 1) {
                if (typeof VXUI !== 'undefined') VXUI.toastSuccess(this.t('vx_price_removed', '已取消售价'));
                // 原地更新本地数据和 DOM，无需整页刷新
                const fileToUpdate = (this.fileList || []).find(f => String(f.ukey) === String(ukey));
                if (fileToUpdate) {
                    fileToUpdate.for_sale = false;
                    fileToUpdate.price = 0;
                }
                this._patchFileRow(ukey);
            } else {
                const msg = (rsp && rsp.data && rsp.data.message) || this.t('vx_update_failed', '操作失败');
                if (typeof VXUI !== 'undefined') VXUI.toastError(msg);
            }
        } catch (e) {
            console.error('[VX_FILELIST] confirmRemoveFilePrice error:', e);
            if (typeof VXUI !== 'undefined') VXUI.toastError(this.t('error_network', '网络错误'));
        }
    },
    
    /**
     * 局部更新指定文件行的 DOM（价格标签 + 有效期标签），避免整页刷新。
     * 调用前需先更新 this.fileList 中对应文件的数据。
     */
    _patchFileRow(ukey) {
        const file = (this.fileList || []).find(f => String(f.ukey) === String(ukey));
        if (!file) return;

        const row = document.querySelector(`.vx-list-row[data-ukey="${ukey}"]`);
        if (!row) return;

        const filenameDiv = row.querySelector('.vx-list-filename');
        if (!filenameDiv) return;

        // --- 更新售价标签 ---
        const existingPriceTag = filenameDiv.querySelector('.vx-price-tag');
        if (file.for_sale && file.price > 0) {
            const newTagHtml = `<span class="vx-price-tag" title="${this.t('vx_file_for_sale', '付费文件')}: ${file.price} ${this.t('vx_points', '点数')}"><iconpark-icon name="funds"></iconpark-icon>${file.price}</span>`;
            if (existingPriceTag) {
                existingPriceTag.outerHTML = newTagHtml;
            } else {
                const tmp = document.createElement('span');
                tmp.innerHTML = newTagHtml;
                const lefttimeEl = filenameDiv.querySelector('.vx-lefttime');
                if (lefttimeEl) {
                    filenameDiv.insertBefore(tmp.firstElementChild, lefttimeEl);
                } else {
                    filenameDiv.appendChild(tmp.firstElementChild);
                }
            }
        } else {
            if (existingPriceTag) existingPriceTag.remove();
        }

        // --- 更新有效期标签 ---
        const isPermanent = Number(file.model) === 99;
        const existingLefttime = filenameDiv.querySelector('.vx-lefttime');
        if (file.lefttime > 0 && !isPermanent) {
            const lefttimeId = `lefttime_${file.ukey}`;
            const newLefttimeHtml = `<span class="vx-lefttime" data-tmplink-lefttime="${file.lefttime}"><iconpark-icon name="clock"></iconpark-icon><span id="${lefttimeId}">--</span></span>`;
            if (existingLefttime) {
                existingLefttime.outerHTML = newLefttimeHtml;
            } else {
                const tmp = document.createElement('span');
                tmp.innerHTML = newLefttimeHtml;
                filenameDiv.appendChild(tmp.firstElementChild);
            }
            // 重新启动倒计时
            this.initLeftTimeCountdown();
        } else {
            if (existingLefttime) existingLefttime.remove();
        }
    },

    /**
     * 确保下载器已初始化
     */
    ensureDownloader() {
        if (!this.downloader && typeof download_photo !== 'undefined') {
            this.downloader = new download_photo();
            this.downloader.init(TL);
        }
    },
    
    /**
     * 获取下载 UI 元素
     */
    getDownloadUI(index) {
        if (typeof index !== 'number') return null;
        const card = document.querySelector(`.photo-card[data-index="${index}"]`);
        if (!card) return null;

        return {
            card: card,
            button: card.querySelector('[data-role="download-btn"]'),
            overlay: card.querySelector('.photo-download-overlay'),
            progress: card.querySelector('.photo-download-progress-bar'),
            status: card.querySelector('[data-role="download-status"]')
        };
    },
    
    /**
     * 重置下载 UI
     */
    resetDownloadUI(ui) {
        if (!ui) return;
        ui.card.classList.remove('downloading');
        if (ui.overlay) ui.overlay.classList.remove('active', 'error');
        if (ui.progress) ui.progress.style.width = '0%';
        if (ui.status) ui.status.textContent = '';
        if (ui.button) {
            ui.button.classList.remove('is-downloading', 'download-complete', 'download-error');
            ui.button.innerHTML = '<iconpark-icon name="cloud-arrow-down"></iconpark-icon>';
        }
    },
    
    /**
     * 格式化字节数
     */
    formatBytesFallback(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
        const val = bytes / Math.pow(k, i);
        return `${val.toFixed(2)} ${sizes[i]}`;
    },
    
    /**
     * 通过 ukey 下载文件
     */
    async downloadByUkey(ukey, options = {}) {
        this.ensureDownloader();

        const listBtn = options.listBtn;
        const setListBtnState = (isDownloading) => {
            if (!listBtn) return;
            listBtn.classList.toggle('is-downloading', !!isDownloading);
        };
        
        // 如果没有下载器，使用简单下载
        if (!this.downloader) {
            setListBtnState(true);
            this.simpleDownload(ukey);
            setTimeout(() => setListBtnState(false), 1200);
            return;
        }

        const ui = this.getDownloadUI(options.index);
        const lightboxBtn = options.lightboxBtn;
        const formatBytes = (val) => {
            if (typeof bytetoconver === 'function') {
                return bytetoconver(val, true);
            }
            return this.formatBytesFallback(val);
        };

        const uiCallbacks = {
            onStart: () => {
                setListBtnState(true);
                // 图片卡片 UI
                if (ui) {
                    ui.card.classList.add('downloading');
                    if (ui.overlay) ui.overlay.classList.add('active');
                    if (ui.progress) ui.progress.style.width = '8%';
                    if (ui.status) ui.status.textContent = this.t('vx_preparing_download', '准备下载...');
                    if (ui.button) {
                        ui.button.classList.add('is-downloading');
                        ui.button.innerHTML = `
                            <svg class="card-download-progress" viewBox="0 0 36 36">
                                <circle class="progress-bg" cx="18" cy="18" r="16"></circle>
                                <circle class="progress-bar" cx="18" cy="18" r="16" stroke-dasharray="100, 100" stroke-dashoffset="92"></circle>
                            </svg>
                            <iconpark-icon name="cloud-arrow-down" class="progress-icon"></iconpark-icon>
                        `;
                    }
                }
                // 灯箱按钮 UI - 显示圆形进度
                if (lightboxBtn) {
                    lightboxBtn.classList.add('is-downloading');
                    lightboxBtn.innerHTML = `
                        <svg class="lightbox-download-progress" viewBox="0 0 36 36">
                            <circle class="progress-bg" cx="18" cy="18" r="16"></circle>
                            <circle class="progress-bar" cx="18" cy="18" r="16" stroke-dasharray="100, 100" stroke-dashoffset="92"></circle>
                        </svg>
                        <iconpark-icon name="cloud-arrow-down" class="progress-icon"></iconpark-icon>
                    `;
                }
            },
            onProgress: (loaded, total) => {
                const percent = total ? Math.min(100, Math.round((loaded / total) * 100)) : Math.min(95, Math.round((loaded / 1024) % 95));
                if (ui && ui.progress) ui.progress.style.width = `${percent}%`;
                const loadedText = formatBytes(loaded);
                const totalText = total ? formatBytes(total) : '';
                
                // 更新灯箱按钮进度
                if (lightboxBtn) {
                    const progressBar = lightboxBtn.querySelector('.progress-bar');
                    if (progressBar) {
                        const offset = 100 - percent;
                        progressBar.style.strokeDashoffset = offset;
                    }
                }
                // 更新卡片按钮进度
                if (ui && ui.button) {
                    const progressBar = ui.button.querySelector('.progress-bar');
                    if (progressBar) {
                        const offset = 100 - percent;
                        progressBar.style.strokeDashoffset = offset;
                    }
                }
                if (ui && ui.status) ui.status.textContent = total ? `${loadedText} / ${totalText}` : loadedText;
            },
            onComplete: () => {
                setTimeout(() => setListBtnState(false), 600);
                if (ui && ui.progress) ui.progress.style.width = '100%';
                if (ui && ui.status) ui.status.textContent = this.t('vx_download_complete_label', '下载完成');
                // 卡片按钮完成状态
                if (ui && ui.button) {
                    ui.button.classList.add('download-complete');
                    ui.button.innerHTML = '<iconpark-icon name="check"></iconpark-icon>';
                }
                if (ui) setTimeout(() => this.resetDownloadUI(ui), 800);
                // 灯箱按钮 - 显示完成状态后恢复
                if (lightboxBtn) {
                    lightboxBtn.classList.add('download-complete');
                    lightboxBtn.innerHTML = '<iconpark-icon name="check"></iconpark-icon>';
                    setTimeout(() => {
                        lightboxBtn.classList.remove('is-downloading', 'download-complete');
                        lightboxBtn.innerHTML = '<iconpark-icon name="cloud-arrow-down"></iconpark-icon>';
                    }, 1000);
                }
                VXUI.toastSuccess(this.t('vx_download_complete', '下载完成'));
            },
            onError: (error) => {
                setTimeout(() => setListBtnState(false), 600);
                if (ui && ui.overlay) ui.overlay.classList.add('error');
                if (ui && ui.status) ui.status.textContent = this.t('vx_download_failed_label', '下载失败');
                // 卡片按钮错误状态
                if (ui && ui.button) {
                    ui.button.classList.add('download-error');
                    ui.button.innerHTML = '<iconpark-icon name="circle-xmark"></iconpark-icon>';
                }
                if (ui) setTimeout(() => this.resetDownloadUI(ui), 1500);
                // 灯箱按钮 - 显示错误状态后恢复
                if (lightboxBtn) {
                    lightboxBtn.classList.add('download-error');
                    lightboxBtn.innerHTML = '<iconpark-icon name="circle-xmark"></iconpark-icon>';
                    setTimeout(() => {
                        lightboxBtn.classList.remove('is-downloading', 'download-error');
                        lightboxBtn.innerHTML = '<iconpark-icon name="cloud-arrow-down"></iconpark-icon>';
                    }, 1500);
                }
                VXUI.toastError(this.t('vx_download_failed_retry', '下载失败，请重试'));
            }
        };

        try {
            await this.downloader.download({
                ukey,
                filename: options.filename,
                ui: uiCallbacks
            });
        } catch (error) {
            console.error('Download failed:', error);
            // 回退到简单下载
            this.simpleDownload(ukey);
        }
    },
    
    /**
     * 简单下载（直接跳转）
     */
    simpleDownload(ukey) {
        if (typeof TL !== 'undefined' && typeof TL.get_download_url === 'function') {
            TL.get_download_url(ukey).then(url => {
                window.location.href = url;
            }).catch(() => {
                window.open(`/file?ukey=${ukey}`, '_blank');
            });
        } else {
            window.open(`/file?ukey=${ukey}`, '_blank');
        }
    },
    
    /**
     * 删除文件
     */
    deleteFile(ukey, sourceMrid, callbacks) {
        if (!confirm(this.t('vx_confirm_delete_file', '确定要删除此文件吗？'))) return;
        
        this.trackUI('vui_filelist[delete_file]');
        const token = this.getToken();

        this._deleteFileWithFallback(ukey, token, sourceMrid).then((ok) => {
            if (ok) {
                this.removeFilesLocally([ukey], { persist: true, render: true, clearSelection: true });
                VXUI.toastSuccess(this.t('vx_delete_success', '删除成功'));
                if (callbacks && typeof callbacks.onSuccess === 'function') {
                    callbacks.onSuccess();
                }
            } else {
                VXUI.toastError(this.t('vx_delete_failed_retry', '删除失败，请重试'));
                if (callbacks && typeof callbacks.onError === 'function') {
                    callbacks.onError();
                }
            }
        });
    },

    /**
     * 删除文件：优先从当前文件夹删除；失败时回退到从工作区移除（兼容老逻辑 remove_from_workspace）。
     */
    _deleteFileWithFallback(ukey, token, sourceMrid) {
        const mrApiUrl = (typeof TL !== 'undefined' && TL.api_mr)
            ? TL.api_mr
            : '/api_v2/meetingroom';
        const fileApiUrl = (typeof TL !== 'undefined' && TL.api_file)
            ? TL.api_file
            : ((typeof TL !== 'undefined' && TL.api_url) ? (TL.api_url + '/file') : '/api_v2/file');
        const targetMrid = sourceMrid != null && String(sourceMrid) !== ''
            ? sourceMrid
            : this.mrid;

        return new Promise((resolve) => {
            // 1) meetingroom 删除
            $.post(mrApiUrl, {
                action: 'file_del',
                token: token,
                mr_id: targetMrid,
                ukey: ukey
            }, (rsp) => {
                if (rsp && rsp.status === 1) {
                    resolve(true);
                    return;
                }

                // 2) fallback：从工作区移除
                $.post(fileApiUrl, {
                    action: 'remove_from_workspace',
                    token: token,
                    ukey: ukey
                }, (rsp2) => {
                    resolve(!!(rsp2 && rsp2.status === 1));
                }, 'json').fail(() => resolve(false));
            }, 'json').fail(() => {
                // 走不到 meetingroom，则直接尝试移出工作区
                $.post(fileApiUrl, {
                    action: 'remove_from_workspace',
                    token: token,
                    ukey: ukey
                }, (rsp2) => {
                    resolve(!!(rsp2 && rsp2.status === 1));
                }, 'json').fail(() => resolve(false));
            });
        });
    },
    
    /**
     * 重命名文件
     */
    renameFile(ukey, currentName) {
        this.trackUI('vui_filelist[rename_file]');
        this._renameTarget = { type: 'file', id: ukey };
        const input = document.getElementById('vx-fl-rename-input');
        if (input) input.value = currentName;
        this.showRenameModal();
    },
    
    /**
     * 删除文件夹
     */
    deleteFolder(mrid) {
        if (!confirm(this.t('vx_confirm_delete_folder', '确定要删除此文件夹吗？'))) return;
        
        this.trackUI('vui_filelist[delete_folder]');
        const token = this.getToken();
        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';
        
        $.post(apiUrl, {
            action: 'delete',
            token: token,
            mr_id: mrid
        }, () => {
            this.removeFoldersLocally([mrid], { persist: true, render: true, clearSelection: true });
            VXUI.toastSuccess(this.t('vx_delete_success', '删除成功'));
        });
    },
    
    /**
     * 重命名文件夹
     */
    renameFolder(mrid) {
        this.trackUI('vui_filelist[rename_folder]');
        const folder = this.subRooms.find(f => f.mr_id == mrid);
        if (!folder) return;
        
        this._renameTarget = { type: 'folder', id: mrid };
        const input = document.getElementById('vx-fl-rename-input');
        if (input) input.value = folder.name || '';
        this.showRenameModal();
    },
    
    /**
     * 分享文件夹（复制链接）
     * @param {string} mrid - 文件夹ID（可选，默认分享当前文件夹）
     * @param {string} url - 分享链接（可选）
     */
    shareFolder(mrid, url, btn) {
        this.trackUI('vui_filelist[share_folder]');
        // 如果没有传入 url，构建当前文件夹的链接
        if (!url) {
            if (this.isDesktop && !mrid) {
                VXUI.toastWarning(this.t('vx_desktop_cannot_share', '桌面无法分享'));
                return;
            }
            const targetMrid = mrid || this.mrid;
            url = this.buildFolderShareUrl(targetMrid);
        }

        this.flashButtonOk(btn);
        this.copyText(this.formatCopyText(this.getFolderCopyName(mrid), url, '', 'folder'));
    },

    /**
     * 分享文件（复制链接）
     * @param {string} ukey - 文件 UKEY
     * @param {HTMLElement} [btn] - 触发按钮，用于点击反馈
     */
    shareFile(ukey, btn) {
        if (!ukey) return;
        this.trackUI('vui_filelist[share_file]');
        const domain = (typeof TL !== 'undefined' && TL.site_domain) ? TL.site_domain : window.location.host;
        const safeKey = encodeURIComponent(String(ukey));
        const url = `https://${domain}/f/${safeKey}`;

        this.flashButtonOk(btn);
        this.copyText(this.formatCopyText(this.getFileCopyName(ukey), url, '', 'file'));
    },

    deleteGlobalSearchFile(ukey, mrid) {
        this.deleteFile(ukey, mrid, {
            onSuccess: () => this.removeGlobalSearchResult(ukey)
        });
    },
    
    /**
     * 取消收藏文件夹
     */
    unfavoriteFolder(mrid) {
        this.trackUI('vui_filelist[unfavorite_folder]');
        const token = this.getToken();
        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';
        
        // 隐藏该行
        const row = document.querySelector(`.vx-list-row[data-mrid="${mrid}"]`);
        if (row) {
            row.classList.add('vx-row-removing');
        }
        
        $.post(apiUrl, {
            action: 'favorite_del',
            token: token,
            mr_id: mrid
        }, () => {
            // 从数据中移除
            this.subRooms = this.subRooms.filter(f => f.mr_id != mrid);
            // 移除 DOM
            setTimeout(() => {
                if (row) row.remove();
                this.updateItemCount();
                this.updateEmptyState();
            }, 300);
            VXUI.toastSuccess(this.t('vx_unfavorited', '已取消收藏'));
        });
    },
    
    // ==================== 选择模式 ====================
    
    /**
     * 判断是否允许使用多选模式
     * 移动端未登录时禁用多选
     */
    canUseSelectMode() {
        const isMobile = typeof VXUI !== 'undefined' && VXUI.isMobile();
        const isLoggedIn = typeof VXUI !== 'undefined' && VXUI.isLoggedIn();
        // 移动端未登录时不允许多选
        if (isMobile && !isLoggedIn) {
            return false;
        }
        return true;
    },
    
    /**
     * 切换选择模式
     */
    toggleSelectMode() {
        if (!this.canUseSelectMode()) {
            return;
        }
        this.selectMode = !this.selectMode;
        this.selectedItems = [];
        
        const content = document.querySelector('.vx-content-list');
        if (content) {
            content.classList.toggle('vx-select-mode', this.selectMode);
        }
        
        // 清除选中状态
        document.querySelectorAll('.vx-list-row.selected, .photo-card.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        this.updateSelectionUI();
    },
    
    /**
     * 切换项目选中
     */
    toggleItemSelect(row) {
        if (!this.canUseSelectMode()) {
            return;
        }
        const type = row.dataset.type;
        const id = type === 'folder' ? row.dataset.mrid : row.dataset.ukey;
        
        const idx = this.selectedItems.findIndex(item => item.type === type && item.id === id);
        if (idx >= 0) {
            this.selectedItems.splice(idx, 1);
            row.classList.remove('selected');
        } else {
            this.selectedItems.push({ type, id });
            row.classList.add('selected');
        }
        
        this.updateSelectionUI();
    },
    
    /**
     * 全选
     */
    selectAll() {
        if (!this.canUseSelectMode()) {
            return;
        }
        this.trackUI('vui_filelist[select_all]');
        this.selectMode = true;
        this.selectedItems = [];
        
        // 选择所有文件夹
        this.subRooms.forEach(folder => {
            this.selectedItems.push({ type: 'folder', id: folder.mr_id });
        });
        
        // 选择所有文件
        this.fileList.forEach(file => {
            this.selectedItems.push({ type: 'file', id: file.ukey });
        });
        
        // 更新 UI
        document.querySelectorAll('.vx-list-row').forEach(row => {
            row.classList.add('selected');
        });
        document.querySelectorAll('.photo-card').forEach(card => {
            card.classList.add('selected');
        });
        
        const content = document.querySelector('.vx-content-list');
        if (content) content.classList.add('vx-select-mode');
        
        this.updateSelectionUI();
    },
    
    /**
     * 清除选择
     */
    clearSelection() {
        this.selectMode = false;
        this.selectedItems = [];
        
        document.querySelectorAll('.vx-list-row.selected, .photo-card.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        const content = document.querySelector('.vx-content-list');
        if (content) content.classList.remove('vx-select-mode');
        
        this.updateSelectionUI();
    },
    
    /**
     * 更新选择 UI
     */
    updateSelectionUI() {
        const bar = document.getElementById('vx-fl-selection-bar');
        const count = document.getElementById('vx-fl-selected-count');
        
        if (this.selectedItems.length > 0) {
            if (bar) bar.style.display = 'flex';
            if (count) count.textContent = this.selectedItems.length;
        } else {
            if (bar) bar.style.display = 'none';
        }

        // 根据文件夹直链状态显示/隐藏「复制直链」按钮
        const directBtn = document.getElementById('vx-fl-copy-direct-btn');
        if (directBtn) {
            directBtn.style.display = (this.isOwner && this.directDomainReady && this.directDirEnabled && this.directDirKey) ? '' : 'none';
        }

        this.updateSelectAllCheckbox();
    },

    /**
     * 表头全选框：全选/取消全选
     */
    toggleSelectAllFromHeader() {
        if (!this.canUseSelectMode()) {
            return;
        }
        const total = (this.subRooms ? this.subRooms.length : 0) + (this.fileList ? this.fileList.length : 0);
        if (total <= 0) return;

        if (this.selectedItems.length === total) {
            this.clearSelection();
        } else {
            this.selectAll();
        }
    },

    /**
     * 同步表头全选框状态（未选/半选/全选）
     */
    updateSelectAllCheckbox() {
        const el = document.getElementById('vx-fl-select-all');
        if (!el) return;

        const total = (this.subRooms ? this.subRooms.length : 0) + (this.fileList ? this.fileList.length : 0);
        el.classList.remove('vx-checked', 'vx-indeterminate');

        if (total <= 0) return;

        if (this.selectedItems.length === total) {
            el.classList.add('vx-checked');
        } else if (this.selectedItems.length > 0) {
            el.classList.add('vx-indeterminate');
        }
    },
    
    /**
     * 下载选中项
     */
    async downloadSelected() {
        if (!this.selectedItems || this.selectedItems.length === 0) {
            VXUI.toastWarning(this.t('vx_select_files_to_download', '请选择要下载的文件'));
            return;
        }

        this.trackUI('vui_filelist[download_selected]');
        this.ensureBatchDownloader();
        if (!this.batchDownloader || typeof this.batchDownloader.folder_download !== 'function') {
            VXUI.toastError(this.t('vx_download_module_not_loaded', '下载模块未加载'));
            return;
        }

        const selectData = this.selectedItems.map(item => ({
            id: item.id,
            type: item.type === 'folder' ? 'dir' : 'file'
        }));

        await this.batchDownloader.folder_download(selectData);
    },

    /**
     * 复制选中项链接
     */
    copySelectedUrls() {
        if (!this.selectedItems || this.selectedItems.length === 0) {
            VXUI.toastWarning(this.t('vx_select_files_to_copy_url', '请选择要复制链接的文件或文件夹'));
            return;
        }

        this.trackUI('vui_filelist[copy_selected_urls]');

        const entries = [];
        const domain = (typeof TL !== 'undefined' && TL.site_domain) ? TL.site_domain : window.location.host;
        const copyStyle = this.getCopyStyle();
        const orderedItems = this.getSelectedItemsInDisplayOrder();

        for (const item of orderedItems) {
            let url = '';
            let name = '';
            if (item.type === 'folder') {
                url = this.buildFolderShareUrl(item.id);
                name = this.getFolderCopyName(item.id);
            } else if (item.type === 'file') {
                const safeKey = encodeURIComponent(String(item.id));
                url = `https://${domain}/f/${safeKey}`;
                name = this.getFileCopyName(item.id);
            }
            if (url) {
                entries.push(this.formatCopyText(name, url, copyStyle, item.type));
            }
        }

        if (entries.length === 0) return;

        this.copyText(entries.join(this.getCopyTextSeparator(copyStyle)));
        
        this.clearSelection();
    },

    /**
     * 复制选中文件的直链
     */
    copySelectedDirectUrls() {
        if (!this.selectedItems || this.selectedItems.length === 0) {
            VXUI.toastWarning(this.t('vx_select_files_to_copy_url', '请选择要复制链接的文件或文件夹'));
            return;
        }
        if (!this.directDomainReady || !this.directDirEnabled || !this.directDirKey) {
            VXUI.toastWarning(this.t('vx_direct_not_enabled', '未开启文件夹直链'));
            return;
        }

        this.trackUI('vui_filelist[copy_selected_direct_urls]');

        const urls = [];
        const orderedItems = this.getSelectedItemsInDisplayOrder();
        for (const item of orderedItems) {
            if (item.type === 'file') {
                const file = (this.fileList || []).find(f => String(f.ukey) === String(item.id));
                if (file) {
                    const link = this.getDirectFileShareLink(file);
                    if (link) urls.push(link);
                }
            }
        }

        if (urls.length === 0) {
            VXUI.toastWarning(this.t('vx_no_files_selected', '没有可复制直链的文件'));
            return;
        }

        const text = urls.join('\n');
        VXUI.copyToClipboard(text);
        VXUI.toastSuccess(this.t('vx_link_copied', '链接已复制'));
        this.clearSelection();
    },

    /**
     * 确保批量下载器已初始化
     */
    ensureBatchDownloader() {
        // 使用全局的 VX_DOWNLOAD 实例
        if (typeof VX_DOWNLOAD !== 'undefined' && VX_DOWNLOAD) {
            this.batchDownloader = VX_DOWNLOAD;
        } else if (this.batchDownloader || typeof VXUIDownload === 'undefined') {
            return;
        } else {
            this.batchDownloader = new VXUIDownload();
        }
        
        const apiFile = (typeof TL !== 'undefined' && TL.api_file)
            ? TL.api_file
            : ((typeof TL !== 'undefined' && TL.api_url) ? (TL.api_url + '/file') : '/api_v2/file');
        const apiMr = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';

        this.batchDownloader.init({
            api_file: apiFile,
            api_mr: apiMr,
            getToken: () => this.getToken(),
            recaptcha_do_async: (action) => {
                if (typeof TL !== 'undefined' && typeof TL.recaptcha_do_async === 'function') {
                    return TL.recaptcha_do_async(action);
                }
                return Promise.resolve('');
            },
            alert: (msg) => {
                if (typeof VXUI !== 'undefined' && typeof VXUI.toastError === 'function') {
                    VXUI.toastError(msg);
                } else {
                    alert(msg);
                }
            },
            getFileByUkey: (ukey) => {
                return (this.fileList || []).find(f => String(f.ukey) === String(ukey));
            }
        });
    },
    
    /**
     * 移动选中项
     */
    moveSelected() {
        // 非所有者不允许移动
        if (!this.isOwner) {
            VXUI.toastWarning(this.t('vx_no_permission', '无权限'));
            return;
        }
        if (this.selectedItems.length === 0) {
            VXUI.toastWarning(this.t('vx_select_items_to_move', '请选择要移动的项目'));
            return;
        }
        
        this.trackUI('vui_filelist[move_selected]');
        // 收集被选中的文件夹ID，用于在树形结构中排除（避免将文件夹移动到自身）
        this._moveExcludeFolderIds = [];
        this.selectedItems.forEach(item => {
            if (item.type === 'folder') {
                this._moveExcludeFolderIds.push(String(item.id));
            }
        });
        
        // 打开移动文件夹模态框
        this.openMoveModal();
    },
    
    // ==================== 移动文件夹模态框 ====================
    
    /**
     * 目录树数据
     */
    _moveDirTree: [],
    _moveExcludeFolderIds: [],
    _moveSelectedFolderId: null,
    
    /**
     * 打开移动文件夹模态框
     */
    openMoveModal() {
        const modalId = 'vx-fl-move-modal';
        
        // 重置状态
        this._moveSelectedFolderId = null;
        
        // 清空搜索和树形结构
        const searchInput = document.getElementById('vx-move-search-input');
        const searchClear = document.getElementById('vx-move-search-clear');
        const searchResults = document.getElementById('vx-move-search-results');
        const treeWrapper = document.getElementById('vx-move-tree-wrapper');
        const treeRoot = document.getElementById('vx-move-tree-root');
        const loading = document.getElementById('vx-move-loading');
        
        if (searchInput) searchInput.value = '';
        if (searchClear) searchClear.style.display = 'none';
        if (searchResults) {
            searchResults.style.display = 'none';
            searchResults.innerHTML = '';
        }
        if (treeRoot) treeRoot.innerHTML = '';
        if (treeWrapper) treeWrapper.style.display = 'block';
        if (loading) loading.style.display = 'flex';
        
        // 打开模态框
        if (typeof VXUI !== 'undefined' && VXUI && typeof VXUI.openModal === 'function') {
            VXUI.openModal(modalId);
        } else {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.add('vx-modal-open');
                document.body.classList.add('vx-modal-body-open');
            }
        }
        
        // 加载目录树数据
        this.loadMoveDirTree();
    },
    
    /**
     * 关闭移动文件夹模态框
     */
    closeMoveModal() {
        const modalId = 'vx-fl-move-modal';
        
        if (typeof VXUI !== 'undefined' && VXUI && typeof VXUI.closeModal === 'function') {
            VXUI.closeModal(modalId);
        } else {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.remove('vx-modal-open');
                document.body.classList.remove('vx-modal-body-open');
            }
        }
        
        // 清理状态
        this._moveSelectedFolderId = null;
        this._moveExcludeFolderIds = [];
    },
    
    /**
     * 加载目录树数据
     */
    loadMoveDirTree() {
        const token = this.getToken();
        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';
        
        $.post(apiUrl, {
            action: 'get_dir_tree',
            token: token
        }, (rsp) => {
            const loading = document.getElementById('vx-move-loading');
            if (loading) loading.style.display = 'none';
            
            if (rsp && rsp.status === 1) {
                this._moveDirTree = rsp.data || [];
                // 渲染根目录的子文件夹
                this.renderMoveFolderTree(0);
            } else {
                const treeRoot = document.getElementById('vx-move-tree-root');
                if (treeRoot) {
                    treeRoot.innerHTML = `<div class="vx-move-no-results">${this.t('vx_load_failed_retry', '加载失败，请重试')}</div>`;
                }
            }
        }, 'json').fail(() => {
            const loading = document.getElementById('vx-move-loading');
            if (loading) loading.style.display = 'none';
            
            const treeRoot = document.getElementById('vx-move-tree-root');
            if (treeRoot) {
                treeRoot.innerHTML = `<div class="vx-move-no-results">${this.t('vx_load_failed_retry', '加载失败，请重试')}</div>`;
            }
        });
    },
    
    /**
     * 检查文件夹是否有子文件夹
     */
    moveFolderHasChildren(parentId) {
        for (let folder of this._moveDirTree) {
            // 排除被选中的文件夹
            if (this._moveExcludeFolderIds.includes(String(folder.id))) {
                continue;
            }
            if (String(folder.parent) === String(parentId)) {
                return true;
            }
        }
        return false;
    },
    
    /**
     * 渲染文件夹树
     */
    renderMoveFolderTree(parentId) {
        const containerId = parentId === 0 ? 'vx-move-tree-root' : `vx-move-subtree-${parentId}`;
        const container = document.getElementById(containerId);
        if (!container) return;
        
        let html = '';
        for (let folder of this._moveDirTree) {
            // 排除被选中的文件夹，避免将文件夹移动到自身
            if (this._moveExcludeFolderIds.includes(String(folder.id))) {
                continue;
            }
            
            if (String(folder.parent) === String(parentId)) {
                const hasChildren = this.moveFolderHasChildren(folder.id);
                const iconName = hasChildren ? 'folder-plus' : 'folder';
                
                html += `
                    <div class="vx-move-folder-item" id="vx-move-item-${folder.id}" 
                         data-id="${folder.id}" data-expanded="false"
                         onclick="VX_FILELIST.onMoveFolderClick('${folder.id}')">
                        <span class="vx-move-folder-icon">
                            <iconpark-icon id="vx-move-icon-${folder.id}" name="${iconName}"></iconpark-icon>
                        </span>
                        <span class="vx-move-folder-name">${this.escapeHtml(folder.name)}</span>
                    </div>
                    <div class="vx-move-subtree" id="vx-move-subtree-${folder.id}" style="display: none;"></div>
                `;
            }
        }
        
        container.innerHTML = html;
    },
    
    /**
     * 文件夹点击事件
     */
    onMoveFolderClick(id) {
        const folderItem = document.getElementById(`vx-move-item-${id}`);
        const subtree = document.getElementById(`vx-move-subtree-${id}`);
        const icon = document.getElementById(`vx-move-icon-${id}`);
        
        if (!folderItem) return;
        
        const isExpanded = folderItem.getAttribute('data-expanded') === 'true';
        
        // 处理选中状态
        document.querySelectorAll('.vx-move-folder-item.selected, .vx-move-search-item.selected').forEach(el => {
            el.classList.remove('selected');
        });
        folderItem.classList.add('selected');
        this._moveSelectedFolderId = id;
        
        // 检查是否有子文件夹
        if (this.moveFolderHasChildren(id) && subtree) {
            if (isExpanded) {
                // 收起
                subtree.style.display = 'none';
                folderItem.setAttribute('data-expanded', 'false');
                if (icon) icon.setAttribute('name', 'folder-plus');
            } else {
                // 展开
                if (subtree.children.length === 0) {
                    this.renderMoveFolderTree(id);
                }
                subtree.style.display = 'block';
                folderItem.setAttribute('data-expanded', 'true');
                if (icon) icon.setAttribute('name', 'folder-open');
            }
        }
    },
    
    /**
     * 搜索文件夹
     */
    searchMoveFolder(keyword) {
        keyword = keyword.trim().toLowerCase();
        
        const searchClear = document.getElementById('vx-move-search-clear');
        const searchResults = document.getElementById('vx-move-search-results');
        const treeWrapper = document.getElementById('vx-move-tree-wrapper');
        
        if (keyword === '') {
            this.clearMoveSearch();
            return;
        }
        
        // 显示清除按钮
        if (searchClear) searchClear.style.display = 'flex';
        
        // 搜索匹配的文件夹
        const results = [];
        for (let folder of this._moveDirTree) {
            // 排除被选中要移动的文件夹
            if (this._moveExcludeFolderIds.includes(String(folder.id))) {
                continue;
            }
            if (folder.name.toLowerCase().includes(keyword)) {
                // 构建文件夹路径
                const path = this.buildMoveFolderPath(folder.id);
                results.push({
                    id: folder.id,
                    name: folder.name,
                    path: path
                });
            }
        }
        
        // 显示搜索结果
        this.showMoveSearchResults(results, keyword);
    },
    
    /**
     * 构建文件夹路径
     */
    buildMoveFolderPath(folderId) {
        const pathParts = [];
        let currentId = folderId;
        
        // 向上遍历构建路径
        while (currentId != 0) {
            const folder = this._moveDirTree.find(f => String(f.id) === String(currentId));
            if (!folder) break;
            pathParts.unshift(folder.name);
            currentId = folder.parent;
        }
        
        return '/' + pathParts.join('/');
    },
    
    /**
     * 显示搜索结果
     */
    showMoveSearchResults(results, keyword) {
        const searchResults = document.getElementById('vx-move-search-results');
        const treeWrapper = document.getElementById('vx-move-tree-wrapper');
        
        // 隐藏树形结构，显示搜索结果
        if (treeWrapper) treeWrapper.style.display = 'none';
        if (searchResults) searchResults.style.display = 'block';
        
        if (results.length === 0) {
            const noResultText = (typeof app !== 'undefined' && app.languageData && app.languageData.move_folder_no_result) 
                ? app.languageData.move_folder_no_result 
                : '未找到匹配的文件夹';
            if (searchResults) {
                searchResults.innerHTML = `<div class="vx-move-no-results">${noResultText}</div>`;
            }
            return;
        }
        
        // 渲染搜索结果
        let html = '';
        for (let result of results) {
            html += `
                <div class="vx-move-search-item" id="vx-move-search-${result.id}"
                     data-id="${result.id}" onclick="VX_FILELIST.onMoveSearchResultClick('${result.id}')">
                    <span class="vx-move-folder-icon">
                        <iconpark-icon name="folder"></iconpark-icon>
                    </span>
                    <div class="vx-move-search-info">
                        <span class="vx-move-folder-name">${this.escapeHtml(result.name)}</span>
                        <span class="vx-move-folder-path">${this.escapeHtml(result.path)}</span>
                    </div>
                </div>
            `;
        }
        
        if (searchResults) {
            searchResults.innerHTML = html;
        }
    },
    
    /**
     * 清除搜索
     */
    clearMoveSearch() {
        const searchInput = document.getElementById('vx-move-search-input');
        const searchClear = document.getElementById('vx-move-search-clear');
        const searchResults = document.getElementById('vx-move-search-results');
        const treeWrapper = document.getElementById('vx-move-tree-wrapper');
        
        if (searchInput) searchInput.value = '';
        if (searchClear) searchClear.style.display = 'none';
        if (searchResults) {
            searchResults.style.display = 'none';
            searchResults.innerHTML = '';
        }
        if (treeWrapper) treeWrapper.style.display = 'block';
        
        // 清除搜索结果中的选中状态，但保留树形结构中的选中状态
        document.querySelectorAll('.vx-move-search-item').forEach(el => {
            el.classList.remove('selected');
        });
    },
    
    /**
     * 搜索结果点击事件
     */
    onMoveSearchResultClick(id) {
        // 清除所有选中状态
        document.querySelectorAll('.vx-move-folder-item.selected, .vx-move-search-item.selected').forEach(el => {
            el.classList.remove('selected');
        });
        // 选中当前项
        const item = document.getElementById(`vx-move-search-${id}`);
        if (item) {
            item.classList.add('selected');
        }
        this._moveSelectedFolderId = id;
    },
    
    /**
     * 确认移动
     */
    confirmMove() {
        if (this._moveSelectedFolderId === null || this._moveSelectedFolderId === undefined) {
            VXUI.toastWarning(this.t('vx_select_target_folder', '请选择目标文件夹'));
            return;
        }
        
        // 构建要移动的数据 - 与旧代码格式保持一致
        const data = this.selectedItems.map(item => ({
            id: item.id,
            type: item.type === 'folder' ? 'dir' : 'file'
        }));
        
        const token = this.getToken();
        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';
        
        $.post(apiUrl, {
            action: 'move_to_dir2',
            token: token,
            data: data,
            mr_id: this._moveSelectedFolderId
        }, (rsp) => {
            this.closeMoveModal();
            if (rsp && rsp.status === 1) {
                const movedFileIds = this.selectedItems.filter(item => item.type === 'file').map(item => item.id);
                const movedFolderIds = this.selectedItems.filter(item => item.type === 'folder').map(item => item.id);
                if (movedFileIds.length > 0) {
                    this.removeFilesLocally(movedFileIds, { persist: false, render: false, clearSelection: false });
                }
                if (movedFolderIds.length > 0) {
                    this.removeFoldersLocally(movedFolderIds, { persist: false, render: false, clearSelection: false });
                }
                this.render();
                this.updateItemCount();
                this.persistCurrentSnapshot();
                VXUI.toastSuccess(this.t('vx_move_success', '移动成功'));
                this.clearSelection();
            } else {
                const errorMsg = (rsp && rsp.message) ? rsp.message : this.t('vx_move_failed_retry', '移动失败，请重试');
                VXUI.toastError(errorMsg);
            }
        }, 'json').fail(() => {
            this.closeMoveModal();
            VXUI.toastError(this.t('vx_move_failed_retry', '移动失败，请重试'));
        });
    },
    
    /**
     * 删除选中项
     */
    deleteSelected() {
        // 非所有者不允许删除
        if (!this.isOwner) {
            VXUI.toastWarning(this.t('vx_no_permission', '无权限'));
            return;
        }
        if (this.selectedItems.length === 0) return;
        if (!confirm(this.fmt('vx_confirm_delete_items', { count: this.selectedItems.length }, `确定要删除 ${this.selectedItems.length} 个项目吗？`))) return;
        
        const token = this.getToken();
        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';

        const tasks = this.selectedItems.map((item) => {
            if (item.type === 'folder') {
                return new Promise((resolve) => {
                    $.post(apiUrl, {
                        action: 'delete',
                        token,
                        mr_id: item.id
                    }, (rsp) => resolve(!!(rsp && rsp.status === 1)), 'json').fail(() => resolve(false));
                });
            }

            return this._deleteFileWithFallback(item.id, token);
        });

        Promise.all(tasks).then((results) => {
            const okCount = results.filter(Boolean).length;
            const total = results.length;

            const removedFileIds = [];
            const removedFolderIds = [];
            results.forEach((ok, index) => {
                if (!ok) return;
                const item = this.selectedItems[index];
                if (!item) return;
                if (item.type === 'folder') removedFolderIds.push(item.id);
                if (item.type === 'file') removedFileIds.push(item.id);
            });

            if (removedFileIds.length > 0) {
                this.removeFilesLocally(removedFileIds, { persist: false, render: false, clearSelection: false });
            }
            if (removedFolderIds.length > 0) {
                this.removeFoldersLocally(removedFolderIds, { persist: false, render: false, clearSelection: false });
            }

            this.clearSelection();
            this.render();
            this.updateItemCount();
            if (okCount > 0) {
                this.persistCurrentSnapshot();
            }

            if (okCount === total) {
                VXUI.toastSuccess(this.t('vx_delete_success', '删除成功'));
            } else {
                VXUI.toastError(this.fmt('vx_delete_partial', { ok: okCount, total }, `删除完成：成功 ${okCount} / ${total}，部分失败`));
            }
        });
    },
    
    // ==================== 右键菜单 ====================

    ensureContextMenu() {
        let menu = document.getElementById('vx-fl-context-menu');
        if (menu) return menu;

        // 兜底：模板未包含菜单时动态创建
        menu = document.createElement('div');
        menu.className = 'vx-context-menu';
        menu.id = 'vx-fl-context-menu';
        menu.innerHTML = `
            <div class="vx-context-item" id="vx-fl-menu-open" onclick="VX_FILELIST.openContextItem()">
                <iconpark-icon name="folder-open-e1ad2j7l"></iconpark-icon>
                <span data-tpl="vx_open">打开</span>
            </div>
            <div class="vx-context-item" id="vx-fl-menu-download" onclick="VX_FILELIST.downloadContextItem()">
                <iconpark-icon name="cloud-arrow-down"></iconpark-icon>
                <span data-tpl="on_select_download">下载</span>
            </div>
            <div class="vx-context-item" id="vx-fl-menu-rename" onclick="VX_FILELIST.renameContextItem()">
                <iconpark-icon name="pen-to-square"></iconpark-icon>
                <span data-tpl="menu_rename">重命名</span>
            </div>
            <div class="vx-context-item" id="vx-fl-menu-direct-share" onclick="VX_FILELIST.directShareContextItem()">
                <iconpark-icon name="share-from-square"></iconpark-icon>
                <span data-tpl="vx_direct_share">通过直链分享</span>
            </div>

            <div class="vx-context-divider" id="vx-fl-menu-stream-divider" style="display:none;"></div>
            <div class="vx-context-label" id="vx-fl-menu-stream-label" style="display:none;" data-tpl="file_btn_play">在线观看</div>
            <div class="vx-context-item" id="vx-fl-menu-stream-browser" style="display:none;" onclick="VX_FILELIST.streamContextItem('web')">
                <iconpark-icon name="browser"></iconpark-icon>
                <span>Browser</span>
            </div>
            <div class="vx-context-item" id="vx-fl-menu-stream-potplayer" style="display:none;" onclick="VX_FILELIST.streamContextItem('potplayer')">
                <iconpark-icon name="send-backward"></iconpark-icon>
                <span>PotPlayer</span>
            </div>
            <div class="vx-context-item" id="vx-fl-menu-stream-iina" style="display:none;" onclick="VX_FILELIST.streamContextItem('iina')">
                <iconpark-icon name="send-backward"></iconpark-icon>
                <span>IINA</span>
            </div>
            <div class="vx-context-item" id="vx-fl-menu-stream-nplayer" style="display:none;" onclick="VX_FILELIST.streamContextItem('nplayer')">
                <iconpark-icon name="send-backward"></iconpark-icon>
                <span>nPlayer</span>
            </div>
            <div class="vx-context-item" id="vx-fl-menu-stream-copy" style="display:none;" onclick="VX_FILELIST.streamContextItem('copy')">
                <iconpark-icon name="copy"></iconpark-icon>
                <span>Stream URL</span>
            </div>

            <div class="vx-context-divider" id="vx-fl-menu-expire-divider"></div>
            <div class="vx-context-label" id="vx-fl-menu-expire-label" data-tpl="on_select_change_model">修改有效期</div>
            <div class="vx-context-item" id="vx-fl-menu-expire-3" onclick="VX_FILELIST.setExpireContextItem(99)">
                <iconpark-icon name="infinity"></iconpark-icon>
                <span data-tpl="modal_settings_upload_model99">永久保存</span>
            </div>
            <div class="vx-context-item" id="vx-fl-menu-expire-0" onclick="VX_FILELIST.setExpireContextItem(0)">
                <iconpark-icon name="clock"></iconpark-icon>
                <span data-tpl="modal_settings_upload_model1">24 小时</span>
            </div>
            <div class="vx-context-item" id="vx-fl-menu-expire-1" onclick="VX_FILELIST.setExpireContextItem(1)">
                <iconpark-icon name="clock"></iconpark-icon>
                <span data-tpl="modal_settings_upload_model2">3 天</span>
            </div>
            <div class="vx-context-item" id="vx-fl-menu-expire-2" onclick="VX_FILELIST.setExpireContextItem(2)">
                <iconpark-icon name="clock"></iconpark-icon>
                <span data-tpl="modal_settings_upload_model3">7 天</span>
            </div>

            <div class="vx-context-divider" id="vx-fl-menu-price-divider" style="display:none;"></div>
            <div class="vx-context-label" id="vx-fl-menu-price-label" style="display:none;">售价管理</div>
            <div class="vx-context-item" id="vx-fl-menu-set-price" style="display:none;" onclick="VX_FILELIST.setFilePriceCM()">
                <iconpark-icon name="funds"></iconpark-icon>
                <span>设定售价</span>
            </div>
            <div class="vx-context-item vx-text-danger" id="vx-fl-menu-remove-price" style="display:none;" onclick="VX_FILELIST.removeFilePriceCM()">
                <iconpark-icon name="circle-xmark"></iconpark-icon>
                <span>取消售价</span>
            </div>

            <div class="vx-context-divider"></div>
            <div class="vx-context-item vx-text-danger" id="vx-fl-menu-delete" onclick="VX_FILELIST.deleteContextItem()">
                <iconpark-icon name="trash"></iconpark-icon>
                <span data-tpl="menu_delete">删除</span>
            </div>
        `;

        document.body.appendChild(menu);

        // 翻译动态创建的菜单
        if (typeof TL !== 'undefined' && TL && typeof TL.tpl_lang === 'function') {
            TL.tpl_lang(menu);
        }
        return menu;
    },

    showContextMenu(x, y, target, mode = 'context') {
        this.contextTarget = target;
        this.contextMode = mode || 'context';

        const menu = this.ensureContextMenu();
        if (!menu) return;

        this.updateContextMenuForTarget();

        // 先显示确保可测量尺寸
        menu.classList.add('show');

        const menuRect = menu.getBoundingClientRect();
        const padding = 8;

        let left = x;
        let top = y;

        // 菜单使用 position: fixed，使用视口坐标
        const maxLeft = window.innerWidth - menuRect.width - padding;
        const maxTop = window.innerHeight - menuRect.height - padding;
        const minLeft = padding;
        const minTop = padding;

        if (left > maxLeft) left = maxLeft;
        if (top > maxTop) top = maxTop;
        if (left < minLeft) left = minLeft;
        if (top < minTop) top = minTop;

        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
    },
    
    hideContextMenu() {
        const menu = document.getElementById('vx-fl-context-menu');
        if (menu) menu.classList.remove('show');
        this.contextTarget = null;
        this.contextMode = 'context';
    },

    /**
     * 打开文件夹的更多菜单 (移动端使用 Action Sheet 风格)
     */
    openFolderMoreMenu(event, mrid, isOwner, canShare, isFavorite) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        const folder = (this.folderList || []).find(f => String(f.mr_id) === String(mrid));
        const folderName = folder ? folder.name : '';
        
        // 构建菜单项
        let menuItems = [];
        
        if (canShare) {
            menuItems.push({
                icon: 'share-from-square',
                text: this.t('share', '分享'),
                action: () => this.shareFolder(mrid, this.buildFolderShareUrl(mrid))
            });
        }
        
        if (isOwner) {
            menuItems.push({
                icon: 'pen-to-square',
                text: this.t('on_select_rename', '重命名'),
                action: () => this.renameFolder(mrid)
            });
            menuItems.push({
                icon: 'trash',
                text: this.t('on_select_delete', '删除'),
                danger: true,
                action: () => this.deleteFolder(mrid)
            });
        }
        
        if (isFavorite && !isOwner) {
            menuItems.push({
                icon: 'trash',
                text: this.t('vx_unfavorite', '取消收藏'),
                danger: true,
                action: () => this.unfavoriteFolder(mrid)
            });
        }
        
        if (menuItems.length === 0) return;
        
        // 使用 VXUI 的 action sheet 或自定义弹出菜单
        if (typeof VXUI !== 'undefined' && typeof VXUI.showActionSheet === 'function') {
            VXUI.showActionSheet(folderName || this.t('filelist_dir', '文件夹'), menuItems);
        } else {
            // 降级使用原有的上下文菜单
            const row = document.querySelector(`.vx-list-row[data-mrid="${mrid}"]`);
            if (row) {
                const btn = event && event.target ? event.target.closest('.vx-more-btn') : null;
                if (btn) {
                    const rect = btn.getBoundingClientRect();
                    this.showFolderContextMenu(rect.left, rect.bottom, mrid, isOwner, canShare, isFavorite);
                }
            }
        }
    },
    
    /**
     * 显示文件夹上下文菜单 (降级方案)
     */
    showFolderContextMenu(x, y, mrid, isOwner, canShare, isFavorite) {
        // 简单实现：直接执行第一个可用操作或显示 alert
        let actions = [];
        if (canShare) actions.push('分享');
        if (isOwner) actions.push('重命名', '删除');
        if (isFavorite && !isOwner) actions.push('取消收藏');
        
        // 使用原生 confirm 作为临时方案
        const actionText = actions.join(' / ');
        if (isOwner && confirm(`要对此文件夹执行操作吗？\n可用操作: ${actionText}\n\n点击确定删除，取消则关闭`)) {
            this.deleteFolder(mrid);
        }
    },

    openMoreMenu(event, row) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const target = row || (event && event.target && event.target.closest
            ? event.target.closest('.vx-list-row')
            : null);
        if (!target) return;

        // 移动端使用 Action Sheet
        const isMobile = window.innerWidth <= 768;
        if (isMobile && typeof VXUI !== 'undefined' && typeof VXUI.showActionSheet === 'function') {
            this.openMobileActionSheet(target);
            return;
        }

        // 从 event.target 找到实际的按钮元素
        const btn = event && event.target ? event.target.closest('.vx-more-btn') : null;
        
        if (btn) {
            // Bootstrap 风格定位：菜单出现在按钮正下方，右对齐
            const rect = btn.getBoundingClientRect();
            const menu = this.ensureContextMenu();
            
            // 先显示菜单以获取实际尺寸
            menu.style.visibility = 'hidden';
            menu.classList.add('show');
            const menuRect = menu.getBoundingClientRect();
            const menuWidth = menuRect.width || 180;
            const menuHeight = menuRect.height || 280;
            menu.classList.remove('show');
            menu.style.visibility = '';
            
            let x, y;
            
            // 水平方向：菜单右边缘与按钮右边缘对齐（右对齐）
            x = rect.right - menuWidth;
            
            // 如果左侧超出视口，则左对齐
            if (x < 8) {
                x = rect.left;
            }
            
            // 如果右侧超出视口，则靠右
            if (x + menuWidth > window.innerWidth - 8) {
                x = window.innerWidth - menuWidth - 8;
            }
            
            // 垂直方向：优先在按钮下方
            if (rect.bottom + menuHeight + 8 <= window.innerHeight) {
                y = rect.bottom + 4;
            } else {
                // 下方空间不足，显示在上方
                y = rect.top - menuHeight - 4;
            }
            
            // 确保不超出视口
            y = Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8));
            
            this.showContextMenu(x, y, target, 'more');
        } else {
            // 降级：使用鼠标点击位置
            const x = event && typeof event.clientX === 'number' ? event.clientX : 100;
            const y = event && typeof event.clientY === 'number' ? event.clientY : 100;
            this.showContextMenu(x, y, target, 'more');
        }
    },

    /**
     * 移动端 Action Sheet 菜单
     */
    openMobileActionSheet(target) {
        const type = target.dataset.type;
        const isFile = type === 'file';
        const isFolder = type === 'folder';
        const canOwnerOps = !!this.isOwner;
        const canDirectShare = isFile && this.isOwner && this.directDomainReady;
        
        let menuItems = [];
        let title = '';
        
        if (isFile) {
            const ukey = target.dataset.ukey;
            const file = this.fileList.find(f => f.ukey === ukey);
            title = file ? (file.fname_ex || file.fname) : this.t('file', '文件');
            const currentModel = file ? file.model : -1;
            const fileName = file ? (file.fname_ex || file.fname || '') : '';
            const fileOwner = file ? file.owner : null;
            
            // 下载
            menuItems.push({
                icon: 'cloud-arrow-down',
                text: this.t('on_select_download', '下载'),
                action: () => this.downloadFile(ukey)
            });
            
            // 重命名
            if (canOwnerOps) {
                menuItems.push({
                    icon: 'pen-to-square',
                    text: this.t('menu_rename', '重命名'),
                    action: () => this.renameFile(ukey, file ? (file.fname_ex || file.fname) : '')
                });
            }
            
            // 直链分享
            if (canDirectShare) {
                menuItems.push({
                    icon: 'share-from-square',
                    text: this.t('vx_direct_share', '通过直链分享'),
                    action: () => this.copyDirectFileLinkByUkey(ukey)
                });
            }

            // 视频流媒体选项（赞助者专用）
            const canStreamBrowser = this.checkStreamAllow(fileName, fileOwner);
            const canStreamApps = this.checkStreamForOpenOnApps(fileName, fileOwner);
            if (canStreamBrowser || canStreamApps) {
                // 添加分组标题
                menuItems.push({
                    type: 'label',
                    text: this.t('file_btn_play', '在线观看')
                });
                
                // Browser 播放
                if (canStreamBrowser) {
                    menuItems.push({
                        icon: 'browser',
                        text: 'Browser',
                        action: () => this.requestStream(ukey, 'web')
                    });
                }
                
                // 外部播放器选项
                if (canStreamApps) {
                    menuItems.push({
                        icon: 'send-backward',
                        text: 'PotPlayer',
                        action: () => this.requestStream(ukey, 'potplayer')
                    });
                    menuItems.push({
                        icon: 'send-backward',
                        text: 'IINA',
                        action: () => this.requestStream(ukey, 'iina')
                    });
                    menuItems.push({
                        icon: 'send-backward',
                        text: 'nPlayer',
                        action: () => this.requestStream(ukey, 'nplayer')
                    });
                    menuItems.push({
                        icon: 'copy',
                        text: 'Stream URL',
                        action: () => this.requestStream(ukey, 'copy')
                    });
                }
            }
            
            // 修改有效期（仅所有者，排除当前有效期）
            if (canOwnerOps) {
                // 添加分组标题
                menuItems.push({
                    type: 'label',
                    text: this.t('on_select_change_model', '修改有效期')
                });
                
                // 永久保存 (model: 99)
                if (currentModel !== 99) {
                    menuItems.push({
                        icon: 'infinity',
                        text: this.t('modal_settings_upload_model99', '永久保存'),
                        action: () => this.changeFileModel(ukey, 99)
                    });
                }
                // 24 小时 (model: 0)
                if (currentModel !== 0) {
                    menuItems.push({
                        icon: 'clock',
                        text: this.t('modal_settings_upload_model1', '24 小时'),
                        action: () => this.changeFileModel(ukey, 0)
                    });
                }
                // 3 天 (model: 1)
                if (currentModel !== 1) {
                    menuItems.push({
                        icon: 'clock',
                        text: this.t('modal_settings_upload_model2', '3 天'),
                        action: () => this.changeFileModel(ukey, 1)
                    });
                }
                // 7 天 (model: 2)
                if (currentModel !== 2) {
                    menuItems.push({
                        icon: 'clock',
                        text: this.t('modal_settings_upload_model3', '7 天'),
                        action: () => this.changeFileModel(ukey, 2)
                    });
                }
            }
            
            // 售价管理（仅 owner + 赞助者）
            if (canOwnerOps && this._isSponsor()) {
                const fileObj = (this.fileList || []).find(f => String(f.ukey) === String(ukey));
                const isForSale = fileObj && fileObj.for_sale;
                menuItems.push({
                    type: 'label',
                    text: this.t('vx_price_manage', '售价管理')
                });
                menuItems.push({
                    icon: 'funds',
                    text: isForSale
                        ? this.t('vx_update_price', '修改售价')
                        : this.t('vx_set_price', '设定售价'),
                    action: () => this.setFilePriceModal(ukey)
                });
                if (isForSale) {
                    menuItems.push({
                        icon: 'circle-xmark',
                        text: this.t('vx_remove_price', '取消售价（恢复免费）'),
                        danger: true,
                        action: () => this.confirmRemoveFilePrice(ukey)
                    });
                }
            }

            // 删除
            if (canOwnerOps) {
                menuItems.push({
                    icon: 'trash',
                    text: this.t('menu_delete', '删除文件'),
                    danger: true,
                    action: () => this.deleteFile(ukey)
                });
            }
        } else if (isFolder) {
            const mrid = target.dataset.mrid;
            const folder = (this.subRooms || []).find(f => String(f.mr_id) === String(mrid));
            title = folder ? folder.name : this.t('filelist_dir', '文件夹');
            
            // 打开
            menuItems.push({
                icon: 'folder-open-e1ad2j7l',
                text: this.t('vx_open', '打开'),
                action: () => this.openFolder(mrid)
            });
            
            // 重命名
            if (canOwnerOps) {
                menuItems.push({
                    icon: 'pen-to-square',
                    text: this.t('menu_rename', '重命名'),
                    action: () => this.renameFolder(mrid)
                });
            }
            
            // 删除
            if (canOwnerOps) {
                menuItems.push({
                    icon: 'trash',
                    text: this.t('menu_delete_folder', '删除文件夹'),
                    danger: true,
                    action: () => this.deleteFolder(mrid)
                });
            }
        }
        
        if (menuItems.length > 0) {
            VXUI.showActionSheet(title, menuItems);
        }
    },

    updateContextMenuForTarget() {
        const target = this.contextTarget;
        if (!target) return;

        const type = target.dataset.type;
        const isFile = type === 'file';
        const canOwnerOps = !!this.isOwner;
        const canDirectShare = isFile && this.isOwner && this.directDomainReady;

        const elOpen = document.getElementById('vx-fl-menu-open');
        const elDownload = document.getElementById('vx-fl-menu-download');
        const elRename = document.getElementById('vx-fl-menu-rename');
        const elDelete = document.getElementById('vx-fl-menu-delete');
        const elDirectShare = document.getElementById('vx-fl-menu-direct-share');
        const elExpireDivider = document.getElementById('vx-fl-menu-expire-divider');
        const elExpire0 = document.getElementById('vx-fl-menu-expire-0');
        const elExpire1 = document.getElementById('vx-fl-menu-expire-1');
        const elExpire2 = document.getElementById('vx-fl-menu-expire-2');
        const elExpire3 = document.getElementById('vx-fl-menu-expire-3');
        const elExpireLabel = document.getElementById('vx-fl-menu-expire-label');

        // “更多(...)”菜单：仅显示扩展操作（重命名/删除/直链/有效期）
        if (this.contextMode === 'more') {
            if (elOpen) elOpen.style.display = 'none';
            if (elDownload) elDownload.style.display = 'none';
        } else {
            if (elOpen) elOpen.style.display = '';
            if (elDownload) elDownload.style.display = '';
        }

        // 文件夹：隐藏直链与有效期
        if (elDirectShare) elDirectShare.style.display = canDirectShare ? '' : 'none';
        if (elExpireDivider) elExpireDivider.style.display = isFile ? '' : 'none';

        // 获取当前文件的 model（有效期）
        const ukey = target.dataset.ukey;
        const file = isFile ? (this.fileList || []).find(f => String(f.ukey) === String(ukey)) : null;
        const currentModel = (file && file.model !== undefined && file.model !== null && file.model !== '')
            ? Number(file.model)
            : null;

        // 检查私有空间是否足够显示"永久保存"选项
        const fileSize = file ? (Number(file.fsize) || 0) : 0;
        const storageTotal = (typeof TL !== 'undefined' && TL.storage) ? Number(TL.storage) : 0;
        const privateUsed = (typeof TL !== 'undefined' && TL.private_storage_used) ? Number(TL.private_storage_used) : 0;
        const remainingSpace = storageTotal - privateUsed;
        const canSetPermanent = (fileSize <= remainingSpace);

        // 显示"修改有效期"标签
        if (elExpireLabel) elExpireLabel.style.display = (isFile && canOwnerOps) ? '' : 'none';

        // 根据当前 model 隐藏对应的有效期选项（不显示已选中的选项）
        // 注意：永久保存的 model 值是 99
        if (elExpire0) elExpire0.style.display = (isFile && canOwnerOps && currentModel !== 0) ? '' : 'none';
        if (elExpire1) elExpire1.style.display = (isFile && canOwnerOps && currentModel !== 1) ? '' : 'none';
        if (elExpire2) elExpire2.style.display = (isFile && canOwnerOps && currentModel !== 2) ? '' : 'none';
        // 永久保存选项（model=99）：除了检查 currentModel，还需检查私有空间是否足够
        if (elExpire3) elExpire3.style.display = (isFile && canOwnerOps && currentModel !== 99 && canSetPermanent) ? '' : 'none';

        // 显示有效期分隔线
        if (elExpireDivider) elExpireDivider.style.display = (isFile && canOwnerOps) ? '' : 'none';

        // 视频流媒体选项（赞助者专用）
        const fileName = file ? (file.fname_ex || file.fname || '') : '';
        const fileOwner = file ? file.owner : null;
        const canStreamBrowser = isFile && this.checkStreamAllow(fileName, fileOwner);
        const canStreamApps = isFile && this.checkStreamForOpenOnApps(fileName, fileOwner);
        const showStreamOptions = canStreamBrowser || canStreamApps;

        const elStreamDivider = document.getElementById('vx-fl-menu-stream-divider');
        const elStreamLabel = document.getElementById('vx-fl-menu-stream-label');
        const elStreamBrowser = document.getElementById('vx-fl-menu-stream-browser');
        const elStreamPotplayer = document.getElementById('vx-fl-menu-stream-potplayer');
        const elStreamIina = document.getElementById('vx-fl-menu-stream-iina');
        const elStreamNplayer = document.getElementById('vx-fl-menu-stream-nplayer');
        const elStreamCopy = document.getElementById('vx-fl-menu-stream-copy');

        if (elStreamDivider) elStreamDivider.style.display = showStreamOptions ? '' : 'none';
        if (elStreamLabel) elStreamLabel.style.display = showStreamOptions ? '' : 'none';
        if (elStreamBrowser) elStreamBrowser.style.display = canStreamBrowser ? '' : 'none';
        if (elStreamPotplayer) elStreamPotplayer.style.display = canStreamApps ? '' : 'none';
        if (elStreamIina) elStreamIina.style.display = canStreamApps ? '' : 'none';
        if (elStreamNplayer) elStreamNplayer.style.display = canStreamApps ? '' : 'none';
        if (elStreamCopy) elStreamCopy.style.display = canStreamApps ? '' : 'none';

        // 非 owner：隐藏重命名/删除
        if (elRename) elRename.style.display = canOwnerOps ? '' : 'none';
        if (elDelete) elDelete.style.display = canOwnerOps ? '' : 'none';

        // 售价管理（仅 owner + 赞助者 + 文件类型）
        const canManagePrice = isFile && canOwnerOps && this._isSponsor();
        const elPriceDivider = document.getElementById('vx-fl-menu-price-divider');
        const elPriceLabel = document.getElementById('vx-fl-menu-price-label');
        const elSetPrice = document.getElementById('vx-fl-menu-set-price');
        const elRemovePrice = document.getElementById('vx-fl-menu-remove-price');
        const fileForSale = file && file.for_sale;
        if (elPriceDivider) elPriceDivider.style.display = canManagePrice ? '' : 'none';
        if (elPriceLabel) elPriceLabel.style.display = canManagePrice ? '' : 'none';
        if (elSetPrice) {
            elSetPrice.style.display = canManagePrice ? '' : 'none';
            const setPriceSpan = elSetPrice.querySelector('span');
            if (setPriceSpan) {
                setPriceSpan.textContent = fileForSale
                    ? this.t('vx_update_price', '调整价格')
                    : this.t('vx_sell_file', '出售');
            }
        }
        if (elRemovePrice) elRemovePrice.style.display = (canManagePrice && fileForSale) ? '' : 'none';
    },

    /**
     * 右键菜单 - 设定售价
     */
    setFilePriceCM() {
        if (!this.contextTarget) return;
        const ukey = this.contextTarget.dataset.ukey;
        this.hideContextMenu();
        this.setFilePriceModal(ukey);
    },

    /**
     * 右键菜单 - 取消售价
     */
    removeFilePriceCM() {
        if (!this.contextTarget) return;
        const ukey = this.contextTarget.dataset.ukey;
        this.hideContextMenu();
        this.confirmRemoveFilePrice(ukey);
    },
    
    openContextItem() {
        if (!this.contextTarget) return;
        const type = this.contextTarget.dataset.type;
        if (type === 'folder') {
            this.openFolder(this.contextTarget.dataset.mrid);
        } else {
            this.previewFile(this.contextTarget.dataset.ukey);
        }
        this.hideContextMenu();
    },
    
    downloadContextItem() {
        if (!this.contextTarget) return;
        if (this.contextTarget.dataset.type === 'file') {
            this.downloadFile(this.contextTarget.dataset.ukey);
        }
        this.hideContextMenu();
    },
    
    renameContextItem() {
        if (!this.contextTarget) return;
        const type = this.contextTarget.dataset.type;
        if (type === 'folder') {
            this.renameFolder(this.contextTarget.dataset.mrid);
        } else {
            const file = this.fileList.find(f => f.ukey === this.contextTarget.dataset.ukey);
            if (file) this.renameFile(file.ukey, file.fname_ex || file.fname);
        }
        this.hideContextMenu();
    },
    

    directShareContextItem() {
        if (!this.contextTarget) return;
        const type = this.contextTarget.dataset.type;
        if (type !== 'file') {
            this.hideContextMenu();
            return;
        }
        this.copyDirectFileLinkByUkey(this.contextTarget.dataset.ukey);
        this.hideContextMenu();
    },

    setExpireContextItem(model) {
        if (!this.contextTarget) return;
        const type = this.contextTarget.dataset.type;
        if (type !== 'file') {
            this.hideContextMenu();
            return;
        }
        if (!this.isOwner) {
            VXUI.toastWarning(this.t('vx_no_permission', '无权限'));
            this.hideContextMenu();
            return;
        }
        this.changeFileModel(this.contextTarget.dataset.ukey, model);
        this.hideContextMenu();
    },

    changeFileModel(ukey, model) {
        const token = this.getToken();
        if (!token) {
            VXUI.toastError(this.t('vx_not_logged_in', '未登录'));
            return;
        }

        this.trackUI(`vui_filelist[change_model_${model}]`);
        // 对齐老版：使用 ukeys 数组
        const apiUrl = (typeof TL !== 'undefined' && TL.api_file)
            ? TL.api_file
            : ((typeof TL !== 'undefined' && TL.api_url) ? (TL.api_url + '/file') : '/api_v2/file');

        // model → 新 lefttime（Unix 秒）的估算：0=24h, 1=3d, 2=7d, 99=永久
        const modelDuration = { 0: 86400, 1: 259200, 2: 604800, 99: 0 };

        $.post(apiUrl, {
            action: 'change_model',
            token: token,
            ukeys: [ukey],
            model: model
        }, (rsp) => {
            if (rsp && rsp.status === 1) {
                VXUI.toastSuccess(this.t('vx_update_success', '修改成功'));
                this.updateFileLocally(ukey, (fileToUpdate) => {
                    fileToUpdate.model = model;
                    fileToUpdate.lefttime = modelDuration[model] || 0;
                }, { patchRow: true, persist: true });
                return;
            }
            // 处理不同的错误状态
            if (rsp && rsp.status === 2) {
                VXUI.toastError(this.t('vx_storage_insufficient', '存储空间不足'));
            } else {
                VXUI.toastError(this.t('vx_update_failed', '修改失败'));
            }
        }, 'json').fail(() => {
            VXUI.toastError(this.t('vx_update_failed', '修改失败'));
        });
    },

    // ==================== 视频流媒体 (赞助者专用) ====================

    // 支持浏览器播放的视频格式
    streamCanplayList: [
        ['video/mp4', 'mp4'],
        ['video/webm', 'webm'],
        ['video/ogg', 'ogg'],
        ['video/quicktime', 'mov'],
        ['video/3gpp', '3gp'],
        ['video/mpeg', 'mpeg'],
    ],

    // 支持外部播放器的视频格式
    streamOpenOnAppsExt: ['mp4', 'webm', 'ogg', 'mov', '3gp', 'mpeg', 'mkv', 'rm', 'rmvb', 'avi', 'm4v', 'flv', 'wmv', 'mpv'],

    // 浏览器支持的视频格式缓存
    _streamAllowExt: null,

    /**
     * 获取浏览器支持播放的视频格式列表
     */
    getStreamAllowExt() {
        if (this._streamAllowExt !== null) {
            return this._streamAllowExt;
        }
        this._streamAllowExt = [];
        const video = document.createElement('video');
        for (const [mimeType, ext] of this.streamCanplayList) {
            const canplay = video.canPlayType(mimeType);
            if (canplay === 'probably' || canplay === 'maybe') {
                this._streamAllowExt.push(ext);
            }
        }
        return this._streamAllowExt;
    },

    /**
     * 检查浏览器是否可以播放该视频格式（赞助者专用）
     */
    checkStreamAllow(filename, owner) {
        // 需要登录
        if (typeof TL === 'undefined' || TL.logined !== 1) {
            return false;
        }
        // 需要是赞助者
        if (TL.sponsor === false) {
            return false;
        }
        // 检查文件格式
        const allowExt = this.getStreamAllowExt();
        if (allowExt.length === 0) {
            return false;
        }
        const ext = (filename || '').substring((filename || '').lastIndexOf('.') + 1).toLowerCase();
        return allowExt.some(e => ext.indexOf(e) > -1);
    },

    /**
     * 检查是否可以使用外部播放器打开
     */
    checkStreamForOpenOnApps(filename, owner) {
        // 需要登录
        if (typeof TL === 'undefined' || TL.logined !== 1) {
            return false;
        }
        // 文件不是自己的，需要是赞助者
        if (owner !== TL.uid) {
            if (TL.sponsor === false) {
                return false;
            }
        }
        // 检查文件格式
        const ext = (filename || '').substring((filename || '').lastIndexOf('.') + 1).toLowerCase();
        return this.streamOpenOnAppsExt.some(e => ext.indexOf(e) > -1);
    },

    /**
     * 右键菜单中选择视频播放方式
     */
    streamContextItem(playerApp) {
        if (!this.contextTarget) return;
        const type = this.contextTarget.dataset.type;
        if (type !== 'file') {
            this.hideContextMenu();
            return;
        }
        const ukey = this.contextTarget.dataset.ukey;
        this.requestStream(ukey, playerApp);
        this.hideContextMenu();
    },

    /**
     * 请求视频流并使用指定播放器播放 (VXUI 专用实现)
     */
    requestStream(ukey, playerApp) {
        // 检查登录状态
        if (typeof TL === 'undefined' || TL.logined !== 1) {
            VXUI.toastWarning(this.t('vx_need_login', '请先登录'));
            return;
        }

        this.trackUI(`vui_filelist[stream_${playerApp}]`);

        const token = this.getToken();
        const apiUrl = (typeof TL !== 'undefined' && TL.api_file)
            ? TL.api_file
            : '/api_v2/file';

        // 显示加载提示
        VXUI.toastInfo(this.t('vx_loading', '加载中...'));

        // 请求流媒体 URL
        $.post(apiUrl, {
            action: 'stream_req',
            ukey: ukey,
            token: token,
            captcha: '0'
        }, (req) => {
            if (req && req.status == 1) {
                this.playStreamWith(req.data, playerApp);
            } else {
                VXUI.toastError(this.t('vx_stream_error', '获取播放地址失败'));
            }
        }, 'json').fail(() => {
            VXUI.toastError(this.t('vx_stream_error', '获取播放地址失败'));
        });
    },

    /**
     * 使用指定播放器播放视频流
     */
    async playStreamWith(url, playerApp) {
        switch (playerApp) {
            case 'vlc':
                this.openExternalPlayer('vlc://', url, 'VLC');
                break;
            case 'iina':
                this.openExternalPlayer('iina://weblink?url=', url, 'IINA');
                break;
            case 'potplayer':
                this.openExternalPlayer('potplayer://', url, 'PotPlayer');
                break;
            case 'kmplayer':
                this.openExternalPlayer('kmplayer://', url, 'KMPlayer');
                break;
            case 'nplayer':
                this.openExternalPlayer('nplayer-https://', url, 'nPlayer');
                break;
            case 'copy':
                await this.copyStreamUrl(url);
                break;
            default:
                // web - 在浏览器中播放
                this.playInBrowser(url);
        }
    },

    /**
     * 在浏览器中播放视频
     */
    playInBrowser(url) {
        const player = 'https://ix.ng-ccc.com/go.html?stream=' + btoa(url);
        window.open(player, '_blank');
    },

    /**
     * 复制流媒体地址
     */
    async copyStreamUrl(url) {
        try {
            if (typeof copyToClip === 'function') {
                await copyToClip(url);
            } else {
                await navigator.clipboard.writeText(url);
            }
            VXUI.toastSuccess(this.t('copied', '已复制'));
        } catch (e) {
            VXUI.toastError(this.t('vx_copy_failed', '复制失败'));
        }
    },

    /**
     * 尝试打开外部播放器，失败时复制链接并提示
     */
    openExternalPlayer(scheme, url, playerName) {
        const fullUrl = scheme + url;

        // 使用 iframe 方式尝试打开，避免直接 location.href 导致页面跳转失败
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        // 设置超时检测
        const timeout = setTimeout(() => {
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
            // 如果超时，说明可能没有安装播放器，复制链接并提示
            const msg = this.t('player_not_installed', '{player} 未安装，已复制播放地址').replace('{player}', playerName);
            VXUI.toastError(msg);
            this.copyStreamUrl(url);
        }, 2000);

        // 监听页面可见性变化（如果播放器成功打开，页面会失去焦点）
        const handleVisibility = () => {
            if (document.hidden) {
                clearTimeout(timeout);
                document.removeEventListener('visibilitychange', handleVisibility);
                setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                    }
                }, 100);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        // 尝试打开
        try {
            iframe.contentWindow.location.href = fullUrl;
        } catch (e) {
            clearTimeout(timeout);
            document.removeEventListener('visibilitychange', handleVisibility);
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
            // 降级：直接尝试打开
            window.location.href = fullUrl;
        }
    },
    
    deleteContextItem() {
        if (!this.contextTarget) return;
        const type = this.contextTarget.dataset.type;
        if (type === 'folder') {
            this.deleteFolder(this.contextTarget.dataset.mrid);
        } else {
            this.deleteFile(this.contextTarget.dataset.ukey);
        }
        this.hideContextMenu();
    },
    
    // ==================== 模态框 ====================
    
    showCreateModal() {
        // 非所有者不允许创建文件夹
        if (!this.isOwner) {
            VXUI.toastWarning(this.t('vx_no_permission', '无权限'));
            return;
        }
        const modalId = 'vx-fl-create-modal';
        const modal = document.getElementById(modalId);
        const input = document.getElementById('vx-fl-folder-name');
        const modelSelect = document.getElementById('vx-fl-folder-model');

        // 对齐老版逻辑：子文件夹强制 model=0
        const mr_id = (this.room && this.room.mr_id !== undefined && this.room.mr_id !== null) ? this.room.mr_id : this.mrid;
        let parent = (this.room && this.room.parent !== undefined && this.room.parent !== null) ? this.room.parent : 0;
        let top = (this.room && this.room.top !== undefined && this.room.top !== null) ? this.room.top : 0;
        if (this.isDesktop || mr_id == 0 || mr_id === '0' || top == 99) {
            top = 99;
            parent = 0;
        }

        if (input) input.value = '';
        if (modelSelect) {
            modelSelect.value = '0';
            // modelSelect.disabled = (Number(parent) > 0);
        }

        // Reset switch status
        const privacySwitch = document.getElementById('vx-fl-create-privacy-switch');
        const privacyHint = document.getElementById('vx-fl-create-privacy-hint');
        if (privacySwitch) {
             const isSubFolder = (Number(parent) > 0);
             privacySwitch.checked = false;
             privacySwitch.disabled = isSubFolder;
        }
        if (privacyHint) {
             privacyHint.innerHTML = this.t('modal_meetingroom_type1', '公开，所有人都可访问。');
        }

        if (typeof VXUI !== 'undefined' && VXUI && typeof VXUI.openModal === 'function') {
            VXUI.openModal(modalId);
        } else if (modal) {
            modal.classList.add('vx-modal-open');
            document.body.classList.add('vx-modal-body-open');
            const firstInput = modal.querySelector('input, textarea, select');
            if (firstInput) setTimeout(() => firstInput.focus(), 100);
        }
    },
    
    closeCreateModal() {
        const modalId = 'vx-fl-create-modal';
        const modal = document.getElementById(modalId);

        if (typeof VXUI !== 'undefined' && VXUI && typeof VXUI.closeModal === 'function') {
            VXUI.closeModal(modalId);
        } else if (modal) {
            modal.classList.remove('vx-modal-open');
            document.body.classList.remove('vx-modal-body-open');
        }
    },
    
    onCreateFolderPrivacyChange(el) {
        const isPrivate = el.checked;
        const modelInput = document.getElementById('vx-fl-folder-model');
        
        if (modelInput) {
            modelInput.value = isPrivate ? '1' : '0';
        }
    },

    createFolder() {
        const name = document.getElementById('vx-fl-folder-name')?.value?.trim();
        if (!name) {
            VXUI.toastWarning(this.t('vx_enter_folder_name', '请输入文件夹名称'));
            return;
        }
        
        this.trackUI('vui_filelist[create_folder]');
        const token = this.getToken();
        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';

        // 对齐老版逻辑：桌面(top=99)时 parent 必须为 0；子文件夹 model 固定为 0
        const mr_id = (this.room && this.room.mr_id !== undefined && this.room.mr_id !== null) ? this.room.mr_id : this.mrid;
        let parent = (this.room && this.room.parent !== undefined && this.room.parent !== null) ? this.room.parent : 0;
        let top = (this.room && this.room.top !== undefined && this.room.top !== null) ? this.room.top : 0;

        if (this.isDesktop || mr_id == 0 || mr_id === '0' || top == 99) {
            top = 99;
            parent = 0;
        }

        let model = 0;
        const modelVal = document.getElementById('vx-fl-folder-model')?.value;
        if (modelVal !== undefined && modelVal !== null && modelVal !== '') {
            const parsed = parseInt(modelVal, 10);
            model = Number.isFinite(parsed) ? parsed : 0;
        }
        // 子文件夹的 model 强制为 0（与老版一致）
        if (Number(parent) > 0) {
            model = 0;
        }
        
        $.post(apiUrl, {
            action: 'create',
            token: token,
            name: name,
            mr_id: mr_id,
            parent: parent,
            top: top,
            model: model
        }, (rsp) => {
            if (rsp.status === 1) {
                this.closeCreateModal();
                const createdId = rsp && rsp.data && (rsp.data.mr_id || rsp.data.id);
                if (createdId !== undefined && createdId !== null && String(createdId) !== '') {
                    this.insertFolderLocally({
                        mr_id: createdId,
                        name: name,
                        ctime: Math.floor(Date.now() / 1000),
                        parent: mr_id,
                        top: top,
                        model: model === 1 ? 'private' : 'public',
                        publish: 'no',
                        type: 'owner',
                        fav: 0,
                        file_count: 0
                    });
                } else {
                    this.refresh();
                }
                VXUI.toastSuccess(this.t('vx_create_success', '创建成功'));
            } else {
                VXUI.toastError(this.t('vx_create_failed', '创建失败'));
            }
        });
    },
    
    showRenameModal() {
        const modalId = 'vx-fl-rename-modal';
        const modal = document.getElementById(modalId);

        if (typeof VXUI !== 'undefined' && VXUI && typeof VXUI.openModal === 'function') {
            VXUI.openModal(modalId);
        } else if (modal) {
            modal.classList.add('vx-modal-open');
            document.body.classList.add('vx-modal-body-open');
            const firstInput = modal.querySelector('input, textarea, select');
            if (firstInput) setTimeout(() => firstInput.focus(), 100);
        }
    },
    
    closeRenameModal() {
        const modalId = 'vx-fl-rename-modal';
        const modal = document.getElementById(modalId);

        if (typeof VXUI !== 'undefined' && VXUI && typeof VXUI.closeModal === 'function') {
            VXUI.closeModal(modalId);
        } else if (modal) {
            modal.classList.remove('vx-modal-open');
            document.body.classList.remove('vx-modal-body-open');
        }
        this._renameTarget = null;
    },

    showReportModal() {
        const modalId = 'vx-fl-report-modal';
        const modal = document.getElementById(modalId);

        if (typeof VXUI !== 'undefined' && VXUI && typeof VXUI.openModal === 'function') {
            VXUI.openModal(modalId);
        } else if (modal) {
            modal.classList.add('vx-modal-open');
            document.body.classList.add('vx-modal-body-open');
        }
    },

    closeReportModal() {
        const modalId = 'vx-fl-report-modal';
        const modal = document.getElementById(modalId);

        if (typeof VXUI !== 'undefined' && VXUI && typeof VXUI.closeModal === 'function') {
            VXUI.closeModal(modalId);
        } else if (modal) {
            modal.classList.remove('vx-modal-open');
            document.body.classList.remove('vx-modal-body-open');
        }
        this._reportTargetMrid = null;
    },

    openFolderReportModal(mrid) {
        const targetMrid = mrid || ((this.room && this.room.mr_id !== undefined && this.room.mr_id !== null) ? this.room.mr_id : this.mrid);
        if (!targetMrid || String(targetMrid) === '0') return;

        this._reportTargetMrid = targetMrid;

        const reasonSelect = document.getElementById('vx-fl-report-reason');
        if (reasonSelect) reasonSelect.selectedIndex = 0;

        const submitBtn = document.getElementById('vx-fl-report-submit');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = this.t('modal_report_submit', '提交');
        }

        this.showReportModal();
    },

    reportFolder() {
        if (!this._reportTargetMrid) return;
        this.trackUI('vui_filelist[report_folder]');
        const token = this.getToken();
        if (!token) {
            VXUI.toastWarning(this.t('vx_need_login', '请先登录'));
            return;
        }

        const reason = document.getElementById('vx-fl-report-reason')?.value || '';
        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';
        const submitBtn = document.getElementById('vx-fl-report-submit');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = this.t('form_btn_processed', '已提交');
        }

        $.post(apiUrl, {
            action: 'report',
            token: token,
            reason: reason,
            mr_id: this._reportTargetMrid
        }, (rsp) => {
            const ok = rsp && (rsp.status === 1 || (rsp.data && rsp.data.status === 'reported'));
            if (ok) {
                VXUI.toastSuccess(this.t('modal_report_success', '举报成功'));
                this.closeReportModal();
            } else {
                VXUI.toastError(this.t('vx_operation_failed', '操作失败'));
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = this.t('modal_report_submit', '提交');
                }
            }
        }, 'json').fail(() => {
            VXUI.toastError(this.t('vx_operation_failed', '操作失败'));
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = this.t('modal_report_submit', '提交');
            }
        });
    },
    
    confirmRename() {
        if (!this._renameTarget) return;
        const renameTarget = this._renameTarget;
        
        const name = document.getElementById('vx-fl-rename-input')?.value?.trim();
        if (!name) {
            VXUI.toastWarning(this.t('vx_enter_new_name', '请输入新名称'));
            return;
        }
        
        const token = this.getToken();
        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';
        
        if (renameTarget.type === 'folder') {
            $.post(apiUrl, {
                action: 'rename',
                token: token,
                name: name,
                mr_id: renameTarget.id
            }, () => {
                this.closeRenameModal();
                this.updateFolderLocally(renameTarget.id, (folder) => {
                    folder.name = name;
                });
                VXUI.toastSuccess(this.t('vx_rename_success', '重命名成功'));
            });
        } else {
            const fileApiUrl = (typeof TL !== 'undefined' && TL.api_file)
                ? TL.api_file
                : ((typeof TL !== 'undefined' && TL.api_url) ? (TL.api_url + '/file') : '/api_v2/file');

            $.post(fileApiUrl, {
                action: 'rename',
                token: token,
                name: name,
                ukey: renameTarget.id
            }, (rsp) => {
                if (rsp && rsp.status === 1) {
                    this.closeRenameModal();
                    this.updateFileLocally(renameTarget.id, (file) => {
                        file.fname = name;
                        file.fname_ex = name;
                    }, { patchRow: false, render: true, persist: true });
                    VXUI.toastSuccess(this.t('vx_rename_success', '重命名成功'));
                } else {
                    VXUI.toastError(this.t('vx_rename_fail', '重命名失败'));
                }
            }, 'json').fail(() => {
                VXUI.toastError(this.t('vx_rename_fail', '重命名失败'));
            });
        }
    },
    
    // ==================== 全局搜索 ====================

    openGlobalSearch(initialKeyword) {
        const overlay = document.getElementById('vx-gs-overlay');
        if (!overlay) return;
        const keyword = typeof initialKeyword === 'string' ? initialKeyword.trim() : '';
        // 移到 document.body 直接子级，确保 position:fixed 相对于 viewport 而非 SPA 容器
        if (overlay.parentElement !== document.body) {
            document.body.appendChild(overlay);
        }
        this._gsOpen = true;
        overlay.style.display = '';
        overlay.classList.remove('vx-gs-closing'); // 若在淡出期间重新打开，立即恢复可交互
        document.body.classList.add('vx-gs-no-scroll');
        
        // 强制重绘以确保 transition 生效，避免 requestAnimationFrame 卡顿导致死锁
        void overlay.offsetHeight;
        
        overlay.classList.add('vx-gs-visible');
        const input = document.getElementById('vx-gs-input');
        if (input) {
            input.value = keyword;
            this.onGlobalSearchInput(keyword);
            input.focus();
        }
        
        this.trackUI('vui_filelist[global_search_open]');
    },

    submitMobileSearch() {
        const input = document.getElementById('vx-fl-mob-search-input');
        const keyword = input ? String(input.value || '') : '';
        this.openGlobalSearch(keyword);
        this.trackUI('vui_filelist[mobile_search_submit]');
    },

    closeGlobalSearch() {
        const overlay = document.getElementById('vx-gs-overlay');
        if (!overlay) return;
        this._gsOpen = false;
        this._gsRemoteReqId++;           // 取消所有在途搜索请求的回调，防止关闭后仍更新 DOM
        overlay.classList.remove('vx-gs-visible');
        overlay.classList.add('vx-gs-closing'); // 淡出期间禁止点击，防止重复触发
        document.body.classList.remove('vx-gs-no-scroll');
        setTimeout(() => {
            if (!this._gsOpen) {
                overlay.style.display = 'none';
                overlay.classList.remove('vx-gs-closing');
            }
        }, 200);
        const input = document.getElementById('vx-gs-input');
        if (input) input.value = '';
        this._gsCurrentKeyword = '';
        this._gsLastResults = [];
        clearTimeout(this._gsDebounceTimer);
    },

    onGlobalSearchInput(keyword) {
        clearTimeout(this._gsDebounceTimer);
        this._gsCurrentKeyword = keyword;
        const body = document.getElementById('vx-gs-body');
        if (!body) return;

        const trimmed = (keyword || '').trim();
        if (trimmed.length === 0) {
            this._gsLastResults = [];
            body.innerHTML = '';
            return;
        }
        if (trimmed.length < 2) {
            this._gsLastResults = [];
            body.innerHTML = `<div class="vx-gs-hint">${this.escapeHtml(this.t('vx_gs_hint_short', '请输入至少 2 个字符'))}</div>`;
            return;
        }

        body.innerHTML = `<div class="vx-gs-loading"><div class="vx-gs-spinner"></div><span>${this.escapeHtml(this.t('vx_gs_loading', '搜索中...'))}</span></div>`;

        this._gsDebounceTimer = setTimeout(() => {
            this.doGlobalSearch(trimmed);
        }, 300);
    },

    doGlobalSearch(keyword) {
        if (!keyword || keyword.length < 2) return;
        const reqId = ++this._gsRemoteReqId;

        this.searchLocalCache(keyword).then(({ results: localResults, folderMap, segmentsMap }) => {
            if (reqId !== this._gsRemoteReqId) return;
            this.renderGlobalSearchResults(localResults, keyword, true, reqId);

            this.searchRemote(keyword).then((remoteResults) => {
                if (reqId !== this._gsRemoteReqId) return;
                // 先用本地缓存的 folderMap/segmentsMap 填充已知路径
                (remoteResults || []).forEach(r => {
                    if (r.mrid != null) {
                        if (!r.folder_name) r.folder_name = folderMap.get(String(r.mrid)) || '';
                        if (!r.folder_segments) r.folder_segments = segmentsMap.get(String(r.mrid)) || null;
                    }
                });
                // 对仍未知路径的 mrid，通过目录树补全
                this.enrichRemoteResultsWithPaths(remoteResults || [], folderMap, segmentsMap).then((enriched) => {
                    if (reqId !== this._gsRemoteReqId) return;
                    const seen = new Set(enriched.map(r => r.ukey));
                    const merged = [
                        ...enriched,
                        ...(localResults || []).filter(r => !seen.has(r.ukey))
                    ];
                    this.renderGlobalSearchResults(merged, keyword, false, reqId);
                });
            }).catch(() => {
                if (reqId !== this._gsRemoteReqId) return;
                this.renderGlobalSearchResults(localResults, keyword, false, reqId);
            });
        }).catch(() => {
            if (reqId !== this._gsRemoteReqId) return;
            this.searchRemote(keyword).then((remoteResults) => {
                if (reqId !== this._gsRemoteReqId) return;
                this.enrichRemoteResultsWithPaths(remoteResults || [], new Map(), new Map()).then((enriched) => {
                    if (reqId !== this._gsRemoteReqId) return;
                    this.renderGlobalSearchResults(enriched, keyword, false, reqId);
                });
            }).catch(() => {
                if (reqId !== this._gsRemoteReqId) return;
                this.renderGlobalSearchResults([], keyword, false, reqId);
            });
        });
    },

    searchLocalCache(keyword) {
        return this.openCacheDb().then((db) => new Promise((resolve) => {
            if (!db) { resolve({ results: [], folderMap: new Map(), segmentsMap: new Map() }); return; }
            try {
                const tx = db.transaction('filelist_rooms', 'readonly');
                const store = tx.objectStore('filelist_rooms');
                const req = store.getAll();
                req.onsuccess = () => {
                    const all = req.result || [];
                    const scope = this.getCacheScope();
                    const kw = keyword.toLowerCase();
                    const desktopName = this.t('navbar_meetingroom', '桌面');
                    const results = [];
                    const folderMap = new Map();
                    const segmentsMap = new Map();
                    for (const snapshot of all) {
                        if (snapshot.scope !== scope) continue;
                        const mrid = snapshot.mrid;
                        const mridStr = String(mrid);
                        // 优先用 fullPath 提取带 id 的路径分段（可点击面包屑）
                        let segments, folderPath;
                        if (Array.isArray(snapshot.fullPath) && snapshot.fullPath.length > 0) {
                            segments = snapshot.fullPath.map(s => ({ id: String(s.id || ''), name: String(s.name || '') }));
                            folderPath = segments.map(s => s.name).filter(Boolean).join(' / ');
                        } else {
                            const roomName = (snapshot.room && snapshot.room.name) ? String(snapshot.room.name) : '';
                            if (mridStr === '0') {
                                segments = [{ id: '0', name: desktopName }];
                                folderPath = desktopName;
                            } else if (roomName) {
                                segments = [{ id: '0', name: desktopName }, { id: mridStr, name: roomName }];
                                folderPath = desktopName + ' / ' + roomName;
                            } else {
                                segments = null;
                                folderPath = '';
                            }
                        }
                        folderMap.set(mridStr, folderPath);
                        if (segments) segmentsMap.set(mridStr, segments);
                        for (const file of (snapshot.fileList || [])) {
                            const fname = String(file.fname || '').toLowerCase();
                            if (fname.includes(kw)) {
                                results.push({
                                    ukey: file.ukey,
                                    fname: file.fname,
                                    fsize_formated: file.fsize_formated || '',
                                    ftype: file.ftype || '',
                                    ctime: file.ctime || '',
                                    for_sale: file.for_sale,
                                    price: file.price,
                                    mrid: mrid,
                                    folder_name: folderPath,
                                    folder_segments: segments,
                                    source: 'local'
                                });
                            }
                        }
                    }
                    resolve({ results, folderMap, segmentsMap });
                };
                req.onerror = () => resolve({ results: [], folderMap: new Map(), segmentsMap: new Map() });
            } catch (e) { resolve({ results: [], folderMap: new Map(), segmentsMap: new Map() }); }
        }));
    },

    searchRemote(keyword) {
        const token = this.getToken();
        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';
        const postData = { action: 'search', search: keyword };
        if (token) postData.token = token;
        return new Promise((resolve, reject) => {
            $.post(apiUrl, postData, (rsp) => {
                if (rsp && rsp.status === 1 && Array.isArray(rsp.data)) {
                    const results = rsp.data.map(file => ({
                        ukey: file.ukey,
                        fname: file.fname,
                        fsize_formated: file.fsize_formated || '',
                        ftype: file.ftype || '',
                        ctime: file.ctime || file.cctime || '',
                        for_sale: file.for_sale,
                        price: file.price,
                        purchased: file.purchased,
                        mrid: file.mrid || null,
                        folder_name: null,
                        source: 'remote'
                    }));
                    resolve(results);
                } else {
                    resolve([]);
                }
            }, 'json').fail(() => reject(new Error('remote search failed')));
        });
    },

    enrichRemoteResultsWithPaths(results, folderMap, segmentsMap = new Map()) {
        if (!results || results.length === 0) return Promise.resolve(results);
        // 收集本地 folderMap 里没有路径的 mrid
        const unknownMrids = [...new Set(
            results
                .filter(r => r.mrid != null && String(r.mrid) !== '' && String(r.mrid) !== '0' && !folderMap.has(String(r.mrid)) && !r.folder_name)
                .map(r => String(r.mrid))
        )];
        if (unknownMrids.length === 0) return Promise.resolve(results);

        const resolvePaths = () => {
            const desktopName = this.t('navbar_meetingroom', '桌面');
            unknownMrids.forEach(mrid => {
                // 用 _moveDirTree 直接向上遍历构造路径及分段
                const segments = [];
                let currentId = mrid;
                while (currentId != 0) {
                    const folder = this._moveDirTree.find(f => String(f.id) === String(currentId));
                    if (!folder) break;
                    segments.unshift({ id: String(folder.id), name: folder.name });
                    currentId = folder.parent;
                }
                segments.unshift({ id: '0', name: desktopName });
                const pathStr = segments.map(s => s.name).join(' / ');
                folderMap.set(mrid, pathStr);
                segmentsMap.set(mrid, segments);
            });
            results.forEach(r => {
                if (r.mrid != null) {
                    if (!r.folder_name) r.folder_name = folderMap.get(String(r.mrid)) || '';
                    if (!r.folder_segments) r.folder_segments = segmentsMap.get(String(r.mrid)) || null;
                }
            });
            return results;
        };

        // _moveDirTree 已加载则直接用，否则先拉取完整目录树
        if (this._moveDirTree && this._moveDirTree.length > 0) {
            return Promise.resolve(resolvePaths());
        }
        const token = this.getToken();
        if (!token) return Promise.resolve(results);
        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';
        return new Promise(resolve => {
            $.post(apiUrl, { action: 'get_dir_tree', token }, rsp => {
                if (rsp && rsp.status === 1 && Array.isArray(rsp.data)) {
                    this._moveDirTree = rsp.data;
                }
                resolve(resolvePaths());
            }, 'json').fail(() => resolve(results));
        });
    },

    buildGsFolderLabel(file) {
        if (file.folder_segments && file.folder_segments.length > 0) {
            // 取路径中最末一级文件夹的 id 作为整体点击目标
            const lastSeg = file.folder_segments[file.folder_segments.length - 1];
            const segs = file.folder_segments.map((seg, i) => {
                const isLast = i === file.folder_segments.length - 1;
                return `<button type="button" class="vx-gs-bc-seg${isLast ? ' is-last' : ''}" onclick="event.preventDefault();event.stopPropagation();VX_FILELIST.gsNavigateToFolder('${this.escapeHtml(String(seg.id))}')" title="${this.escapeHtml(seg.name)}">${this.escapeHtml(seg.name)}</button>${isLast ? '' : '<span class="vx-gs-bc-sep">/</span>'}`;
            }).join('');
            // 外层 div 阻止冒泡（防止点中按钮间缝隙触发父层 <a>），整体点击定向到末级文件夹
            return `<div class="vx-gs-result-path vx-gs-result-path-nav" onclick="event.preventDefault();event.stopPropagation();VX_FILELIST.gsNavigateToFolder('${this.escapeHtml(String(lastSeg.id))}')" title="${this.escapeHtml(this.t('vx_gs_goto_folder', '进入此文件夹'))}"><iconpark-icon name="folder-open-e1ad2j7l"></iconpark-icon><span class="vx-gs-breadcrumb">${segs}</span></div>`;
        }
        if (file.folder_name) {
            const mrid = (file.mrid != null && String(file.mrid) !== '') ? String(file.mrid) : null;
            if (mrid !== null) {
                // 有 mrid 但无路径分段（远程搜索结果）：整行可点击，导航到对应文件夹
                return `<div class="vx-gs-result-path vx-gs-result-path-nav" onclick="event.preventDefault();event.stopPropagation();VX_FILELIST.gsNavigateToFolder('${this.escapeHtml(mrid)}')" title="${this.escapeHtml(this.t('vx_gs_goto_folder', '进入此文件夹'))}"><iconpark-icon name="folder-open-e1ad2j7l"></iconpark-icon><span>${this.escapeHtml(file.folder_name)}</span></div>`;
            }
            return `<div class="vx-gs-result-path"><iconpark-icon name="folder-open-e1ad2j7l"></iconpark-icon><span>${this.escapeHtml(file.folder_name)}</span></div>`;
        }
        return '';
    },

    gsNavigateToFolder(mrid) {
        this.closeGlobalSearch();
        this.openFolder(mrid);
    },

    buildGlobalSearchActions(file) {
        if (!file || !file.ukey) return '';

        const shareLabel = this.t('vx_gs_action_share', '分享');
        const deleteLabel = this.t('vx_gs_action_delete', '删除');
        const ukey = String(file.ukey);
        const mrid = file.mrid != null ? String(file.mrid) : '';
        const actions = [
            `<button type="button" class="vx-gs-action-btn" onclick="event.preventDefault();event.stopPropagation();VX_FILELIST.shareFile('${ukey}', this)" title="${this.escapeHtml(shareLabel)}"><iconpark-icon name="share-from-square"></iconpark-icon><span>${this.escapeHtml(shareLabel)}</span></button>`
        ];

        if (this.isOwner) {
            actions.push(
                `<button type="button" class="vx-gs-action-btn vx-action-danger" onclick="event.preventDefault();event.stopPropagation();VX_FILELIST.deleteGlobalSearchFile('${ukey}', '${mrid}')" title="${this.escapeHtml(deleteLabel)}"><iconpark-icon name="trash"></iconpark-icon><span>${this.escapeHtml(deleteLabel)}</span></button>`
            );
        }

        return `<div class="vx-gs-result-actions">${actions.join('')}</div>`;
    },

    removeGlobalSearchResult(ukey) {
        const nextResults = (this._gsLastResults || []).filter(file => String(file.ukey) !== String(ukey));
        if (nextResults.length === (this._gsLastResults || []).length) return;
        this._gsLastResults = nextResults;
        this.renderGlobalSearchResults(nextResults, this._gsCurrentKeyword || '', false, this._gsRemoteReqId);
    },

    renderGlobalSearchResults(results, keyword, isLoading, reqId) {
        if (reqId !== this._gsRemoteReqId) return;
        const body = document.getElementById('vx-gs-body');
        if (!body) return;

        if (!results || results.length === 0) {
            this._gsLastResults = [];
            if (isLoading) return;
            body.innerHTML = `
                <div class="vx-gs-empty">
                    <iconpark-icon name="search"></iconpark-icon>
                    <div class="vx-gs-empty-title">${this.escapeHtml(this.t('vx_gs_no_result', '未找到匹配文件'))}</div>
                    <div class="vx-gs-empty-hint">${this.escapeHtml(this.t('vx_gs_no_result_hint', '换一个关键词试试'))}</div>
                </div>`;
            return;
        }

        this._gsLastResults = results.slice();

        const kw = keyword.toLowerCase();
        const items = results.map(file => {
            const iconInfo = this.getFileIcon(file.ftype);
            const folderLabel = this.buildGsFolderLabel(file);
            const actionsHtml = this.buildGlobalSearchActions(file);
            const sizeLabel = file.fsize_formated
                ? `<div class="vx-gs-result-size">${this.escapeHtml(file.fsize_formated)}</div>`
                : '';

            const fname = file.fname || '';
            const idx = fname.toLowerCase().indexOf(kw);
            let fnameHtml;
            if (idx >= 0) {
                fnameHtml = this.escapeHtml(fname.slice(0, idx))
                    + `<mark>${this.escapeHtml(fname.slice(idx, idx + kw.length))}</mark>`
                    + this.escapeHtml(fname.slice(idx + kw.length));
            } else {
                fnameHtml = this.escapeHtml(fname);
            }

            return `<div class="vx-gs-result-item">
                <a href="/file?ukey=${encodeURIComponent(file.ukey)}" tmpui-app="true" target="_blank" class="vx-gs-result-link"></a>
                <div class="vx-list-icon vx-gs-result-icon ${iconInfo.class}">
                    <iconpark-icon name="${iconInfo.icon}"></iconpark-icon>
                </div>
                <div class="vx-gs-result-info">
                    <div class="vx-gs-result-head">
                        <div class="vx-gs-result-name">${fnameHtml}</div>
                        ${sizeLabel}
                    </div>
                    ${folderLabel ? `<div class="vx-gs-result-path-wrap">${folderLabel}</div>` : ''}
                    ${actionsHtml}
                </div>
            </div>`;
        }).join('');

        body.innerHTML = `
            <div class="vx-gs-results-header">
                <span>${results.length} ${this.escapeHtml(this.t('vx_gs_result_count_unit', '个结果'))}</span>
                ${isLoading ? `<span class="vx-gs-searching"><span class="vx-gs-spinner"></span>${this.escapeHtml(this.t('vx_gs_loading', '搜索中...'))}</span>` : ''}
            </div>
            <div class="vx-gs-results">${items}</div>`;

        if (typeof app !== 'undefined' && typeof app.linkRebind === 'function') {
            app.linkRebind();
        }
    },

    // ==================== 工具函数 ====================
    
    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

// 注册模块
if (typeof VXUI !== 'undefined') {
    VXUI.registerModule('filelist', VX_FILELIST);
}
