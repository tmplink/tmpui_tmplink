/**
 * FileList Main Module
 * 主入口文件，整合所有子模块，管理状态和路由
 * 
 * 依赖：
 * - filelist-api.js    (FileListAPI)
 * - filelist-select.js (FileListSelect)
 * - filelist-render.js (FileListRender)
 * - filelist-actions.js (FileListActions)
 * - filelist-ui.js     (FileListUI)
 * 
 * 从 TL 获取的基础属性：
 * - TL.token       用户 token
 * - TL.api_url     API 地址
 * - TL.site_domain 网站域名
 * - TL.isLogin()   是否登录
 * - TL.currentLanguage 当前语言
 */

const FILELIST = {
    // 版本
    version: '2.0.0',
    
    // 当前状态
    mrid: '0',              // 当前文件夹 ID
    room: null,             // 当前文件夹信息
    fileList: [],           // 文件列表
    folderList: [],         // 子文件夹列表
    breadcrumb: [],         // 面包屑路径
    
    // 分页
    currentPage: 0,
    hasMore: true,
    isLoading: false,
    
    // 排序
    sortBy: 'time',
    sortType: 'desc',
    
    // 权限
    isOwner: false,

    /**
     * 初始化
     */
    init: function() {
        console.log('[FileList] Initializing v' + this.version);
        
        // 隐藏全局加载
        FileListUI.hideGlobalLoading();
        
        // 获取 URL 参数
        const params = this.getUrlParams();
        this.mrid = params.mrid || '0';
        
        // 重置状态
        this.resetState();
        
        // 初始化子模块
        FileListSelect.init();
        FileListRender.init();
        FileListUI.init();
        
        // 加载排序设置
        this.loadSortSettings();
        
        // 绑定事件
        this.bindEvents();
        
        // 加载数据
        this.loadFolderData();
        
        // 同步主题
        this.syncTheme();
        
        console.log('[FileList] Initialized, mrid:', this.mrid);
    },

    /**
     * 重置状态
     */
    resetState: function() {
        this.room = null;
        this.fileList = [];
        this.folderList = [];
        this.breadcrumb = [];
        this.currentPage = 0;
        this.hasMore = true;
        this.isLoading = false;
        this.isOwner = false;
        
        FileListSelect.clear();
        FileListRender.clear();
    },

    /**
     * 绑定事件
     */
    bindEvents: function() {
        // 无限滚动
        const content = document.querySelector('.fl-content');
        if (content) {
            content.addEventListener('scroll', () => {
                if (this.shouldLoadMore(content)) {
                    this.loadMoreFiles();
                }
            });
        }
        
        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            // Ctrl+A 全选
            if (e.ctrlKey && e.key === 'a') {
                const activeEl = document.activeElement;
                if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                    return;
                }
                e.preventDefault();
                FileListSelect.selectAll();
            }
            
            // Delete 删除
            if (e.key === 'Delete' && this.isOwner && FileListSelect.hasSelection()) {
                e.preventDefault();
                FileListActions.deleteSelected().then(() => this.refresh());
            }
        });
        
        // 选择变化事件
        document.addEventListener('filelist:selectionchange', (e) => {
            // 可以在这里处理选择变化后的逻辑
        });
    },

    /**
     * 加载文件夹数据
     */
    loadFolderData: async function() {
        if (this.isLoading) return;
        this.isLoading = true;
        
        FileListUI.showLoading();
        FileListRender.clear();
        
        try {
            // 获取文件夹信息
            const infoResult = await FileListAPI.getFolderInfo(this.mrid);
            if (infoResult.status !== 0) {
                FileListUI.showError(infoResult.message || '加载失败');
                this.isLoading = false;
                FileListUI.hideLoading();
                return;
            }
            
            this.room = infoResult.data || {};
            this.isOwner = this.room.owner === 1 || this.room.owner === true;
            
            // 更新 UI
            this.updateUI();
            
            // 加载子文件夹
            await this.loadSubFolders();
            
            // 加载文件
            await this.loadFiles();
            
            // 加载面包屑
            if (this.mrid !== '0') {
                await this.loadBreadcrumb();
            } else {
                this.breadcrumb = [];
                FileListRender.renderBreadcrumb([], null);
            }
            
            // 检查是否为空
            this.checkEmpty();
            
        } catch (error) {
            console.error('[FileList] Load error:', error);
            FileListUI.showError('加载失败');
        } finally {
            this.isLoading = false;
            FileListUI.hideLoading();
            FileListRender.applyViewMode();
        }
    },

    /**
     * 加载子文件夹
     */
    loadSubFolders: async function() {
        const result = await FileListAPI.getSubFolders(this.mrid);
        if (result.status === 0) {
            this.folderList = result.data || [];
            FileListRender.renderFolders(this.folderList, this.isOwner);
        }
    },

    /**
     * 加载文件
     */
    loadFiles: async function() {
        const result = await FileListAPI.getFiles(this.mrid, this.currentPage, this.sortBy, this.sortType);
        if (result.status === 0) {
            const files = this.normalizeFileData(result.data);
            this.fileList = this.fileList.concat(files);
            this.hasMore = files.length >= 20; // 假设每页 20 条
            
            FileListRender.renderFiles(files, this.isOwner, this.room?.model);
        }
    },

    /**
     * 加载更多文件
     */
    loadMoreFiles: async function() {
        if (!this.hasMore || this.isLoading) return;
        
        this.isLoading = true;
        this.currentPage++;
        
        try {
            await this.loadFiles();
        } finally {
            this.isLoading = false;
        }
    },

    /**
     * 加载面包屑
     */
    loadBreadcrumb: async function() {
        const result = await FileListAPI.getBreadcrumb(this.mrid);
        if (result.status === 0) {
            this.breadcrumb = result.data || [];
            FileListRender.renderBreadcrumb(this.breadcrumb, this.room?.name);
        }
    },

    /**
     * 标准化文件数据
     */
    normalizeFileData: function(data) {
        if (!data) return [];
        
        // 如果是对象（按类型分组），合并为数组
        if (!Array.isArray(data)) {
            let files = [];
            for (let key in data) {
                if (Array.isArray(data[key])) {
                    files = files.concat(data[key]);
                }
            }
            return files;
        }
        
        return data;
    },

    /**
     * 更新 UI
     */
    updateUI: function() {
        const isDesktop = this.mrid === '0' || this.room?.top === 99;
        
        // 更新权限 UI
        FileListUI.updatePermissionUI(this.isOwner, isDesktop, this.room?.model);
        
        // 更新文件夹信息
        FileListUI.updateFolderInfo(this.room, null, null);
        
        // 更新返回按钮
        const backBtn = document.querySelector('.fl-back-btn');
        const mobileBackBtn = document.getElementById('fl-mobile-back-btn');
        if (backBtn) backBtn.style.display = isDesktop ? 'none' : '';
        if (mobileBackBtn) mobileBackBtn.style.display = isDesktop ? 'none' : '';
    },

    /**
     * 检查是否为空
     */
    checkEmpty: function() {
        const isEmpty = this.folderList.length === 0 && this.fileList.length === 0;
        FileListRender.renderEmpty(isEmpty);
    },

    /**
     * 判断是否需要加载更多
     */
    shouldLoadMore: function(container) {
        if (!this.hasMore || this.isLoading) return false;
        
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        
        return scrollTop + clientHeight >= scrollHeight - 100;
    },

    // ==================== 导航 ====================

    /**
     * 导航到文件夹
     */
    navigateTo: function(mrid) {
        this.mrid = String(mrid);
        
        // 更新 URL
        const url = `/app&listview=filelist&mrid=${mrid}`;
        if (typeof app !== 'undefined' && app.dynOpen) {
            app.dynOpen(url);
        } else {
            window.history.pushState({}, '', url);
        }
        
        // 重新加载
        this.resetState();
        this.loadFolderData();
    },

    /**
     * 返回上级
     */
    goBack: function() {
        if (this.room && this.room.parent !== undefined) {
            this.navigateTo(this.room.parent);
        } else {
            this.navigateTo(0);
        }
    },

    /**
     * 刷新
     */
    refresh: function() {
        this.resetState();
        this.loadFolderData();
    },

    // ==================== 项目交互 ====================

    /**
     * 项目点击处理
     */
    onItemClick: function(event, element) {
        const type = element.dataset.flType;
        const id = element.dataset.flId;
        
        // Shift 点击 - 范围选择
        if (event.shiftKey) {
            event.preventDefault();
            FileListSelect.toggle(element, event);
            return;
        }
        
        // 选择模式下点击
        if (FileListSelect.isSelectMode) {
            FileListSelect.toggle(element, event);
            return;
        }
        
        // 正常点击 - 打开
        if (type === 'folder') {
            this.openFolder(id);
        } else {
            this.openFile(id);
        }
    },

    /**
     * 打开文件夹
     */
    openFolder: function(mrid) {
        this.navigateTo(mrid);
    },

    /**
     * 打开文件
     */
    openFile: function(ukey) {
        window.open('/file?ukey=' + ukey, '_blank');
    },

    // ==================== 操作方法（委托给子模块）====================

    downloadFile: function(ukey) {
        FileListActions.downloadFile(ukey);
    },

    shareFile: function(ukey) {
        const file = this.fileList.find(f => f.ukey === ukey);
        FileListActions.shareFile(ukey, file?.fname);
    },

    shareFolder: function(mrid) {
        const folder = this.folderList.find(f => String(f.mr_id) === String(mrid));
        FileListActions.shareFolder(mrid, folder?.name);
    },

    renameFolder: function(mrid) {
        const folder = this.folderList.find(f => String(f.mr_id) === String(mrid));
        FileListUI.showRenameModal('folder', mrid, folder?.name || '');
    },

    renameFile: function(ukey) {
        const file = this.fileList.find(f => f.ukey === ukey);
        FileListUI.showRenameModal('file', ukey, file?.fname || '');
    },

    deleteFolder: function(mrid) {
        FileListActions.deleteFolder(mrid).then(success => {
            if (success) this.refresh();
        });
    },

    deleteFile: function(ukey) {
        FileListActions.deleteFile(ukey).then(success => {
            if (success) this.refresh();
        });
    },

    showFileMenu: function(event, ukey) {
        const file = this.fileList.find(f => f.ukey === ukey);
        FileListUI.showFileMenu(event, ukey, file, this.isOwner);
    },

    downloadSelected: function() {
        FileListActions.downloadSelected();
    },

    deleteSelected: function() {
        FileListActions.deleteSelected().then(success => {
            if (success) this.refresh();
        });
    },

    moveSelected: function() {
        FileListActions.moveSelected();
    },

    shareSelected: function() {
        FileListActions.shareSelected(this.fileList, this.folderList);
    },

    selectAll: function() {
        FileListSelect.selectAll();
    },

    selectNone: function() {
        FileListSelect.clear();
    },

    // ==================== 视图控制 ====================

    setViewMode: function(mode) {
        FileListRender.setViewMode(mode);
    },

    toggleSidebar: function() {
        FileListUI.toggleSidebar();
    },

    // ==================== 搜索 ====================

    search: async function() {
        const input = document.getElementById('fl-search-input');
        const keyword = input ? input.value.trim() : '';
        
        if (!keyword) {
            this.refresh();
            return;
        }
        
        FileListUI.showLoading();
        FileListRender.clear();
        
        try {
            const result = await FileListAPI.searchFiles(this.mrid, keyword);
            if (result.status === 0) {
                const files = this.normalizeFileData(result.data);
                this.fileList = files;
                FileListRender.renderFiles(files, this.isOwner, this.room?.model);
            }
        } finally {
            FileListUI.hideLoading();
            FileListRender.applyViewMode();
            this.checkEmpty();
        }
    },

    // ==================== 排序 ====================

    loadSortSettings: function() {
        this.sortBy = localStorage.getItem('filelist_sort_by') || 'time';
        this.sortType = localStorage.getItem('filelist_sort_type') || 'desc';
    },

    setSort: function(sortBy, sortType) {
        this.sortBy = sortBy;
        this.sortType = sortType;
        localStorage.setItem('filelist_sort_by', sortBy);
        localStorage.setItem('filelist_sort_type', sortType);
        this.refresh();
    },

    showSortModal: function() {
        FileListUI.showSortModal();
    },

    // ==================== 创建文件夹 ====================

    showCreateFolderModal: function() {
        FileListUI.showCreateFolderModal(this.mrid);
    },

    createFolder: async function(name, model) {
        const success = await FileListActions.createFolder(this.mrid, name, model);
        if (success) {
            this.refresh();
        }
        return success;
    },

    // ==================== 修改有效期 ====================

    changeFileModel: function(ukey) {
        // 单个文件修改有效期时，先选中该文件
        FileListSelect.clear();
        const el = document.querySelector(`[data-fl-type="file"][data-fl-id="${ukey}"]`);
        if (el) {
            FileListSelect.toggle(el);
        }
        FileListUI.showExpiryModal();
    },

    // ==================== 上传 ====================

    openUpload: function() {
        // 调用 TL 的上传功能（如果存在）
        if (typeof TL !== 'undefined' && TL.uploader && TL.uploader.open) {
            TL.uploader.open(this.mrid);
        }
    },

    // ==================== 相册模式 ====================

    openPhotoAlbum: function() {
        if (typeof TL !== 'undefined' && typeof TL.openPhotoAlbum === 'function') {
            TL.openPhotoAlbum();
        }
    },

    // ==================== 文件夹设置 ====================

    openFolderSettings: function(mrid) {
        FileListUI.showSettingsModal();
    },

    /**
     * 保存文件夹设置（由 UI 模块调用）
     */
    saveFolderSettings: async function() {
        // 委托给 FileListUI.confirmSettings()
        await FileListUI.confirmSettings();
    },

    /**
     * 切换直链功能
     */
    toggleDirectLink: async function() {
        if (!this.room || !this.mrid) return;
        
        const enabled = $('#fl-pf-allow-direct').is(':checked');
        
        try {
            const result = await FileListAPI.toggleDirectLink(this.mrid, enabled);
            if (result.status === 0) {
                FileListUI.showSuccess(enabled ? '已启用直链' : '已禁用直链');
                this.room.allow_direct = enabled ? 1 : 0;
            } else {
                FileListUI.showError(result.message || '操作失败');
                // 恢复复选框状态
                $('#fl-pf-allow-direct').prop('checked', !enabled);
            }
        } catch (error) {
            console.error('Toggle direct link error:', error);
            FileListUI.showError('操作失败');
            $('#fl-pf-allow-direct').prop('checked', !enabled);
        }
    },

    /**
     * 从排序 Modal 应用排序（兼容旧调用）
     */
    applySortFromModal: function() {
        FileListUI.confirmSort();
    },

    // ==================== 工具方法 ====================

    getUrlParams: function() {
        const params = {};
        const search = window.location.search.substring(1);
        if (search) {
            search.split('&').forEach(pair => {
                const [key, value] = pair.split('=');
                params[decodeURIComponent(key)] = decodeURIComponent(value || '');
            });
        }
        return params;
    },

    syncTheme: function() {
        // 同步主题
        if (typeof TL !== 'undefined' && typeof TL.matchNightModel === 'function') {
            const isDark = TL.matchNightModel();
            document.body.classList.toggle('fl-dark', isDark);
        }
    },

    /**
     * 检查是否登录
     */
    isLogin: function() {
        return typeof TL !== 'undefined' && typeof TL.isLogin === 'function' && TL.isLogin();
    }
};

// 导出模块
if (typeof window !== 'undefined') {
    window.FILELIST = FILELIST;
}
