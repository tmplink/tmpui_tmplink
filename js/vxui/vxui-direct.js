/**
 * VXUI Direct (直链) Module
 * 直链管理模块 - 基于新 VXUI 框架
 * @version 1.0.0
 */

'use strict';

const VX_DIRECT = {
    // 状态
    directList: [],
    selectedItems: new Set(),
    pageNumber: 0,
    hasMore: true,
    isLoading: false,
    
    /**
     * 初始化模块
     */
    init(params = {}) {
        console.log('[VX_DIRECT] Initializing...', params);
        
        // 检查登录状态
        if (typeof TL !== 'undefined' && !TL.isLogin()) {
            VXUI.navigate('login');
            return;
        }
        
        // 重置状态
        this.resetState();
        
        // 更新侧边栏
        this.updateSidebar();
        
        // 绑定事件
        this.bindEvents();
        
        // 加载数据
        this.load();
    },
    
    /**
     * 销毁模块
     */
    destroy() {
        console.log('[VX_DIRECT] Destroying...');
        this.unbindEvents();
    },
    
    /**
     * 重置状态
     */
    resetState() {
        this.directList = [];
        this.selectedItems.clear();
        this.pageNumber = 0;
        this.hasMore = true;
    },
    
    /**
     * 更新侧边栏
     */
    updateSidebar() {
        const sidebarDynamic = document.getElementById('vx-sidebar-dynamic');
        if (!sidebarDynamic) return;
        
        sidebarDynamic.innerHTML = `
            <div class="vx-nav-section">
                <div class="vx-nav-title" data-tpl="direct_actions">操作</div>
                <a href="javascript:;" class="vx-nav-item" onclick="VX_DIRECT.refresh()">
                    <iconpark-icon name="rotate"></iconpark-icon>
                    <span class="vx-nav-item-text" data-tpl="album_refresh">刷新</span>
                </a>
            </div>
            
            <div class="vx-nav-section">
                <div class="vx-nav-title" data-tpl="direct_help">帮助</div>
                <a href="javascript:;" class="vx-nav-item" onclick="VX_DIRECT.showHelp()">
                    <iconpark-icon name="info-circle"></iconpark-icon>
                    <span class="vx-nav-item-text" data-tpl="direct_what">什么是直链</span>
                </a>
            </div>
        `;
        
        if (typeof app !== 'undefined') {
            app.languageBuild();
        }

        if (typeof VXUI !== 'undefined' && typeof VXUI.refreshSidebarDivider === 'function') {
            VXUI.refreshSidebarDivider();
        }
    },
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 滚动加载更多
        this._scrollHandler = VXUI.throttle(() => {
            const content = document.querySelector('.vx-content');
            if (content && !this.isLoading && this.hasMore) {
                const { scrollTop, scrollHeight, clientHeight } = content;
                if (scrollTop + clientHeight >= scrollHeight - 100) {
                    this.loadMore();
                }
            }
        }, 200);
        
        document.querySelector('.vx-content')?.addEventListener('scroll', this._scrollHandler);
    },
    
    /**
     * 解绑事件
     */
    unbindEvents() {
        if (this._scrollHandler) {
            document.querySelector('.vx-content')?.removeEventListener('scroll', this._scrollHandler);
        }
    },
    
    /**
     * 加载数据
     */
    load() {
        this.showLoading();
        this.pageNumber = 0;
        
        if (typeof TL === 'undefined') {
            this.hideLoading();
            this.showEmpty();
            return;
        }
        
        this.fetchData().then(() => {
            this.hideLoading();
            this.render();
        }).catch(error => {
            console.error('[VX_DIRECT] Load error:', error);
            this.hideLoading();
            VXUI.toastError('加载失败');
        });
    },
    
    /**
     * 加载更多
     */
    loadMore() {
        if (this.isLoading || !this.hasMore) return;
        
        this.pageNumber++;
        this.isLoading = true;
        
        this.fetchData(true).then(() => {
            this.isLoading = false;
            this.render();
        }).catch(error => {
            this.isLoading = false;
            this.pageNumber--;
            console.error('[VX_DIRECT] Load more error:', error);
        });
    },
    
    /**
     * 获取数据
     */
    fetchData(append = false) {
        return new Promise((resolve, reject) => {
            $.post(TL.api_direct, {
                action: 'list',
                token: TL.api_token,
                page: this.pageNumber
            }, (rsp) => {
                if (rsp.status === 1) {
                    const newItems = rsp.data || [];
                    if (append) {
                        this.directList = [...this.directList, ...newItems];
                    } else {
                        this.directList = newItems;
                    }
                    this.hasMore = newItems.length >= 20;
                }
                resolve();
            }).fail(reject);
        });
    },
    
    /**
     * 渲染列表
     */
    render() {
        const container = document.getElementById('vx-direct-list');
        if (!container) return;
        
        if (this.directList.length === 0) {
            this.showEmpty();
            return;
        }
        
        let html = '';
        this.directList.forEach(item => {
            html += this.renderItem(item);
        });
        
        container.innerHTML = html;
        
        // 显示内容
        document.getElementById('vx-direct-content')?.classList.remove('vx-hidden');
        document.getElementById('vx-direct-empty')?.classList.add('vx-hidden');
        
        // 更新统计
        this.updateStats();
    },
    
    /**
     * 渲染项目
     */
    renderItem(item) {
        const fileName = item.file_name || '未命名文件';
        const fileSize = VXUI.formatFileSize(item.file_size || 0);
        const createTime = VXUI.formatDate(item.direct_createtime);
        const directUrl = item.direct_url || '';
        const icon = VXUI.getFileIcon(fileName);
        const isSelected = this.selectedItems.has(item.direct_id);
        
        return `
            <div class="vx-file-item ${isSelected ? 'selected' : ''}" 
                data-id="${item.direct_id}">
                <input type="checkbox" class="vx-file-checkbox" 
                    ${isSelected ? 'checked' : ''}
                    onchange="VX_DIRECT.toggleSelect(${item.direct_id})">
                <div class="vx-file-icon">
                    <iconpark-icon name="${icon}"></iconpark-icon>
                </div>
                <div class="vx-file-info">
                    <span class="vx-file-name" title="${fileName}">${fileName}</span>
                    <span class="vx-file-meta">${fileSize} · ${createTime}</span>
                </div>
                <div class="vx-file-actions">
                    <button class="vx-btn-icon" onclick="VX_DIRECT.copyUrl('${directUrl}')" 
                        data-vx-tooltip="复制链接">
                        <iconpark-icon name="copy"></iconpark-icon>
                    </button>
                    <button class="vx-btn-icon" onclick="VX_DIRECT.openUrl('${directUrl}')" 
                        data-vx-tooltip="打开链接">
                        <iconpark-icon name="link"></iconpark-icon>
                    </button>
                    <button class="vx-btn-icon vx-text-danger" onclick="VX_DIRECT.deleteItem(${item.direct_id})" 
                        data-vx-tooltip="删除">
                        <iconpark-icon name="trash"></iconpark-icon>
                    </button>
                </div>
            </div>
        `;
    },
    
    /**
     * 切换选择
     */
    toggleSelect(id) {
        if (this.selectedItems.has(id)) {
            this.selectedItems.delete(id);
        } else {
            this.selectedItems.add(id);
        }
        this.updateSelectionUI();
    },
    
    /**
     * 全选/取消全选
     */
    toggleSelectAll() {
        if (this.selectedItems.size === this.directList.length) {
            this.selectedItems.clear();
        } else {
            this.directList.forEach(item => {
                this.selectedItems.add(item.direct_id);
            });
        }
        this.updateSelectionUI();
    },
    
    /**
     * 更新选择 UI
     */
    updateSelectionUI() {
        // 更新项目选中状态
        document.querySelectorAll('.vx-file-item').forEach(item => {
            const id = parseInt(item.dataset.id);
            const checkbox = item.querySelector('.vx-file-checkbox');
            
            if (this.selectedItems.has(id)) {
                item.classList.add('selected');
                if (checkbox) checkbox.checked = true;
            } else {
                item.classList.remove('selected');
                if (checkbox) checkbox.checked = false;
            }
        });
        
        // 更新批量操作栏
        const batchActions = document.getElementById('vx-direct-batch-actions');
        const selectedCount = document.getElementById('vx-direct-selected-count');
        
        if (this.selectedItems.size > 0) {
            batchActions?.classList.remove('vx-hidden');
            if (selectedCount) {
                selectedCount.textContent = this.selectedItems.size;
            }
        } else {
            batchActions?.classList.add('vx-hidden');
        }
    },
    
    /**
     * 复制链接
     */
    copyUrl(url) {
        VXUI.copyToClipboard(url);
    },
    
    /**
     * 打开链接
     */
    openUrl(url) {
        window.open(url, '_blank');
    },
    
    /**
     * 删除单个
     */
    deleteItem(id) {
        VXUI.confirm({
            title: '删除确认',
            message: '确定要删除这个直链吗？删除后无法恢复。',
            confirmClass: 'vx-btn-danger',
            onConfirm: () => {
                this.doDelete([id]);
            }
        });
    },
    
    /**
     * 删除选中项
     */
    deleteSelected() {
        if (this.selectedItems.size === 0) {
            VXUI.toastWarning('请先选择要删除的项目');
            return;
        }
        
        VXUI.confirm({
            title: '批量删除',
            message: `确定要删除选中的 ${this.selectedItems.size} 个直链吗？`,
            confirmClass: 'vx-btn-danger',
            onConfirm: () => {
                this.doDelete([...this.selectedItems]);
            }
        });
    },
    
    /**
     * 执行删除
     */
    doDelete(ids) {
        if (typeof TL === 'undefined') return;
        
        const promises = ids.map(id => {
            return new Promise((resolve) => {
                $.post(TL.api_direct, {
                    action: 'del',
                    token: TL.api_token,
                    direct_id: id
                }, resolve);
            });
        });
        
        Promise.all(promises).then(() => {
            VXUI.toastSuccess('删除成功');
            this.selectedItems.clear();
            this.load();
        });
    },
    
    /**
     * 复制选中项链接
     */
    copySelectedUrls() {
        if (this.selectedItems.size === 0) {
            VXUI.toastWarning('请先选择项目');
            return;
        }
        
        const urls = [];
        this.directList.forEach(item => {
            if (this.selectedItems.has(item.direct_id)) {
                urls.push(item.direct_url);
            }
        });
        
        VXUI.copyToClipboard(urls.join('\n'));
    },
    
    /**
     * 刷新
     */
    refresh() {
        this.load();
    },
    
    /**
     * 显示帮助
     */
    showHelp() {
        VXUI.confirm({
            title: '什么是直链',
            message: `
                <p>直链是可以直接访问文件的链接，支持多线程下载。</p>
                <p style="margin-top: 12px;">使用场景：</p>
                <ul style="margin-left: 20px; margin-top: 8px;">
                    <li>在网页中嵌入图片或视频</li>
                    <li>使用下载工具多线程下载</li>
                    <li>作为静态资源引用</li>
                </ul>
            `,
            confirmText: '了解了',
            cancelText: ''
        });
    },
    
    // ==================== UI Helpers ====================
    
    /**
     * 显示加载状态
     */
    showLoading() {
        const loading = document.getElementById('vx-direct-loading');
        const content = document.getElementById('vx-direct-content');
        const empty = document.getElementById('vx-direct-empty');
        
        if (loading) loading.classList.remove('vx-hidden');
        if (content) content.classList.add('vx-hidden');
        if (empty) empty.classList.add('vx-hidden');
    },
    
    /**
     * 隐藏加载状态
     */
    hideLoading() {
        const loading = document.getElementById('vx-direct-loading');
        if (loading) loading.classList.add('vx-hidden');
    },
    
    /**
     * 显示空状态
     */
    showEmpty() {
        const content = document.getElementById('vx-direct-content');
        const empty = document.getElementById('vx-direct-empty');
        
        if (content) content.classList.add('vx-hidden');
        if (empty) empty.classList.remove('vx-hidden');
    },
    
    /**
     * 更新统计
     */
    updateStats() {
        const countEl = document.getElementById('vx-direct-count');
        if (countEl) {
            countEl.textContent = this.directList.length;
        }
    }
};

// 注册模块
if (typeof VXUI !== 'undefined') {
    VXUI.registerModule('direct', VX_DIRECT);
}
