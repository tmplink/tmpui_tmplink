/**
 * VXUI Notes (密记) Module
 * 密记管理模块 - 基于新 VXUI 框架
 * @version 1.0.0
 */

'use strict';

// Debug switch for diagnosing key validation on refresh.
// Set localStorage.setItem('VX_NOTES_DEBUG', '1') to enable detailed logs.
const VX_NOTES_DEBUG = false;

const VX_NOTES = {
    // ===== State =====
    key: null,
    notesList: [],
    currentId: 0,
    lastSavedTitle: '',
    lastSavedContent: '',
    searchKeyword: '',
    isEditorOpen: false,
    _autoSaveTimer: null,
    _cloudCount: null,
    _storedKeyLocal: null,
    _storedKeySession: null,
    _keyRetryDone: false,

    debugEnabled() {
        if (VX_NOTES_DEBUG) return true;
        try {
            return localStorage.getItem('VX_NOTES_DEBUG') === '1';
        } catch (_) {
            return false;
        }
    },

    dbg(...args) {
        if (!this.debugEnabled()) return;
        try {
            console.log('[VX_NOTES][DBG]', ...args);
        } catch (_) {}
    },

    keyFingerprint(key) {
        try {
            if (!key) return '';
            // js/tools/sha1.js exposes window.sha1
            if (typeof sha1 === 'function') return String(sha1(String(key))).slice(0, 8);
        } catch (_) {}
        return '';
    },

    persistKey(newKey) {
        // Keep in-memory key regardless; persistence is best-effort.
        const keyStr = String(newKey || '');

        // Try localStorage first
        try {
            localStorage.setItem('NotesKey', keyStr);
            const rb = localStorage.getItem('NotesKey');
            if (rb === keyStr) {
                // Also keep a session copy for robustness.
                try { sessionStorage.setItem('NotesKey', keyStr); } catch (_) {}
                this.dbg('persistKey ok', { where: 'localStorage', len: keyStr.length, fp: this.keyFingerprint(keyStr) });
                return true;
            }
        } catch (_) {}

        // Fallback to sessionStorage
        try {
            sessionStorage.setItem('NotesKey', keyStr);
            const rb2 = sessionStorage.getItem('NotesKey');
            if (rb2 === keyStr) {
                this.dbg('persistKey ok', { where: 'sessionStorage', len: keyStr.length, fp: this.keyFingerprint(keyStr) });
                return false;
            }
        } catch (_) {}

        this.dbg('persistKey failed', { len: keyStr.length, fp: this.keyFingerprint(keyStr) });
        return false;
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

    getNoteTitleById(id) {
        if (!id || !Array.isArray(this.notesList)) return '';
        const note = this.notesList.find(n => String(n.id) === String(id));
        return note && note.title ? String(note.title) : '';
    },

    trackNote(title) {
        const safeTitle = title || '未命名';
        this.trackUI(`vui_notes[${safeTitle}]`);
    },
    
    /**
     * 初始化模块
     */
    init(params = {}) {
        console.log('[VX_NOTES] Initializing...', params);

        this.dbg('init', {
            params,
            hasTL: typeof TL !== 'undefined',
            isLogin: (typeof TL !== 'undefined' && typeof TL.isLogin === 'function') ? TL.isLogin() : null,
            hasCryptoJS: typeof CryptoJS !== 'undefined',
            origin: (typeof location !== 'undefined') ? location.origin : ''
        });

        // Wait for TL.ready to ensure all dependencies are fully initialized
        // This is critical on page refresh where TL may not be ready yet
        if (typeof TL !== 'undefined' && typeof TL.ready === 'function') {
            TL.ready(() => this._doInit(params));
        } else {
            this._doInit(params);
        }
    },

    /**
     * 实际初始化逻辑
     */
    _doInit(params = {}) {
        // 检查登录状态
        if (typeof TL !== 'undefined' && !TL.isLogin()) {
            VXUI.toastWarning((app && app.languageData && app.languageData.vx_need_login) || '请先登录');
            setTimeout(() => {
                app.open('/login');
            }, 300);
            return;
        }
        
        // 重置状态
        this.resetState();
        
        // 绑定事件
        this.bindEvents();

        // 初始化密钥状态 & 加载列表
        this.initKeyState();

        // 如果有指定的笔记 ID，打开它（需要在解密成功之后）
        if (params.id) {
            this._pendingOpenId = parseInt(params.id, 10) || 0;
        }
    },

    /**
     * 销毁模块
     */
    destroy() {
        console.log('[VX_NOTES] Destroying...');
        this.unbindEvents();
        this._pendingOpenId = 0;
    },

    /**
     * 重置状态
     */
    resetState() {
        this.key = null;
        this.notesList = [];
        this.currentId = 0;
        this.lastSavedTitle = '';
        this.lastSavedContent = '';
        this.searchKeyword = '';
        this.isEditorOpen = false;
        this._pendingOpenId = 0;
        this._cloudCount = null;
        this._storedKeyLocal = null;
        this._storedKeySession = null;
        this._keyRetryDone = false;
    },
    
    /**
     * 更新侧边栏
     */
    updateSidebar() {
        const sidebarDynamic = document.getElementById('vx-sidebar-dynamic');
        if (!sidebarDynamic) return;

        // 未解锁（未设置/错误密钥）时，不显示任何 notes 操作
        if (!this.key) {
            sidebarDynamic.innerHTML = '';
            if (typeof VXUI !== 'undefined' && typeof VXUI.refreshSidebarDivider === 'function') {
                VXUI.refreshSidebarDivider();
            }
            return;
        }

        const totalNotes = this.notesList.length;
        
        sidebarDynamic.innerHTML = `
            <div class="vx-nav-section">
                <div class="vx-nav-stats">
                    <div class="vx-nav-stat-item">
                        <iconpark-icon name="memo-pad"></iconpark-icon>
                        <span>密记总数：<strong>${totalNotes}</strong></span>
                    </div>
                </div>
            </div>
        `;
        
        if (typeof app !== 'undefined') {
            app.languageBuild();
        }

        if (typeof VXUI !== 'undefined' && typeof VXUI.refreshSidebarDivider === 'function') {
            VXUI.refreshSidebarDivider();
        }
    },

    setLockedUi(isLocked) {
        const headerActions = document.getElementById('vx-notes-header-actions');
        const sidebar = document.getElementById('vx-notes-sidebar');
        const placeholder = document.getElementById('vx-notes-placeholder');
        const editor = document.getElementById('vx-notes-editor');

        if (isLocked) {
            headerActions?.classList.add('vx-hidden');
            sidebar?.classList.add('vx-hidden');
            placeholder?.classList.add('vx-hidden');
            editor?.classList.add('vx-hidden');
            this.isEditorOpen = false;
            this.clearAutoSave();
        } else {
            headerActions?.classList.remove('vx-hidden');
            sidebar?.classList.remove('vx-hidden');
            // placeholder 由 showPlaceholder()/render() 控制
        }

        // 同步侧边栏“操作”区域
        this.updateSidebar();
    },
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // no-op for now (modal editor uses explicit save)
    },
    
    /**
     * 解绑事件
     */
    unbindEvents() {
        // 清理
    },
    
    /**
     * 加载数据
     */
    load() {
        if (!this.key) {
            this.renderKeyInit();
            return;
        }

        this.showLoading();
        this.fetchData()
            .then(() => {
                this.hideLoading();
                this.render();

                if (this._pendingOpenId) {
                    const id = this._pendingOpenId;
                    this._pendingOpenId = 0;
                    this.openNote(id);
                }
            })
            .catch(error => {
                console.error('[VX_NOTES] Load error:', error);
                this.hideLoading();
                VXUI.toastError((app && app.languageData && app.languageData.vx_load_failed) || '加载失败');
            });
    },
    
    /**
     * 获取数据
     */
    fetchData() {
        return new Promise((resolve, reject) => {
            $.post(TL.api_notes, {
                action: 'list',
                token: TL.api_token
            }, (rsp) => {
                // status==0: no notes
                if (rsp && rsp.status === 0) {
                    this.notesList = [];
                    this.renderKeyOk();
                    resolve();
                    return;
                }

                if (rsp && rsp.status === 1 && Array.isArray(rsp.data)) {
                    this.dbg('fetchData:list', {
                        rows: rsp.data.length,
                        keyPresent: !!this.key,
                        keyLength: this.key ? String(this.key).length : 0,
                        hasCryptoJS: typeof CryptoJS !== 'undefined'
                    });

                    // CryptoJS is loaded via autoloader; avoid a race where decrypt runs before it exists.
                    this.waitForCryptoReady()
                        .then(() => {
                            this.dbg('CryptoJS ready', { hasCryptoJS: typeof CryptoJS !== 'undefined' });
                            // Validate key against a few candidates (not only the first row)
                            let ok = this.ensureKeyValidWithFallback(rsp.data);
                            if (!ok && !this._keyRetryDone) {
                                // 可能是加载顺序/缓存造成的偶发失败，重读存储并再试一次
                                this._keyRetryDone = true;
                                const { ls, ss } = this.readPersistedKeys();
                                this._storedKeyLocal = ls;
                                this._storedKeySession = ss;
                                this.key = this._storedKeySession || this._storedKeyLocal || this.key;
                                this.dbg('retry key validation once', {
                                    lsFp: this.keyFingerprint(ls),
                                    ssFp: this.keyFingerprint(ss),
                                    keyFp: this.keyFingerprint(this.key)
                                });
                                ok = this.ensureKeyValidWithFallback(rsp.data);
                            }
                            this.dbg('validateKeyFromRows', { ok, keyFp: this.keyFingerprint(this.key) });
                            if (!ok) {
                                // Minimal debug snapshot of returned fields (prefix/length only)
                                if (this.debugEnabled()) {
                                    const snap = (rsp.data || []).slice(0, 3).map((row) => {
                                        const id = row && (row.id || row.notes_id || null);
                                        const titleA = row && row.title;
                                        const titleB = row && row.notes_title;
                                        const contentA = row && row.content;
                                        const contentB = row && row.notes_content;
                                        const pick = (v) => {
                                            if (!v) return null;
                                            const s = String(v);
                                            const pre = s.slice(0, 12);
                                            // CryptoJS.AES.encrypt(passphrase).toString() uses OpenSSL-compatible base64,
                                            // which typically starts with "U2FsdGVkX1" ("Salted__").
                                            const looksEncrypted = s.indexOf('U2FsdGVkX1') === 0;
                                            return { len: s.length, pre, looksEncrypted };
                                        };
                                        return {
                                            id,
                                            title: pick(titleA),
                                            notes_title: pick(titleB),
                                            content: pick(contentA),
                                            notes_content: pick(contentB)
                                        };
                                    });
                                    this.dbg('keyfail snapshot', snap);
                                    try {
                                        console.log('[VX_NOTES][DBG] keyfail snapshot json', JSON.stringify(snap));
                                    } catch (_) {}
                                }
                                this.notesList = [];
                                this.renderKeyFail();
                                resolve();
                                return;
                            }

                            this.notesList = this.decodeList(rsp.data);
                            this.renderKeyOk();
                            resolve();
                        })
                        .catch((e) => {
                            console.error('[VX_NOTES] CryptoJS not ready:', e);
                            this.dbg('CryptoJS wait failed', {
                                message: e && e.message ? e.message : String(e),
                                hasCryptoJS: typeof CryptoJS !== 'undefined',
                                keyPresent: !!this.key,
                                keyLength: this.key ? String(this.key).length : 0
                            });
                            // If CryptoJS never loads, don't mislabel it as an invalid key.
                            VXUI.toastError((app && app.languageData && app.languageData.notes_dependency_failed) || '依赖加载失败，请刷新重试');
                            resolve();
                        });
                    return;
                }

                resolve();
            }).fail(reject);
        });
    },
    
    /**
     * 渲染列表
     */
    render() {
        const container = document.getElementById('vx-notes-list');
        if (!container) return;

        // key gate
        if (!this.key) {
            this.renderKeyInit();
            return;
        }
        
        // 过滤搜索结果
        let filteredList = this.notesList;
        if (this.searchKeyword) {
            const keyword = this.searchKeyword.toLowerCase();
            filteredList = this.notesList.filter(note => 
                (note.title_text || '').toLowerCase().includes(keyword) ||
                (note.content_text || '').toLowerCase().includes(keyword) ||
                (note.raw_title || '').toLowerCase().includes(keyword) ||
                (note.raw_content || '').toLowerCase().includes(keyword)
            );
        }
        
        if (filteredList.length === 0) {
            if (this.searchKeyword) {
                container.innerHTML = `
                    <div class="vx-empty">
                        <div class="vx-empty-icon">
                            <iconpark-icon name="search"></iconpark-icon>
                        </div>
                        <h3 class="vx-empty-title">未找到匹配的密记</h3>
                        <p class="vx-empty-text">尝试其他关键词</p>
                    </div>
                `;
            } else {
                this.showEmpty();
            }
            return;
        }
        
        let html = '';
        filteredList.forEach(note => {
            html += this.renderItem(note);
        });
        
        container.innerHTML = html;
        
        // 显示内容
        document.getElementById('vx-notes-content')?.classList.remove('vx-hidden');
        document.getElementById('vx-notes-empty')?.classList.add('vx-hidden');

        // main panel
        this.showPlaceholder();
        
        // 更新统计
        this.updateStats();
    },
    
    /**
     * 渲染项目
     */
    renderItem(note) {
        const untitledText = (app && app.languageData && app.languageData.notes_untitled) || '无标题';
        const deleteTitle = (app && app.languageData && app.languageData.notes_delete_title) || '删除';
        const title = note.title_text || note.raw_title || untitledText;
        const preview = note.content_text || this.getContentPreview(note.raw_content || '');
        const updateTime = note.etime || '';
        const isActive = this.currentId && this.currentId === note.id;
        
        return `
            <div class="vx-notes-item ${isActive ? 'active' : ''}" 
                data-id="${note.id}"
                onclick="VX_NOTES.openNote(${note.id})">
                <div class="vx-notes-item-header">
                    <h4 class="vx-notes-item-title">${title}</h4>
                    <span class="vx-notes-item-time">${updateTime}</span>
                </div>
                <p class="vx-notes-item-preview">${preview}</p>
                <div class="vx-notes-item-actions">
                    <button type="button" class="vx-btn-icon" 
                        onclick="event.stopPropagation(); VX_NOTES.deleteNote(${note.id})" 
                        title="${deleteTitle}">
                        <iconpark-icon name="trash"></iconpark-icon>
                    </button>
                </div>
            </div>
        `;
    },
    
    /**
     * 获取内容预览
     */
    getContentPreview(content) {
        // 移除 HTML 标签
        const text = content.replace(/<[^>]+>/g, ' ').trim();
        // 截取前 100 个字符
        return text.length > 100 ? text.substring(0, 100) + '...' : text;
    },
    
    /**
     * 搜索
     */
    search(keyword) {
        this.searchKeyword = keyword;
        this.render();
    },
    
    /**
     * 打开笔记
     */
    openNote(id) {
        if (!this.key) {
            this.renderKeyInit();
            return;
        }

        const numericId = parseInt(id, 10) || 0;
        if (!numericId) return;

        const title = this.getNoteTitleById(numericId) || '未命名';
        this.trackNote(title);

        const note = this.getNoteById(numericId);
        if (!note) {
            VXUI.toastError((app && app.languageData && app.languageData.notes_not_exist) || '密记不存在');
            return;
        }

        this.currentId = numericId;

        // 更新 URL
        VXUI.updateUrl('notes', { id: numericId });

        // 更新列表选中状态
        this.updateListSelection();

        // 在右侧显示编辑器
        this.openEditor(numericId);
    },
    
    /**
     * 显示编辑器
     */
    showPlaceholder() {
        document.getElementById('vx-notes-placeholder')?.classList.remove('vx-hidden');
        document.getElementById('vx-notes-editor')?.classList.add('vx-hidden');
        this.isEditorOpen = false;
        this.clearAutoSave();
    },

    showEditor() {
        document.getElementById('vx-notes-editor')?.classList.remove('vx-hidden');
        document.getElementById('vx-notes-placeholder')?.classList.add('vx-hidden');
    },

    hideEditor() {
        document.getElementById('vx-notes-editor')?.classList.add('vx-hidden');
        this.isEditorOpen = false;
        this.clearAutoSave();
    },
    
    /**
     * 隐藏编辑器
     */
    // ===== Key management (复刻老版) =====
    readPersistedKeys() {
        let ls = null;
        let ss = null;
        try {
            ls = localStorage.getItem('NotesKey');
        } catch (_) {
            ls = null;
        }
        try {
            ss = sessionStorage.getItem('NotesKey');
        } catch (_) {
            ss = null;
        }
        return { ls, ss };
    },

    initKeyState() {
        const { ls, ss } = this.readPersistedKeys();
        this._storedKeyLocal = ls;
        this._storedKeySession = ss;
        // Prefer the session copy (latest in current tab) and fall back to localStorage.
        this.key = ss || ls || null;

        this.dbg('initKeyState', {
            keyPresent: !!this.key,
            keyLength: this.key ? String(this.key).length : 0,
            keyFp: this.keyFingerprint(this.key),
            hasCryptoJS: typeof CryptoJS !== 'undefined'
        });

        if (!this.key) {
            this.renderKeyInit();
            this.probeCloudNotesCount();
            return;
        }

        // On page refresh, CryptoJS may not be fully loaded yet.
        // Wait for it before attempting to load/decrypt notes.
        // Show sidebar with loading state immediately
        this.showLoadingState();
        this.waitForCryptoReady(5000)
            .then(() => {
                this.dbg('initKeyState: CryptoJS ready, proceeding to load');
                // optimistic unlock (decrypt failure will switch to keyfail)
                this.renderKeyOk();
                this.load();
            })
            .catch((err) => {
                this.dbg('initKeyState: CryptoJS timeout', { error: err && err.message });
                this.hideLoading();
                // Don't mislabel as key error; show a loading/dependency error instead
                VXUI.toastError((app && app.languageData && app.languageData.notes_crypto_failed) || '加密模块加载失败，请刷新页面重试');
            });
    },

    /**
     * 显示加载中状态（包括显示 sidebar 和主内容区域）
     */
    showLoadingState() {
        // Show sidebar but with loading indicator
        const sidebar = document.getElementById('vx-notes-sidebar');
        const headerActions = document.getElementById('vx-notes-header-actions');
        const keyPanel = document.getElementById('vx-notes-key');
        const mainLoading = document.getElementById('vx-notes-main-loading');
        
        sidebar?.classList.remove('vx-hidden');
        headerActions?.classList.add('vx-hidden');
        keyPanel?.classList.add('vx-hidden');
        mainLoading?.classList.remove('vx-hidden');
        
        this.showLoading();
    },

    /**
     * 隐藏主内容区域的加载状态
     */
    hideMainLoading() {
        const mainLoading = document.getElementById('vx-notes-main-loading');
        mainLoading?.classList.add('vx-hidden');
    },

    probeCloudNotesCount() {
        // Only when locked (no local key). We can still detect whether user has encrypted notes.
        if (this.key) return;
        if (typeof $ === 'undefined' || typeof TL === 'undefined' || !TL.api_notes) return;

        $.post(TL.api_notes, {
            action: 'list',
            token: TL.api_token
        }, (rsp) => {
            if (!rsp) return;
            if (rsp.status === 1 && Array.isArray(rsp.data)) {
                this._cloudCount = rsp.data.length;
            } else {
                this._cloudCount = 0;
            }
            this.updateKeyInitHint();
        }, 'json');
    },

    updateKeyInitHint() {
        const el = document.getElementById('vx-notes-keyinit-text');
        const resetBtn = document.getElementById('vx-notes-resetall');
        if (!el) return;

        // If user has encrypted notes but no local key, guide more explicitly.
        if (typeof this._cloudCount === 'number' && this._cloudCount > 0) {
            const template = (app && app.languageData && app.languageData.notes_cloud_exist_hint) || '检测到云端已有 {count} 条密记，请设置密钥以解密并启用功能。';
            el.textContent = template.replace('{count}', this._cloudCount);
            resetBtn?.classList.remove('vx-hidden');
            return;
        }

        resetBtn?.classList.add('vx-hidden');

        // Default hint (i18n will override elsewhere)
        if (!el.textContent || el.textContent.trim().length === 0) {
            el.textContent = (app && app.languageData && app.languageData.notes_keyinit_alert) || '尚未设置密钥，请先设置密钥。';
        }
    },

    cleanKey() {
        try {
            localStorage.removeItem('NotesKey');
        } catch (_) {}
        try {
            sessionStorage.removeItem('NotesKey');
        } catch (_) {}
        this.key = null;
        this._storedKeyLocal = null;
        this._storedKeySession = null;
    },

    keySet() {
        const input = document.getElementById('vx-notes-key-input');
        const newKey = (input && input.value) ? String(input.value) : '';
        if (!newKey) {
            VXUI.toastError((app && app.languageData && app.languageData.error_notes_key_empty) || '密钥不能为空');
            return;
        }

        this.trackUI('vui_notes[key_set]');
        const persisted = this.persistKey(newKey);
        this.key = newKey;
        this._storedKeyLocal = newKey;
        this._storedKeySession = newKey;

        if (!persisted) {
            // Avoid silent failure: otherwise user sees "works now" but "invalid after refresh".
            VXUI.toastError((app && app.languageData && app.languageData.notes_browser_block_key) || '浏览器阻止保存密钥，刷新后需重新输入');
        }

        this.renderKeyOk();
        this.load();
    },

    keyReInit() {
        const input = document.getElementById('vx-notes-key-input');
        const newKey = (input && input.value) ? String(input.value) : '';
        if (!newKey) {
            VXUI.toastError((app && app.languageData && app.languageData.error_notes_key_empty) || '密钥不能为空');
            return;
        }

        this.trackUI('vui_notes[key_reinit]');
        const confirmMessage = (app && app.languageData && app.languageData.model_btn_resetall_des)
            || '将会清空所有密记的内容，您确定要这么做吗？';

        VXUI.confirm({
            title: (app && app.languageData && app.languageData.model_btn_resetall) || '重置所有密记',
            message: confirmMessage,
            confirmClass: 'vx-btn-danger',
            onConfirm: () => {
                const persisted = this.persistKey(newKey);
                this.key = newKey;
                this._storedKeyLocal = newKey;
                this._storedKeySession = newKey;

                if (!persisted) {
                    VXUI.toastError((app && app.languageData && app.languageData.notes_browser_block_key) || '浏览器阻止保存密钥，刷新后需重新输入');
                }

                $.post(TL.api_notes, {
                    action: 'reset',
                    token: TL.api_token
                }, () => {
                    this.load();
                }, 'json');
            }
        });
    },

    renderKeyInit() {
        this.key = null;
        this.setLockedUi(true);
        this.hideMainLoading();
        document.getElementById('vx-notes-key')?.classList.remove('vx-hidden');
        document.getElementById('vx-notes-keyinit')?.classList.remove('vx-hidden');
        document.getElementById('vx-notes-keyfail')?.classList.add('vx-hidden');
        document.getElementById('vx-notes-resetall')?.classList.add('vx-hidden');
        document.getElementById('vx-notes-placeholder')?.classList.add('vx-hidden');
        document.getElementById('vx-notes-editor')?.classList.add('vx-hidden');

        this.updateKeyInitHint();

        // hide list area
        document.getElementById('vx-notes-content')?.classList.add('vx-hidden');
        document.getElementById('vx-notes-empty')?.classList.add('vx-hidden');
        this.hideLoading();
    },

    renderKeyFail() {
        this.setLockedUi(true);
        this.hideMainLoading();
        document.getElementById('vx-notes-key')?.classList.remove('vx-hidden');
        document.getElementById('vx-notes-keyinit')?.classList.add('vx-hidden');
        document.getElementById('vx-notes-keyfail')?.classList.remove('vx-hidden');
        document.getElementById('vx-notes-resetall')?.classList.remove('vx-hidden');
        document.getElementById('vx-notes-placeholder')?.classList.add('vx-hidden');
        document.getElementById('vx-notes-editor')?.classList.add('vx-hidden');

        // hide list area
        document.getElementById('vx-notes-content')?.classList.add('vx-hidden');
        document.getElementById('vx-notes-empty')?.classList.add('vx-hidden');
        this.hideLoading();
    },

    renderKeyOk() {
        this.setLockedUi(false);
        this.hideMainLoading();
        document.getElementById('vx-notes-key')?.classList.add('vx-hidden');
        document.getElementById('vx-notes-keyinit')?.classList.add('vx-hidden');
        document.getElementById('vx-notes-keyfail')?.classList.add('vx-hidden');
        document.getElementById('vx-notes-resetall')?.classList.add('vx-hidden');

        // ensure we don't stack multiple panels
        if (!this.isEditorOpen) {
            this.showPlaceholder();
        }
    },

    waitForCryptoReady(timeoutMs = 3000) {
        // Must check for full CryptoJS availability including AES and encoding modules.
        // On page refresh, CryptoJS core may load before AES module is ready.
        // The "U2FsdGVkX1..." format requires format.OpenSSL to parse correctly.
        const isFullyReady = () => {
            if (typeof CryptoJS === 'undefined') return false;
            if (typeof CryptoJS.AES === 'undefined') return false;
            if (typeof CryptoJS.AES.decrypt !== 'function') return false;
            if (typeof CryptoJS.AES.encrypt !== 'function') return false;
            if (typeof CryptoJS.enc === 'undefined') return false;
            if (typeof CryptoJS.enc.Utf8 === 'undefined') return false;
            if (typeof CryptoJS.enc.Base64 === 'undefined') return false;
            if (typeof CryptoJS.lib === 'undefined') return false;
            if (typeof CryptoJS.lib.WordArray === 'undefined') return false;
            // Critical: OpenSSL format parser for "U2FsdGVkX1..." (Salted__) format
            if (typeof CryptoJS.format === 'undefined') return false;
            if (typeof CryptoJS.format.OpenSSL === 'undefined') return false;
            return true;
        };

        if (isFullyReady()) return Promise.resolve();

        return new Promise((resolve, reject) => {
            const start = Date.now();
            const tick = () => {
                if (isFullyReady()) {
                    this.dbg('CryptoJS fully ready after wait', { elapsed: Date.now() - start });
                    resolve();
                    return;
                }
                if (Date.now() - start > timeoutMs) {
                    reject(new Error('CryptoJS timeout'));
                    return;
                }
                setTimeout(tick, 50);
            };
            tick();
        });
    },

    validateKeyFromRows(rows) {
        if (!this.key) return false;
        if (!Array.isArray(rows) || rows.length === 0) return true;

        // Scan enough rows to avoid false keyfail due to ordering or a few bad records.
        const maxScan = Math.min(rows.length, 200);
        let tried = 0;
        for (let i = 0; i < maxScan; i++) {
            const row = rows[i];
            const candidates = this.getCipherCandidates(row);
            for (const cipher of candidates) {
                if (!cipher) continue;
                tried++;
                const plain = this.deContent(cipher);
                if (plain !== false) {
                    this.dbg('validateKeyFromRows success', {
                        rowIndex: i,
                        tried,
                        id: row && (row.id || row.notes_id || null)
                    });
                    return true;
                }
            }
        }

        this.dbg('validateKeyFromRows failed', { rows: rows.length, maxScan, tried });
        return false;
    },

    ensureKeyValidWithFallback(rows) {
        const seen = new Set();
        const candidates = [];
        const push = (val, source) => {
            if (!val) return;
            const s = String(val);
            if (!s || seen.has(s)) return;
            seen.add(s);
            candidates.push({ key: s, source });
        };

        // current in-memory key first, then session copy, then local copy
        push(this.key, 'current');
        push(this._storedKeySession, 'session');
        push(this._storedKeyLocal, 'local');

        for (const item of candidates) {
            this.key = item.key;
            const ok = this.validateKeyFromRows(rows);
            if (ok) {
                // keep both storages in sync with the working key to avoid stale reuse
                this.persistKey(this.key);
                this._storedKeyLocal = this.key;
                this._storedKeySession = this.key;
                this.dbg('ensureKeyValidWithFallback: using key', {
                    source: item.source,
                    fp: this.keyFingerprint(this.key)
                });
                return true;
            }
        }

        return false;
    },

    getCipherCandidates(row) {
        const out = [];
        const push = (v) => {
            if (!v) return;
            const s = String(v);
            if (!s) return;
            if (out.indexOf(s) !== -1) return;
            out.push(s);
        };

        // Try both possible field names, do NOT short-circuit with ||.
        push(row && row.content);
        push(row && row.notes_content);
        push(row && row.title);
        push(row && row.notes_title);
        return out;
    },

    // ===== Crypto =====
    enContent(text) {
        // Defensive check: ensure CryptoJS and required submodules are fully loaded
        if (!this.key || 
            typeof CryptoJS === 'undefined' || 
            typeof CryptoJS.AES === 'undefined' ||
            typeof CryptoJS.AES.encrypt !== 'function') {
            return null;
        }
        const payload = JSON.stringify({ content: String(text ?? '') });
        return CryptoJS.AES.encrypt(payload, this.key).toString();
    },

    deContent(cipherText) {
        // Defensive check: ensure CryptoJS and required submodules are fully loaded
        if (!this.key || 
            typeof CryptoJS === 'undefined' || 
            typeof CryptoJS.AES === 'undefined' ||
            typeof CryptoJS.AES.decrypt !== 'function' ||
            typeof CryptoJS.enc === 'undefined' ||
            typeof CryptoJS.enc.Utf8 === 'undefined') {
            return false;
        }
        try {
            const raw = CryptoJS.AES.decrypt(String(cipherText), this.key).toString(CryptoJS.enc.Utf8);
            const obj = JSON.parse(raw);
            if (obj && Object.prototype.hasOwnProperty.call(obj, 'content')) {
                return obj.content;
            }
            return false;
        } catch (_) {
            return false;
        }
    },

    // ===== Data helpers =====
    getNoteById(id) {
        return this.notesList.find(n => n.id === id) || null;
    },

    decodeList(list) {
        const data = Array.isArray(list) ? list : [];
        const out = [];
        for (const row of data) {
            const id = parseInt(row.id || row.notes_id, 10);
            if (!id) continue;
            // Try both field names (avoid picking a wrong, non-cipher field by accident)
            const cipherTitle = (row.title && String(row.title)) || (row.notes_title && String(row.notes_title)) || '';
            const cipherContent = (row.content && String(row.content)) || (row.notes_content && String(row.notes_content)) || '';
            // API returns etime as formatted string (e.g. "2024-06-28 15:56:52"), updatetime as timestamp
            const updatetime = row.updatetime || row.notes_updatetime || 0;
            // Prefer etime string from API, fallback to formatting updatetime
            const etime = row.etime || (updatetime ? VXUI.formatDate(updatetime) : '');

            const rawTitle = this.deContent(cipherTitle);
            const rawContent = this.deContent(cipherContent);
            if (rawTitle === false || rawContent === false) {
                // key invalid; caller handles via test decrypt
                continue;
            }

            const titleText = this.trimText(this.stripHtml(String(rawTitle)), 25);
            const contentText = this.trimText(this.stripHtml(String(rawContent)), 100);

            out.push({
                id,
                title: cipherTitle,
                content: cipherContent,
                raw_title: String(rawTitle),
                raw_content: String(rawContent),
                title_text: titleText,
                content_text: contentText,
                updatetime,
                etime
            });
        }
        // newest first (same feel as server order, but stable)
        // If updatetime is 0, try to parse etime for sorting
        out.sort((a, b) => {
            const timeA = a.updatetime || this.parseEtime(a.etime);
            const timeB = b.updatetime || this.parseEtime(b.etime);
            return timeB - timeA;
        });
        return out;
    },

    parseEtime(etime) {
        if (!etime) return 0;
        try {
            // Parse "2024-06-28 15:56:52" format
            const d = new Date(etime.replace(' ', 'T'));
            return isNaN(d.getTime()) ? 0 : Math.floor(d.getTime() / 1000);
        } catch (_) {
            return 0;
        }
    },

    stripHtml(html) {
        return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    },

    trimText(text, maxLen) {
        const s = String(text || '');
        return s.length > maxLen ? s.substring(0, maxLen) + '...' : s;
    },

    // ===== Inline Editor (Trumbowyg) =====
    openEditor(id = 0) {
        if (!this.key) {
            this.renderKeyInit();
            return;
        }

        const numericId = parseInt(id, 10) || 0;
        const note = numericId ? this.getNoteById(numericId) : null;

        // init editor
        if (typeof $ === 'undefined' || typeof $.fn.trumbowyg !== 'function') {
            VXUI.toastError((app && app.languageData && app.languageData.notes_editor_not_loaded) || '编辑器未加载');
            return;
        }

        $.trumbowyg.svgPath = '/plugin/trumbowyg/ui/icons.svg';

        const titleEl = document.getElementById('vx-notes-title');
        const bodyEl = document.getElementById('vx-notes-body');
        if (!titleEl || !bodyEl) return;

        // ensure instance
        try {
            if (!$('#vx-notes-body').data('trumbowyg')) {
                $('#vx-notes-body').trumbowyg();
            }
        } catch (_) {}

        const rawTitle = note ? note.raw_title : '';
        const rawContent = note ? note.raw_content : '';
        titleEl.value = rawTitle;
        $('#vx-notes-body').trumbowyg('html', rawContent);

        this.currentId = numericId;
        this.lastSavedTitle = String(rawTitle);
        this.lastSavedContent = String(rawContent);

        // bind autosave events (namespace to avoid duplicates)
        try {
            $(titleEl).off('.vxnotes').on('input.vxnotes keyup.vxnotes', () => this.scheduleAutoSave());
            $('#vx-notes-body')
                .off('.vxnotes')
                .on('tbwchange.vxnotes tbwpaste.vxnotes', () => this.scheduleAutoSave());
        } catch (_) {}

        // show inline editor
        this.showEditor();
        this.isEditorOpen = true;
    },

    closeEditor() {
        this.hideEditor();
        this.currentId = 0;
        this.updateListSelection();
        this.showPlaceholder();
    },

    scheduleAutoSave() {
        this.clearAutoSave();
        this._autoSaveTimer = window.setTimeout(() => {
            if (!this.isEditorOpen) return;
            this.saveCurrentNote({ silent: true, keepOpen: true });
        }, 1500);
    },

    clearAutoSave() {
        if (this._autoSaveTimer) {
            window.clearTimeout(this._autoSaveTimer);
            this._autoSaveTimer = null;
        }
    },

    hasUnsavedChanges() {
        if (!this.isEditorOpen) return false;
        const titleEl = document.getElementById('vx-notes-title');
        if (!titleEl) return false;
        let rawContent = '';
        try {
            rawContent = $('#vx-notes-body').trumbowyg('html');
        } catch (_) {
            rawContent = '';
        }
        return String(titleEl.value || '') !== this.lastSavedTitle || String(rawContent || '') !== this.lastSavedContent;
    },

    setEditorSaving(isSaving) {
        const updating = document.getElementById('vx-notes-editor-updating');
        const updated = document.getElementById('vx-notes-editor-updated');
        if (isSaving) {
            updating?.classList.remove('vx-hidden');
            updated?.classList.add('vx-hidden');
        } else {
            updating?.classList.add('vx-hidden');
        }
    },

    flashEditorSaved() {
        const updated = document.getElementById('vx-notes-editor-updated');
        updated?.classList.remove('vx-hidden');
        window.setTimeout(() => updated?.classList.add('vx-hidden'), 2000);
        document.dispatchEvent(new CustomEvent('vxNoteSaved'));
    },
    
    /**
     * 更新列表选中状态
     */
    updateListSelection() {
        document.querySelectorAll('.vx-notes-item').forEach(item => {
            const id = parseInt(item.dataset.id);
            item.classList.toggle('active', this.currentId === id);
        });
    },
    
    /**
     * 新建笔记
     */
    createNote() {
        if (!this.key) {
            this.renderKeyInit();
            return;
        }

        this.trackNote('新建笔记');

        // 老版：open(0) 进入空白编辑器，保存时 write(action=write,id=0)
        this.openEditor(0);
    },
    
    /**
     * 保存笔记
     */
    saveCurrentNote(options = {}) {
        const silent = !!options.silent;
        const keepOpen = options.keepOpen !== false;

        if (!this.key) {
            this.renderKeyInit();
            return;
        }

        const titleEl = document.getElementById('vx-notes-title');
        if (!titleEl) return;

        let rawTitle = String(titleEl.value || '');
        if (!rawTitle) rawTitle = 'untitled';

        let rawContent = '';
        try {
            rawContent = $('#vx-notes-body').trumbowyg('html');
        } catch (_) {
            rawContent = '';
        }

        // no change
        if (rawTitle === this.lastSavedTitle && rawContent === this.lastSavedContent) {
            if (!keepOpen) this.closeEditor();
            return;
        }

        const encTitle = this.enContent(rawTitle);
        const encContent = this.enContent(rawContent);
        if (!encTitle || !encContent) {
            VXUI.toastError((app && app.languageData && app.languageData.notes_encrypt_failed) || '加密失败');
            return;
        }

        this.trackUI('vui_notes[save_note]');
        this.setEditorSaving(true);
        $.post(TL.api_notes, {
            action: 'write',
            token: TL.api_token,
            id: this.currentId || 0,
            title: encTitle,
            tag: '0',
            content: encContent
        }, (rsp) => {
            this.setEditorSaving(false);
            if (!rsp) {
                if (!silent) VXUI.toastError((app && app.languageData && app.languageData.notes_save_failed) || '保存失败');
                return;
            }

            // 老版：status 1 新建返回 id；status 2 更新
            if (rsp.status === 1) {
                // 新建成功，更新当前 ID
                const newId = parseInt(rsp.data, 10) || 0;
                this.currentId = newId;
                this.lastSavedTitle = rawTitle;
                this.lastSavedContent = rawContent;
                this.flashEditorSaved();
                // 添加到本地列表并更新 UI，不重新加载
                this.addNoteToList(newId, rawTitle, rawContent);
                if (!keepOpen) this.closeEditor();
                return;
            }

            if (rsp.status === 2) {
                // 更新成功，更新本地列表
                this.lastSavedTitle = rawTitle;
                this.lastSavedContent = rawContent;
                this.flashEditorSaved();
                // 更新本地列表中的项目，不重新加载
                this.updateNoteInList(this.currentId, rawTitle, rawContent);
                if (!keepOpen) this.closeEditor();
                return;
            }

            if (!silent) VXUI.toastError(rsp.message || ((app && app.languageData && app.languageData.notes_save_failed) || '保存失败'));
        }, 'json').fail(() => {
            this.setEditorSaving(false);
            if (!silent) VXUI.toastError((app && app.languageData && app.languageData.notes_save_failed) || '保存失败');
        });
    },

    /**
     * 添加新笔记到本地列表
     */
    addNoteToList(id, rawTitle, rawContent) {
        const titleText = this.trimText(this.stripHtml(String(rawTitle)), 25);
        const contentText = this.trimText(this.stripHtml(String(rawContent)), 100);
        const now = new Date();
        const etime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        
        const newNote = {
            id,
            title: this.enContent(rawTitle),
            content: this.enContent(rawContent),
            raw_title: String(rawTitle),
            raw_content: String(rawContent),
            title_text: titleText,
            content_text: contentText,
            updatetime: Math.floor(now.getTime() / 1000),
            etime
        };
        
        // 添加到列表开头
        this.notesList.unshift(newNote);
        this.render();
    },

    /**
     * 更新本地列表中的笔记
     */
    updateNoteInList(id, rawTitle, rawContent) {
        const note = this.getNoteById(id);
        if (!note) return;
        
        const titleText = this.trimText(this.stripHtml(String(rawTitle)), 25);
        const contentText = this.trimText(this.stripHtml(String(rawContent)), 100);
        const now = new Date();
        const etime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        
        note.raw_title = String(rawTitle);
        note.raw_content = String(rawContent);
        note.title_text = titleText;
        note.content_text = contentText;
        note.updatetime = Math.floor(now.getTime() / 1000);
        note.etime = etime;
        
        // 将更新的笔记移到列表开头
        const index = this.notesList.indexOf(note);
        if (index > 0) {
            this.notesList.splice(index, 1);
            this.notesList.unshift(note);
        }
        
        // 只更新列表项，不重新渲染整个界面
        this.renderListOnly();
    },

    /**
     * 只渲染左侧列表，不影响右侧编辑器
     */
    renderListOnly() {
        const container = document.getElementById('vx-notes-list');
        if (!container) return;

        let filteredList = this.notesList;
        if (this.searchKeyword) {
            const keyword = this.searchKeyword.toLowerCase();
            filteredList = this.notesList.filter(note => 
                (note.title_text || '').toLowerCase().includes(keyword) ||
                (note.content_text || '').toLowerCase().includes(keyword) ||
                (note.raw_title || '').toLowerCase().includes(keyword) ||
                (note.raw_content || '').toLowerCase().includes(keyword)
            );
        }
        
        if (filteredList.length === 0) {
            if (this.searchKeyword) {
                container.innerHTML = `
                    <div class="vx-empty">
                        <div class="vx-empty-icon">
                            <iconpark-icon name="search"></iconpark-icon>
                        </div>
                        <h3 class="vx-empty-title">未找到匹配的密记</h3>
                        <p class="vx-empty-text">尝试其他关键词</p>
                    </div>
                `;
            } else {
                container.innerHTML = '';
                this.showEmpty();
            }
            return;
        }
        
        let html = '';
        filteredList.forEach(note => {
            html += this.renderItem(note);
        });
        
        container.innerHTML = html;
        this.updateStats();
    },
    
    /**
     * 删除笔记
     */
    deleteNote(id) {
        const message = (app && app.languageData && app.languageData.confirm_delete) || '确定要删除吗？';
        VXUI.confirm({
            title: (app && app.languageData && app.languageData.on_select_delete) || '删除',
            message,
            confirmClass: 'vx-btn-danger',
            onConfirm: () => this.doDelete(id)
        });
    },
    
    /**
     * 执行删除
     */
    doDelete(id) {
        const numericId = parseInt(id, 10) || 0;
        if (!numericId) return;

        const title = this.getNoteTitleById(numericId) || '未命名';
        this.trackNote(title);

        $.post(TL.api_notes, {
            action: 'delete',
            token: TL.api_token,
            id: numericId
        }, (rsp) => {
            if (rsp && rsp.status === 1) {
                VXUI.toastSuccess('删除成功');
                if (this.currentId === numericId) {
                    this.currentId = 0;
                }
                this.load();
            } else {
                VXUI.toastError((rsp && rsp.message) || '删除失败');
            }
        }, 'json');
    },
    
    /**
     * 内容变化处理
     */
    onContentChange() {
        // legacy inline editor removed
    },
    
    /**
     * 刷新
     */
    refresh() {
        this.load();
    },
    
    // ==================== UI Helpers ====================
    
    /**
     * 显示加载状态
     */
    showLoading() {
        const loading = document.getElementById('vx-notes-loading');
        const content = document.getElementById('vx-notes-content');
        const empty = document.getElementById('vx-notes-empty');
        
        if (loading) loading.classList.remove('vx-hidden');
        if (content) content.classList.add('vx-hidden');
        if (empty) empty.classList.add('vx-hidden');
    },
    
    /**
     * 隐藏加载状态
     */
    hideLoading() {
        const loading = document.getElementById('vx-notes-loading');
        if (loading) loading.classList.add('vx-hidden');
    },
    
    /**
     * 显示空状态
     */
    showEmpty() {
        const content = document.getElementById('vx-notes-content');
        const empty = document.getElementById('vx-notes-empty');
        
        if (content) content.classList.add('vx-hidden');
        if (empty) empty.classList.remove('vx-hidden');

        this.showPlaceholder();
    },
    
    /**
     * 更新统计
     */
    updateStats() {
        const countEl = document.getElementById('vx-notes-count');
        if (countEl) {
            countEl.textContent = this.notesList.length;
        }
        // selection refresh
        this.updateListSelection();
    }
};

// 注册模块
if (typeof VXUI !== 'undefined') {
    VXUI.registerModule('notes', VX_NOTES);
}
