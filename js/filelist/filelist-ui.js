/**
 * FileList UI Module
 * 处理 UI 交互：模态框、菜单、通知、加载状态等
 */

const FileListUI = {
    // 当前显示的上下文菜单目标
    contextMenuTarget: null,
    
    // 移动操作的数据
    moveData: {
        files: [],
        folders: [],
        targetMrid: null
    },

    /**
     * 初始化 UI
     */
    init: function() {
        this.bindGlobalEvents();
        this.initContextMenu();
        this.initModals();
    },

    /**
     * 绑定全局事件
     */
    bindGlobalEvents: function() {
        // 点击外部关闭上下文菜单
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('fl-context-menu');
            if (menu && !menu.contains(e.target)) {
                this.hideContextMenu();
            }
        });
        
        // ESC 键关闭菜单和模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideContextMenu();
            }
        });
    },

    /**
     * 初始化上下文菜单
     */
    initContextMenu: function() {
        // 右键菜单已在 HTML 中定义，这里只处理事件
    },

    /**
     * 初始化模态框
     */
    initModals: function() {
        // 模态框已在 HTML 中定义
    },

    // ==================== 通知消息 ====================

    /**
     * 显示成功消息
     */
    showSuccess: function(message) {
        this.showNotification(message, 'success');
    },

    /**
     * 显示错误消息
     */
    showError: function(message) {
        this.showNotification(message, 'danger');
    },

    /**
     * 显示警告消息
     */
    showWarning: function(message) {
        this.showNotification(message, 'warning');
    },

    /**
     * 显示信息消息
     */
    showInfo: function(message) {
        this.showNotification(message, 'info');
    },

    /**
     * 显示通知
     */
    showNotification: function(message, type = 'info') {
        // 优先使用 TL.alert（如果存在）
        if (typeof TL !== 'undefined' && typeof TL.alert === 'function') {
            TL.alert(message, type);
            return;
        }
        
        // 使用 bootstrap-notify（如果存在）
        if (typeof $ !== 'undefined' && $.notify) {
            $.notify({
                message: message
            }, {
                type: type,
                placement: { from: 'top', align: 'center' },
                delay: 3000
            });
            return;
        }
        
        // Fallback: 使用原生 alert
        alert(message);
    },

    // ==================== 加载状态 ====================

    /**
     * 显示加载状态
     */
    showLoading: function() {
        const loading = document.getElementById('fl-loading');
        if (loading) loading.style.display = '';
        
        const listView = document.getElementById('fl-list-view');
        const gridView = document.getElementById('fl-grid-view');
        if (listView) listView.style.display = 'none';
        if (gridView) gridView.style.display = 'none';
    },

    /**
     * 隐藏加载状态
     */
    hideLoading: function() {
        const loading = document.getElementById('fl-loading');
        if (loading) loading.style.display = 'none';
    },

    /**
     * 显示全局加载遮罩
     */
    showGlobalLoading: function() {
        if (typeof TL !== 'undefined' && typeof TL.loading_box_on === 'function') {
            TL.loading_box_on();
        }
    },

    /**
     * 隐藏全局加载遮罩
     */
    hideGlobalLoading: function() {
        if (typeof TL !== 'undefined' && typeof TL.loading_box_off === 'function') {
            TL.loading_box_off();
        }
    },

    // ==================== 上下文菜单 ====================

    /**
     * 显示文件上下文菜单
     */
    showFileMenu: function(event, ukey, file, isOwner) {
        event.preventDefault();
        event.stopPropagation();
        
        this.contextMenuTarget = { type: 'file', id: ukey, data: file };
        
        const lang = this.getLang();
        const menu = document.getElementById('fl-context-menu');
        if (!menu) return;
        
        let html = `
            <div class="fl-menu-item" onclick="FILELIST.openFile('${ukey}')">
                <iconpark-icon name="eye"></iconpark-icon>
                <span>${lang.menu_preview || '查看'}</span>
            </div>
            <div class="fl-menu-item" onclick="FileListActions.downloadFile('${ukey}')">
                <iconpark-icon name="cloud-arrow-down"></iconpark-icon>
                <span>${lang.on_select_download || '下载'}</span>
            </div>
            <div class="fl-menu-item" onclick="FileListActions.shareFile('${ukey}', '${this.escapeAttr(file?.fname)}')">
                <iconpark-icon name="share-from-square"></iconpark-icon>
                <span>${lang.model_copy || '复制链接'}</span>
            </div>
        `;
        
        if (isOwner) {
            html += `
                <div class="fl-menu-divider"></div>
                <div class="fl-menu-item" onclick="FILELIST.renameFile('${ukey}')">
                    <iconpark-icon name="pen-to-square"></iconpark-icon>
                    <span>${lang.menu_rename || '重命名'}</span>
                </div>
                <div class="fl-menu-item" onclick="FileListUI.showMoveModal(['${ukey}'], [])">
                    <iconpark-icon name="folder-plus"></iconpark-icon>
                    <span>${lang.on_select_move || '移动'}</span>
                </div>
                <div class="fl-menu-item" onclick="FILELIST.changeFileModel('${ukey}')">
                    <iconpark-icon name="clock"></iconpark-icon>
                    <span>${lang.on_select_change_model || '修改时效'}</span>
                </div>
                <div class="fl-menu-divider"></div>
                <div class="fl-menu-item danger" onclick="FileListActions.deleteFile('${ukey}').then(() => FILELIST.refresh())">
                    <iconpark-icon name="trash"></iconpark-icon>
                    <span>${lang.menu_delete || '删除'}</span>
                </div>
            `;
        }
        
        menu.innerHTML = html;
        this.positionMenu(menu, event);
        menu.classList.add('active');
    },

    /**
     * 显示文件夹上下文菜单
     */
    showFolderMenu: function(event, mrid, folder, isOwner) {
        event.preventDefault();
        event.stopPropagation();
        
        this.contextMenuTarget = { type: 'folder', id: mrid, data: folder };
        
        const lang = this.getLang();
        const menu = document.getElementById('fl-context-menu');
        if (!menu) return;
        
        let html = `
            <div class="fl-menu-item" onclick="FILELIST.openFolder('${mrid}')">
                <iconpark-icon name="folder-open"></iconpark-icon>
                <span>${lang.menu_open || '打开'}</span>
            </div>
        `;
        
        if (folder?.model === 'public' || folder?.publish === 'yes') {
            html += `
                <div class="fl-menu-item" onclick="FileListActions.shareFolder('${mrid}', '${this.escapeAttr(folder?.name)}')">
                    <iconpark-icon name="share-from-square"></iconpark-icon>
                    <span>${lang.model_copy || '复制链接'}</span>
                </div>
            `;
        }
        
        if (isOwner) {
            html += `
                <div class="fl-menu-divider"></div>
                <div class="fl-menu-item" onclick="FILELIST.renameFolder('${mrid}')">
                    <iconpark-icon name="pen-to-square"></iconpark-icon>
                    <span>${lang.menu_rename || '重命名'}</span>
                </div>
                <div class="fl-menu-item" onclick="FileListUI.showMoveModal([], ['${mrid}'])">
                    <iconpark-icon name="folder-plus"></iconpark-icon>
                    <span>${lang.on_select_move || '移动'}</span>
                </div>
                <div class="fl-menu-item" onclick="FILELIST.openFolderSettings('${mrid}')">
                    <iconpark-icon name="gear"></iconpark-icon>
                    <span>${lang.btn_performance || '设置'}</span>
                </div>
                <div class="fl-menu-divider"></div>
                <div class="fl-menu-item danger" onclick="FileListActions.deleteFolder('${mrid}').then(() => FILELIST.refresh())">
                    <iconpark-icon name="trash"></iconpark-icon>
                    <span>${lang.menu_delete || '删除'}</span>
                </div>
            `;
        }
        
        menu.innerHTML = html;
        this.positionMenu(menu, event);
        menu.classList.add('active');
    },

    /**
     * 隐藏上下文菜单
     */
    hideContextMenu: function() {
        const menu = document.getElementById('fl-context-menu');
        if (menu) {
            menu.classList.remove('active');
        }
        this.contextMenuTarget = null;
    },

    /**
     * 定位菜单
     */
    positionMenu: function(menu, event) {
        const x = event.clientX || event.pageX;
        const y = event.clientY || event.pageY;
        
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        
        // 确保菜单不超出屏幕
        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            
            if (rect.right > window.innerWidth) {
                menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
            }
            
            if (rect.bottom > window.innerHeight) {
                menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
            }
        });
    },

    // ==================== 模态框 ====================

    /**
     * 显示移动模态框
     */
    showMoveModal: function(files, folders) {
        this.moveData.files = files || [];
        this.moveData.folders = folders || [];
        this.moveData.targetMrid = null;
        
        const modal = document.getElementById('fl-move-modal');
        if (modal) {
            // 使用 Bootstrap modal
            if (typeof $ !== 'undefined' && $.fn.modal) {
                $(modal).modal('show');
            } else {
                modal.style.display = 'block';
                modal.classList.add('show');
            }
            
            // 加载文件夹树
            this.loadFolderTree(0);
        }
    },

    /**
     * 隐藏移动模态框
     */
    hideMoveModal: function() {
        const modal = document.getElementById('fl-move-modal');
        if (modal) {
            if (typeof $ !== 'undefined' && $.fn.modal) {
                $(modal).modal('hide');
            } else {
                modal.style.display = 'none';
                modal.classList.remove('show');
            }
        }
    },

    /**
     * 加载文件夹树
     */
    loadFolderTree: async function(parentId) {
        const container = document.getElementById('fl-folder-tree');
        if (!container) return;
        
        try {
            const result = await FileListAPI.getSubFolders(parentId);
            if (result.status === 0 && result.data) {
                this.renderFolderTree(container, result.data, parentId);
            }
        } catch (error) {
            console.error('Load folder tree error:', error);
        }
    },

    /**
     * 渲染文件夹树
     */
    renderFolderTree: function(container, folders, parentId) {
        const lang = this.getLang();
        let html = '';
        
        // 根目录选项
        if (parentId === 0) {
            const isExcluded = this.moveData.folders.includes('0');
            html += `
                <div class="fl-tree-item ${this.moveData.targetMrid === '0' ? 'selected' : ''} ${isExcluded ? 'disabled' : ''}" 
                     data-mrid="0" onclick="FileListUI.selectMoveTarget('0')">
                    <iconpark-icon name="desktop"></iconpark-icon>
                    <span>${lang.navbar_meetingroom || '桌面'}</span>
                </div>
            `;
        }
        
        folders.forEach(folder => {
            const isExcluded = this.moveData.folders.includes(String(folder.mr_id));
            html += `
                <div class="fl-tree-item ${this.moveData.targetMrid === String(folder.mr_id) ? 'selected' : ''} ${isExcluded ? 'disabled' : ''}" 
                     data-mrid="${folder.mr_id}" onclick="FileListUI.selectMoveTarget('${folder.mr_id}')">
                    <iconpark-icon name="folder"></iconpark-icon>
                    <span>${this.escapeHtml(folder.name)}</span>
                </div>
            `;
        });
        
        container.innerHTML = html;
    },

    /**
     * 选择移动目标
     */
    selectMoveTarget: function(mrid) {
        // 检查是否是被排除的文件夹
        if (this.moveData.folders.includes(mrid)) {
            return;
        }
        
        this.moveData.targetMrid = mrid;
        
        // 更新选中状态
        document.querySelectorAll('.fl-tree-item').forEach(el => {
            el.classList.toggle('selected', el.dataset.mrid === mrid);
        });
    },

    /**
     * 确认移动
     */
    confirmMove: async function() {
        if (!this.moveData.targetMrid) {
            this.showWarning('请选择目标文件夹');
            return;
        }
        
        const success = await FileListActions.doMove(this.moveData.targetMrid);
        if (success) {
            this.hideMoveModal();
            if (typeof FILELIST !== 'undefined') {
                FILELIST.refresh();
            }
        }
    },

    /**
     * 显示创建文件夹模态框
     */
    showCreateFolderModal: function(parentId) {
        const modal = document.getElementById('fl-create-folder-modal');
        if (modal) {
            // 清空输入
            $('#fl-create-folder-name').val('');
            $('#fl-create-folder-type').val('private');
            
            this.showModal(modal);
        }
    },

    /**
     * 确认创建文件夹
     */
    confirmCreateFolder: async function() {
        const name = $('#fl-create-folder-name').val().trim();
        const type = $('#fl-create-folder-type').val();
        
        if (!name) {
            this.showWarning('请输入文件夹名称');
            return;
        }
        
        const success = await FILELIST.createFolder(name, type);
        if (success) {
            this.hideModal('fl-create-folder-modal');
        }
    },

    /**
     * 显示排序模态框
     */
    showSortModal: function() {
        const modal = document.getElementById('fl-sort-modal');
        if (modal) {
            // 设置当前排序
            $('#fl-sort-by').val(FILELIST.sortBy || 'time');
            $('#fl-sort-type').val(FILELIST.sortType || 'desc');
            
            this.showModal(modal);
        }
    },

    /**
     * 确认排序
     */
    confirmSort: function() {
        const sortBy = $('#fl-sort-by').val();
        const sortType = $('#fl-sort-type').val();
        
        FILELIST.setSort(sortBy, sortType);
        this.hideModal('fl-sort-modal');
    },

    /**
     * 显示文件夹设置模态框
     */
    showSettingsModal: function() {
        const modal = document.getElementById('fl-settings-modal');
        if (modal && FILELIST.room) {
            const room = FILELIST.room;
            
            // 填充当前设置
            $('#fl-pf-sort-by').val(room.sort_by || '0');
            $('#fl-pf-sort-type').val(room.sort_type || '0');
            $('#fl-pf-publish').prop('checked', room.publish === 1 || room.publish === true);
            $('#fl-pf-allow-upload').prop('checked', room.allow_upload === 1 || room.allow_upload === true);
            $('#fl-pf-allow-direct').prop('checked', room.allow_direct === 1 || room.allow_direct === true);
            
            this.showModal(modal);
        }
    },

    /**
     * 确认保存设置
     */
    confirmSettings: async function() {
        if (!FILELIST.room || !FILELIST.mrid) return;
        
        const settings = {
            mrid: FILELIST.mrid,
            sort_by: $('#fl-pf-sort-by').val(),
            sort_type: $('#fl-pf-sort-type').val(),
            publish: $('#fl-pf-publish').is(':checked') ? 1 : 0,
            allow_upload: $('#fl-pf-allow-upload').is(':checked') ? 1 : 0
        };
        
        try {
            const result = await FileListAPI.updateFolderSettings(settings);
            if (result.status === 0) {
                this.showSuccess('设置已保存');
                Object.assign(FILELIST.room, settings);
                this.hideModal('fl-settings-modal');
            } else {
                this.showError(result.message || '保存失败');
            }
        } catch (error) {
            console.error('Save settings error:', error);
            this.showError('保存失败');
        }
    },

    /**
     * 显示修改有效期模态框
     */
    showExpiryModal: function() {
        const modal = document.getElementById('fl-expiry-modal');
        if (modal) {
            $('#fl-expiry-select').val('30');
            this.showModal(modal);
        }
    },

    /**
     * 确认修改有效期
     */
    confirmExpiry: async function() {
        const model = $('#fl-expiry-select').val();
        const success = await FileListActions.changeExpiry(model);
        if (success) {
            this.hideModal('fl-expiry-modal');
        }
    },

    /**
     * 显示重命名模态框
     */
    showRenameModal: function(type, id, currentName) {
        const modal = document.getElementById('fl-rename-modal');
        if (modal) {
            $('#fl-rename-input').val(currentName || '');
            $('#fl-rename-type').val(type);
            $('#fl-rename-id').val(id);
            
            this.showModal(modal);
            
            // 聚焦输入框
            setTimeout(() => $('#fl-rename-input').focus().select(), 100);
        }
    },

    /**
     * 确认重命名
     */
    confirmRename: async function() {
        const type = $('#fl-rename-type').val();
        const id = $('#fl-rename-id').val();
        const newName = $('#fl-rename-input').val().trim();
        
        if (!newName) {
            this.showWarning('请输入新名称');
            return;
        }
        
        let success = false;
        if (type === 'folder') {
            success = await FileListActions.renameFolder(id, newName);
        } else {
            success = await FileListActions.renameFile(id, newName);
        }
        
        if (success) {
            this.hideModal('fl-rename-modal');
            FILELIST.refresh();
        }
    },

    /**
     * 通用显示 modal
     */
    showModal: function(modal) {
        if (typeof $ !== 'undefined' && $.fn.modal) {
            $(modal).modal('show');
        } else {
            modal.style.display = 'block';
            modal.classList.add('show');
        }
    },

    /**
     * 通用隐藏 modal
     */
    hideModal: function(modalId) {
        const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
        if (modal) {
            if (typeof $ !== 'undefined' && $.fn.modal) {
                $(modal).modal('hide');
            } else {
                modal.style.display = 'none';
                modal.classList.remove('show');
            }
        }
    },

    // ==================== 工具方法 ====================

    /**
     * 获取语言数据
     */
    getLang: function() {
        return (typeof app !== 'undefined' && app.languageData) ? app.languageData : {};
    },

    /**
     * HTML 转义
     */
    escapeHtml: function(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * 属性值转义
     */
    escapeAttr: function(text) {
        if (!text) return '';
        return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
    },

    /**
     * 更新权限相关的 UI
     */
    updatePermissionUI: function(isOwner, isDesktop, roomModel) {
        // 所有者才能看到的元素
        document.querySelectorAll('.fl-owner-only').forEach(el => {
            el.style.display = isOwner ? '' : 'none';
        });
        
        // 非根目录才显示的元素
        document.querySelectorAll('.fl-not-desktop').forEach(el => {
            el.style.display = !isDesktop ? '' : 'none';
        });
        
        // 公开文件夹才显示的元素
        document.querySelectorAll('.fl-public-only').forEach(el => {
            el.style.display = roomModel === 'public' ? '' : 'none';
        });
    },

    /**
     * 更新文件夹信息显示
     */
    updateFolderInfo: function(room, fileCount, totalSize) {
        const nameEl = document.getElementById('fl-folder-name');
        const mobileNameEl = document.getElementById('fl-mobile-title');
        const statsEl = document.getElementById('fl-folder-stats');
        const fileCountEl = document.getElementById('fl-file-count');
        const totalSizeEl = document.getElementById('fl-total-size');
        
        const lang = this.getLang();
        const displayName = room.top === 99 ? (lang.navbar_meetingroom || '桌面') : room.name;
        
        if (nameEl) nameEl.textContent = displayName;
        if (mobileNameEl) mobileNameEl.textContent = displayName;
        
        if (statsEl && fileCount !== undefined) {
            statsEl.style.display = '';
            if (fileCountEl) fileCountEl.textContent = fileCount;
            if (totalSizeEl) totalSizeEl.textContent = totalSize || '0';
        }
    },

    /**
     * 切换侧边栏（移动端）
     */
    toggleSidebar: function() {
        const sidebar = document.querySelector('.fl-sidebar');
        if (sidebar) {
            sidebar.classList.toggle('active');
        }
    }
};

// 导出模块
if (typeof window !== 'undefined') {
    window.FileListUI = FileListUI;
}
