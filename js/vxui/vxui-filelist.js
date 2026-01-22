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

        // 防止事件监听器重复绑定
        this.unbindEvents();
        this.hideContextMenu();
        
        // 获取 mrid 参数（mrid=0 代表桌面，不能用 || 兜底）
        const hasMridParam = (params && Object.prototype.hasOwnProperty.call(params, 'mrid'));
        const targetMrid = hasMridParam ? params.mrid : (this.getUrlMrid() || 0);

        // 获取 start 参数（非属主路径根），未传时默认当前目录
        const hasStartParam = (params && Object.prototype.hasOwnProperty.call(params, 'start'));
        const urlStart = this.getUrlStart();
        const targetStart = hasStartParam ? params.start : urlStart;
        this.startMrid = (targetStart !== undefined && targetStart !== null && String(targetStart) !== '')
            ? targetStart
            : targetMrid;
        
        // 检查登录状态：访问桌面(mrid=0)需要登录，访问子文件夹允许未登录（公开文件夹）
        const isDesktopAccess = String(targetMrid) === '0' || targetMrid === 0;
        if (isDesktopAccess && typeof TL !== 'undefined' && !TL.isLogin()) {
            VXUI.toastWarning(this.t('vx_need_login', '请先登录'));
            setTimeout(() => {
                window.location.href = '/?tmpui_page=/app&listview=login';
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
        this.photoList = [];
        this.lightboxOpen = false;

        // reset direct state
        this.directDomain = null;
        this.directProtocol = 'http://';
        this.directDomainReady = false;
        this.directDirEnabled = false;
        this.directDirKey = null;
        this.directLoading = false;

        // reset folder privacy state
        this._privacyLoading = false;
        this._publishLoading = false;
        
        // 初始化上传模块（预加载服务器列表）
        if (typeof VX_UPLOADER !== 'undefined') {
            VX_UPLOADER.init();
        }
        
        // 显示加载状态
        this.showLoading();
        
        // 更新侧边栏
        this.updateSidebar();
        
        // 应用视图模式
        this.applyViewMode();
        
        // 加载文件夹数据
        this.loadRoom();
        
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

        // 同步直链侧边栏区域（模板每次都会被重建）
        this.applyDirectSidebarUI();

        // 同步文件夹公开/私有开关
        this.applyFolderPrivacyUI();

        // 同步文件夹发布开关
        this.applyFolderPublishUI();
        
        // 更新相册视图控制显示
        this.updateAlbumViewControls();

        // 显示移动端视图切换按钮
        this.setMobileViewToggleVisible(true);

        // 显示移动端操作按钮（上传/新建）
        this.setMobileActionToggleVisible(true);

        // 显示移动端文件夹名称栏
        this.setMobileFolderBarVisible(true);
    },

    applyFolderPrivacyUI() {
        const section = document.getElementById('vx-fl-privacy-section');
        const toggle = document.getElementById('vx-fl-privacy-toggle');
        const stateEl = document.getElementById('vx-fl-privacy-state');
        const hintEl = document.getElementById('vx-fl-privacy-hint');

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

        if (stateEl) {
            stateEl.textContent = (current === 'private')
                ? this.t('vx_privacy_private', '私有')
                : this.t('vx_privacy_public', '公开');
        }

        if (hintEl) {
            hintEl.textContent = (current === 'private')
                ? this.t('modal_meetingroom_type2', '私有，仅自己可访问。')
                : this.t('modal_meetingroom_type1', '公开，所有人都可访问。');
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
        const mobileListBtn = document.getElementById('vx-mobile-view-list');
        const mobileAlbumBtn = document.getElementById('vx-mobile-view-album');
        if (mobileListBtn) mobileListBtn.classList.toggle('active', this.viewMode === 'list');
        if (mobileAlbumBtn) mobileAlbumBtn.classList.toggle('active', this.viewMode === 'album');
        
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

    /**
     * 移动端顶部视图切换按钮显示/隐藏
     */
    setMobileViewToggleVisible(show) {
        const toggle = document.getElementById('vx-mobile-view-toggle');
        if (!toggle) return;
        toggle.style.display = show ? 'flex' : 'none';
    },

    /**
     * 移动端顶部操作按钮显示/隐藏
     */
    setMobileActionToggleVisible(show) {
        const toggle = document.getElementById('vx-mobile-action-toggle');
        if (toggle) {
            toggle.style.display = show ? 'flex' : 'none';
        }
    },

    /**
     * 移动端文件夹名称栏显示/隐藏
     */
    setMobileFolderBarVisible(show) {
        const bar = document.getElementById('vx-fl-mobile-folder-bar');
        if (!bar) return;
        if (typeof window !== 'undefined' && window.matchMedia) {
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            bar.style.display = (show && isMobile) ? 'flex' : 'none';
            return;
        }
        bar.style.display = show ? 'flex' : 'none';
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
    },
    
    /**
     * 解绑事件
     */
    unbindEvents() {
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

        if (opts.refreshing) {
            this.setRefreshing(true);
        }
        if (opts.showLoading !== false) {
            this.showLoading();
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
        
        $.post(apiUrl, {
            action: 'details',
            token: token,
            mr_id: this.mrid
        }, (rsp) => {
            if (rsp.status === 0) {
                this.hideLoading();
                this.showFolderNotFound();
                finalize();
                return;
            }
            
            if (rsp.status === 3) {
                VXUI.toastWarning(this.t('vx_need_login', '请先登录'));
                setTimeout(() => {
                    window.location.href = '/?tmpui_page=/app&listview=login';
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
                // 桌面目录在老逻辑中用 top=99 表示，且 parent 固定为 0
                if (!this.room || typeof this.room !== 'object') {
                    this.room = {};
                }
                this.room.mr_id = 0;
                this.room.top = 99;
                this.room.parent = 0;
                this.room.name = (typeof app !== 'undefined' && app.languageData && app.languageData.navbar_meetingroom) 
                    ? app.languageData.navbar_meetingroom : '桌面';
            }
            
            // 更新 UI
            this.updateRoomUI();

            // 加载完整路径（用于面包屑）
            this.loadFullPath();

            // 记录目录/相册浏览
            this.trackRoomView();

            // 更新侧边栏：公开/私有切换（基于最新 room/isOwner/isDesktop）
            this.applyFolderPrivacyUI();
            this.applyFolderPublishUI();

            // 加载文件夹直链状态（仅非桌面/登录且 owner 时显示）
            this.loadDirectFolderState();
            
            // 加载文件列表
            this.loadFileList(0);
            
            finalize();
        }, 'json').fail(() => {
            this.hideLoading();
            VXUI.toastError(this.t('vx_load_failed', '加载失败'));
            finalize();
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
        const btn = document.getElementById('vx-fl-refresh-btn');
        const text = btn ? btn.querySelector('[data-role="refresh-text"]') : null;

        this.refreshing = !!on;

        if (!btn) return;

        if (this.refreshing) {
            btn.disabled = true;
            btn.dataset.refreshing = '1';
            if (text) text.textContent = this.t('vx_refreshing', '刷新中');
        } else {
            btn.disabled = false;
            delete btn.dataset.refreshing;
            if (text) text.textContent = this.t('album_refresh', '刷新');
        }
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
        
        // 更新面包屑
        this.updateBreadcrumb();
        
        // 显示/隐藏返回按钮
        const backBtn = document.getElementById('vx-fl-back-btn');
        const mobileBackBtn = document.getElementById('vx-mobile-back');
        
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
        if (mobileBackBtn) {
            mobileBackBtn.style.display = showBack ? '' : 'none';
        }
        
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

        const mobileReportBtn = document.getElementById('vx-mobile-report-btn');
        if (mobileReportBtn) {
            const mr_id = (this.room && this.room.mr_id !== undefined && this.room.mr_id !== null) ? this.room.mr_id : this.mrid;
            const top = (this.room && this.room.top !== undefined && this.room.top !== null) ? this.room.top : 0;
            // 举报按钮的显示逻辑
            const showReport = !this.isOwner && !this.isDesktop && mr_id && String(mr_id) !== '0' && Number(top) !== 99;
            mobileReportBtn.style.display = showReport ? '' : 'none';

            // 如果显示举报按钮（即非拥有者模式），则强制隐藏操作按钮容器，避免产生不必要的间距
            // 如果是拥有者模式（不显示举报），则操作按钮容器会因内部有按钮被显示而正常展示（前提是 setMobileActionToggleVisible(true)）
            // 注意：setMobileActionToggleVisible 默认是 true (在 updateSidebar 中设置)，但它只控制容器的 display。
            // 真正的按钮显隐由前面的 querySelectorAll('[data-owner="true"]') 处理。
            // 这里我们需要额外处理容器的显隐，以解决空容器导致的布局问题。
            const actionToggle = document.getElementById('vx-mobile-action-toggle');
            if (actionToggle) {
                // 如果显示举报按钮，说明是非拥有者，操作按钮组必定为空，直接隐藏容器
                if (showReport) {
                    actionToggle.style.display = 'none';
                } else {
                     // 否则恢复显示（这里假设默认是需要显示的，具体的显示权交给 setMobileActionToggleVisible）
                    // 但这也可能覆盖 setMobileActionToggleVisible 的逻辑。
                    // 更好的做法是：检查 actionToggle 内部是否有可见的按钮。
                     const hasVisibleBtn = Array.from(actionToggle.children).some(child => child.style.display !== 'none');
                     actionToggle.style.display = hasVisibleBtn ? 'flex' : 'none';
                }
            }
        }
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
        const show = this.isOwner && !this.isDesktop && this.mrid && String(this.mrid) !== '0';
        if (!show) {
            this.directDomain = null;
            this.directDomainReady = false;
            this.directDirEnabled = false;
            this.directDirKey = null;
            this.applyDirectSidebarUI();
            return;
        }

        if (this.directLoading) return;
        this.directLoading = true;

        try {
            const details = await this.apiDirectPost({ action: 'details' });
            if (details && details.status === 1 && details.data) {
                const d = details.data;
                this.directDomain = d.domain;
                const ssl = d.ssl_status === 'yes';
                const ssl_acme = d.ssl_acme === 'disable' ? false : true;
                this.directProtocol = (ssl || ssl_acme) ? 'https://' : 'http://';
                this.directDomainReady = !!(this.directDomain && this.directDomain !== 0);
            } else {
                this.directDomain = null;
                this.directDomainReady = false;
            }

            if (!this.directDomainReady) {
                this.directDirEnabled = false;
                this.directDirKey = null;
                this.applyDirectSidebarUI();
                return;
            }

            const rsp = await this.apiDirectPost({ action: 'dir_details', mrid: this.mrid });
            if (rsp && rsp.status === 1) {
                this.directDirEnabled = true;
                this.directDirKey = rsp.data;
            } else {
                this.directDirEnabled = false;
                this.directDirKey = null;
            }

            this.applyDirectSidebarUI();

            // 直链状态变化会影响文件操作按钮
            this.render();
        } catch (e) {
            console.error('[VX_FILELIST] loadDirectFolderState error:', e);
            this.directDomain = null;
            this.directDomainReady = false;
            this.directDirEnabled = false;
            this.directDirKey = null;
            this.applyDirectSidebarUI();
        } finally {
            this.directLoading = false;
        }
    },

    async toggleDirectForFolder() {
        const toggle = document.getElementById('vx-fl-direct-toggle');
        if (!toggle) return;

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
                VXUI.toastError(this.t('vx_enable_failed', '开启失败'));
                toggle.checked = false;
            }
        } catch (e) {
            console.error(e);
            VXUI.toastError(this.t('vx_enable_failed', '开启失败'));
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

    copyDirectFileLinkByUkey(ukey) {
        const file = (this.fileList || []).find(f => String(f.ukey) === String(ukey));
        if (!file) {
            VXUI.toastError(this.t('vx_file_not_found', '文件不存在'));
            return;
        }
        const link = this.getDirectFileShareLink(file);
        if (!link) {
            VXUI.toastWarning(this.t('vx_direct_not_enabled', '未开启文件夹直链'));
            return;
        }
        VXUI.copyToClipboard(link);
    },
    
    /**
     * 更新面包屑
     */
    updateBreadcrumb() {
        const container = document.getElementById('vx-fl-breadcrumb');
        const mobileContainer = document.getElementById('vx-fl-mobile-breadcrumb');
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

                if (!isLast) {
                    // 未登录时避免展示桌面链接（桌面需登录）
                    if (id === '0' && !isLoggedIn) {
                        html += `<span>${this.escapeHtml(desktopTitle)}</span>`;
                    } else {
                        html += `<a href="javascript:;" onclick="VX_FILELIST.openFolder('${this.escapeHtml(id)}')">${this.escapeHtml(name)}</a>`;
                    }
                } else {
                    html += `<span>${this.escapeHtml(name)}</span>`;
                }
            });
        } else {
            // 未登录时不显示桌面链接（桌面需要登录才能访问）
            if (isLoggedIn) {
                html = `<a href="javascript:;" onclick="VX_FILELIST.openFolder(0)">${this.escapeHtml(desktopTitle)}</a>`;
            }

            if (this.mrid != 0 && this.room.name) {
                if (html) {
                    html += '<span class="vx-breadcrumb-sep">›</span>';
                }
                html += `<a href="javascript:;">${this.escapeHtml(this.room.name)}</a>`;
            }
        }
        
        container.innerHTML = html;
        if (mobileContainer) {
            mobileContainer.innerHTML = html;
        }
    },
    
    /**
     * 加载文件列表
     */
    loadFileList(page) {
        if (page === 0) {
            this.pageNumber = 0;
            this.fileList = [];
            this.photoList = [];
        } else {
            this.pageNumber++;
        }
        
        const token = this.getToken();
        if (!token) {
            this.hideLoading();
            this.render();
            return;
        }
        
        const sortBy = localStorage.getItem(`vx_room_sort_by_${this.mrid}`) || this.room.sort_by || 0;
        const sortType = localStorage.getItem(`vx_room_sort_type_${this.mrid}`) || this.room.sort_type || 0;
        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';
        
        $.post(apiUrl, {
            action: 'file_list_page',
            mr_id: this.mrid,
            page: this.pageNumber,
            sort_by: sortBy,
            sort_type: sortType,
            token: token
        }, (rsp) => {
            this.hideLoading();
            
            if (rsp.status === 1 && rsp.data && rsp.data.length > 0) {
                this.fileList = this.fileList.concat(rsp.data);
                
                // 提取图片文件用于相册模式
                this.photoList = this.fileList.filter(file => 
                    this.isImageFile(file.ftype)
                );
            }
            
            // 渲染
            this.render();
            
            // 更新项目数量
            this.updateItemCount();
            
        }, 'json').fail(() => {
            this.hideLoading();
            this.render();
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
     * 更新项目数量
     */
    updateItemCount() {
        const count = (this.subRooms ? this.subRooms.length : 0) + (this.fileList ? this.fileList.length : 0);
        const countEl = document.getElementById('vx-fl-item-count');
        if (countEl) {
            countEl.textContent = count;
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
    },
    
    /**
     * 渲染列表视图
     */
    renderList() {
        const listContainer = document.getElementById('vx-fl-list');
        const albumContainer = document.getElementById('vx-fl-album');
        const listBody = document.getElementById('vx-fl-list-body');
        const empty = document.getElementById('vx-fl-empty');
        
        if (!listBody) return;
        
        listBody.innerHTML = '';
        
        const hasContent = (this.subRooms && this.subRooms.length > 0) || (this.fileList && this.fileList.length > 0);
        
        if (!hasContent) {
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
        
        // 初始化剩余时间倒计时
        this.initLeftTimeCountdown();

        // Translate any dynamic rows (e.g. folder type label)
        if (typeof TL !== 'undefined' && typeof TL.tpl_lang === 'function') {
            TL.tpl_lang(listBody);
        }

        // 重新绑定 tmpui 链接
        if (typeof app !== 'undefined' && typeof app.linkRebind === 'function') {
            app.linkRebind();
        }
    },
    
    /**
     * 渲染相册视图
     */
    renderAlbum() {
        const listContainer = document.getElementById('vx-fl-list');
        const albumContainer = document.getElementById('vx-fl-album');
        const albumGrid = document.getElementById('vx-fl-album-grid');
        const empty = document.getElementById('vx-fl-empty');
        
        if (!albumGrid) return;
        
        albumGrid.innerHTML = '';
        
        const hasContent = (this.subRooms && this.subRooms.length > 0) || (this.photoList && this.photoList.length > 0);
        
        if (!hasContent) {
            if (empty) empty.style.display = 'flex';
            if (listContainer) listContainer.style.display = 'none';
            if (albumContainer) albumContainer.style.display = 'none';
            return;
        }
        
        if (empty) empty.style.display = 'none';
        if (listContainer) listContainer.style.display = 'none';
        if (albumContainer) albumContainer.style.display = '';
        
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
        
        this.photoList.forEach((photo, index) => {
            const name = photo.fname || '未命名';
            const fid = photo.ukey;
            const thumbnail = this.buildImageUrl(photo, 'thumb', '800x600');
            const size = photo.fsize_formated || this.formatSize(photo.fsize || 0);
            
            const html = template
                .replace(/{index}/g, index)
                .replace(/{fid}/g, fid)
                .replace(/{thumbnail}/g, thumbnail)
                .replace(/{name}/g, this.escapeHtml(name))
                .replace(/{size}/g, size);
            
            container.insertAdjacentHTML('beforeend', html);
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
     * 构建文件夹分享链接
     */
    buildFolderShareUrl(mrid) {
        const domain = (typeof TL !== 'undefined' && TL.site_domain) ? TL.site_domain : location.host;
        const pathPrefix = this.viewMode === 'album' ? 'vx_photo' : 'vx_dir';
        return `https://${domain}/${pathPrefix}/${mrid}`;
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
                <button class="vx-list-action-btn" onclick="event.stopPropagation(); VX_FILELIST.shareFolder('${folder.mr_id}', '${this.escapeHtml(shareUrl)}')" title="分享">
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
            <div class="vx-list-date vx-hide-mobile">
                ${folder.ctime || '--'}
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
        
        // 移动端未登录时不显示多选框
        const showCheckbox = this.canUseSelectMode();
        
        row.innerHTML = `
            ${showCheckbox ? '<div class="vx-list-checkbox" onclick="event.stopPropagation(); VX_FILELIST.toggleItemSelect(this.parentNode)"></div>' : ''}
            <div class="vx-list-name">
                <div class="vx-list-icon ${iconInfo.class}">
                    <iconpark-icon name="${iconInfo.icon}"></iconpark-icon>
                </div>
                <div class="vx-list-filename">
                    <a href="/file?ukey=${file.ukey}" tmpui-app="true" target="_blank" onclick="event.stopPropagation();">${this.escapeHtml(file.fname)}</a>
                    ${file.hot > 0 ? '<iconpark-icon name="fire" class="vx-hot-badge"></iconpark-icon>' : ''}
                    ${file.like > 0 ? `<span class="vx-like-badge"><iconpark-icon name="like"></iconpark-icon>${file.like}</span>` : ''}
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
            <div class="vx-list-date vx-hide-mobile">
                ${file.ctime || '--'}
            </div>
            <div class="vx-list-actions">
                <button class="vx-list-action-btn" data-role="download-btn" data-ukey="${file.ukey}" onclick="event.stopPropagation(); VX_FILELIST.downloadFile('${file.ukey}')" title="下载">
                    <iconpark-icon name="cloud-arrow-down"></iconpark-icon>
                </button>
                <button class="vx-list-action-btn" onclick="event.stopPropagation(); VX_FILELIST.shareFile('${file.ukey}')" title="${this.t('on_select_share', '复制分享链接')}">
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
        `;
        
        return row;
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
    
    // ==================== 相册模式操作 ====================
    
    /**
     * 图片卡片点击
     */
    photoCardClick(event, index) {
        if (this.selectMode) {
            this.togglePhotoSelect(index);
        } else {
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
        this.loadRoom({ refreshing: true, showLoading: true });
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
        const name = filename || ukey || 'file';
        this.trackUI(`vui_download[${name}]`);
        if (typeof VXUI !== 'undefined' && typeof VXUI.toastInfo === 'function') {
            VXUI.toastInfo(this.t('vx_download_start', '开始下载'));
        }
        const listBtn = document.querySelector(`.vx-list-row[data-ukey="${ukey}"] [data-role="download-btn"]`);
        this.downloadByUkey(ukey, { filename, listBtn });
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
    deleteFile(ukey) {
        if (!confirm(this.t('vx_confirm_delete_file', '确定要删除此文件吗？'))) return;
        
        const token = this.getToken();

        this._deleteFileWithFallback(ukey, token).then((ok) => {
            this.refresh();
            if (ok) {
                VXUI.toastSuccess(this.t('vx_delete_success', '删除成功'));
            } else {
                VXUI.toastError(this.t('vx_delete_failed_retry', '删除失败，请重试'));
            }
        });
    },

    /**
     * 删除文件：优先从当前文件夹删除；失败时回退到从工作区移除（兼容老逻辑 remove_from_workspace）。
     */
    _deleteFileWithFallback(ukey, token) {
        const mrApiUrl = (typeof TL !== 'undefined' && TL.api_mr)
            ? TL.api_mr
            : '/api_v2/meetingroom';
        const fileApiUrl = (typeof TL !== 'undefined' && TL.api_file)
            ? TL.api_file
            : ((typeof TL !== 'undefined' && TL.api_url) ? (TL.api_url + '/file') : '/api_v2/file');

        return new Promise((resolve) => {
            // 1) meetingroom 删除
            $.post(mrApiUrl, {
                action: 'file_del',
                token: token,
                mr_id: this.mrid,
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
        
        const token = this.getToken();
        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';
        
        $.post(apiUrl, {
            action: 'delete',
            token: token,
            mr_id: mrid
        }, () => {
            this.refresh();
            VXUI.toastSuccess(this.t('vx_delete_success', '删除成功'));
        });
    },
    
    /**
     * 重命名文件夹
     */
    renameFolder(mrid) {
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
    shareFolder(mrid, url) {
        // 如果没有传入 url，构建当前文件夹的链接
        if (!url) {
            if (this.isDesktop && !mrid) {
                VXUI.toastWarning(this.t('vx_desktop_cannot_share', '桌面无法分享'));
                return;
            }
            const targetMrid = mrid || this.mrid;
            url = this.buildFolderShareUrl(targetMrid);
        }
        
        if (typeof VXUI !== 'undefined' && VXUI.copyToClipboard) {
            VXUI.copyToClipboard(url);
            VXUI.toastSuccess(this.t('vx_link_copied', '链接已复制'));
        } else if (typeof TL !== 'undefined' && typeof TL.bulkCopy === 'function') {
            // 使用老版的复制方法
            TL.bulkCopy(null, btoa(url), true);
        } else {
            navigator.clipboard.writeText(url).then(() => {
                VXUI.toastSuccess(this.t('vx_link_copied', '链接已复制'));
            }).catch(() => {
                VXUI.toastError(this.t('vx_copy_failed', '复制失败'));
            });
        }
    },

    /**
     * 分享文件（复制链接）
     * @param {string} ukey - 文件 UKEY
     */
    shareFile(ukey) {
        if (!ukey) return;
        const domain = (typeof TL !== 'undefined' && TL.site_domain) ? TL.site_domain : window.location.host;
        const safeKey = encodeURIComponent(String(ukey));
        const url = `https://${domain}/f/${safeKey}`;

        if (typeof VXUI !== 'undefined' && VXUI.copyToClipboard) {
            VXUI.copyToClipboard(url);
            VXUI.toastSuccess(this.t('vx_link_copied', '链接已复制'));
        } else if (typeof TL !== 'undefined' && typeof TL.bulkCopy === 'function') {
            TL.bulkCopy(null, btoa(url), true);
        } else {
            navigator.clipboard.writeText(url).then(() => {
                VXUI.toastSuccess(this.t('vx_link_copied', '链接已复制'));
            }).catch(() => {
                VXUI.toastError(this.t('vx_copy_failed', '复制失败'));
            });
        }
    },
    
    /**
     * 取消收藏文件夹
     */
    unfavoriteFolder(mrid) {
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
                VXUI.toastSuccess(this.t('vx_move_success', '移动成功'));
                this.clearSelection();
                this.refresh();
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

            this.clearSelection();
            this.refresh();

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
        const isLoggedIn = (typeof TL !== 'undefined' && TL.isLogin && TL.isLogin());
        const canDirectShare = isFile && isLoggedIn && this.directDomainReady && this.directDirEnabled && this.directDirKey;
        
        let menuItems = [];
        let title = '';
        
        if (isFile) {
            const ukey = target.dataset.ukey;
            const file = this.fileList.find(f => f.ukey === ukey);
            title = file ? (file.fname_ex || file.fname) : this.t('file', '文件');
            const currentModel = file ? file.model : -1;
            
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
        const isLoggedIn = (typeof TL !== 'undefined' && TL.isLogin && TL.isLogin());
        const canDirectShare = isFile && isLoggedIn && this.directDomainReady && this.directDirEnabled && this.directDirKey;

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

        // 非 owner：隐藏重命名/删除
        if (elRename) elRename.style.display = canOwnerOps ? '' : 'none';
        if (elDelete) elDelete.style.display = canOwnerOps ? '' : 'none';
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

        // 对齐老版：使用 ukeys 数组
        const apiUrl = (typeof TL !== 'undefined' && TL.api_file)
            ? TL.api_file
            : ((typeof TL !== 'undefined' && TL.api_url) ? (TL.api_url + '/file') : '/api_v2/file');

        $.post(apiUrl, {
            action: 'change_model',
            token: token,
            ukeys: [ukey],
            model: model
        }, (rsp) => {
            if (rsp && rsp.status === 1) {
                VXUI.toastSuccess(this.t('vx_update_success', '修改成功'));
                this.refresh();
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
            modelSelect.disabled = (Number(parent) > 0);
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
    
    createFolder() {
        const name = document.getElementById('vx-fl-folder-name')?.value?.trim();
        if (!name) {
            VXUI.toastWarning(this.t('vx_enter_folder_name', '请输入文件夹名称'));
            return;
        }
        
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
                this.refresh();
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
        
        const name = document.getElementById('vx-fl-rename-input')?.value?.trim();
        if (!name) {
            VXUI.toastWarning(this.t('vx_enter_new_name', '请输入新名称'));
            return;
        }
        
        const token = this.getToken();
        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';
        
        if (this._renameTarget.type === 'folder') {
            $.post(apiUrl, {
                action: 'rename',
                token: token,
                name: name,
                mr_id: this._renameTarget.id
            }, () => {
                this.closeRenameModal();
                this.refresh();
                VXUI.toastSuccess(this.t('vx_rename_success', '重命名成功'));
            });
        } else {
            if (typeof TL !== 'undefined' && TL.file_rename) {
                const req = TL.file_rename(this._renameTarget.id, name);
                if (req && typeof req.done === 'function') {
                    req.done(() => {
                        this.closeRenameModal();
                        this.refresh();
                        VXUI.toastSuccess(this.t('vx_rename_success', '重命名成功'));
                    }).fail(() => {
                        VXUI.toastError(this.t('vx_rename_fail', '重命名失败'));
                    });
                } else {
                    this.closeRenameModal();
                }
            }
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
