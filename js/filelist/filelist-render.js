/**
 * FileList Render Module
 * 负责文件列表的渲染（列表视图、网格视图）
 */

const FileListRender = {
    // 视图模式
    viewMode: 'list', // 'list' | 'grid'
    
    // 容器元素
    listContainer: null,
    gridContainer: null,

    /**
     * 初始化渲染器
     */
    init: function() {
        this.listContainer = document.getElementById('fl-file-list');
        this.gridContainer = document.getElementById('fl-grid-list');
        
        // 从 localStorage 读取视图模式
        this.viewMode = localStorage.getItem('filelist_view_mode') || 'list';
        this.applyViewMode();
    },

    /**
     * 设置视图模式
     */
    setViewMode: function(mode) {
        this.viewMode = mode;
        localStorage.setItem('filelist_view_mode', mode);
        this.applyViewMode();
    },

    /**
     * 应用视图模式
     */
    applyViewMode: function() {
        const listView = document.getElementById('fl-list-view');
        const gridView = document.getElementById('fl-grid-view');
        const listBtn = document.getElementById('fl-view-list');
        const gridBtn = document.getElementById('fl-view-grid');
        
        if (this.viewMode === 'grid') {
            if (listView) listView.style.display = 'none';
            if (gridView) gridView.style.display = '';
            if (listBtn) listBtn.classList.remove('active');
            if (gridBtn) gridBtn.classList.add('active');
        } else {
            if (listView) listView.style.display = '';
            if (gridView) gridView.style.display = 'none';
            if (listBtn) listBtn.classList.add('active');
            if (gridBtn) gridBtn.classList.remove('active');
        }
    },

    /**
     * 清空列表
     */
    clear: function() {
        if (this.listContainer) this.listContainer.innerHTML = '';
        if (this.gridContainer) this.gridContainer.innerHTML = '';
    },

    /**
     * 渲染文件夹列表
     */
    renderFolders: function(folders, isOwner) {
        if (!folders || folders.length === 0) return;
        
        folders.forEach(folder => {
            if (this.listContainer) {
                this.listContainer.insertAdjacentHTML('beforeend', this.renderFolderRow(folder, isOwner));
            }
            if (this.gridContainer) {
                this.gridContainer.insertAdjacentHTML('beforeend', this.renderFolderGrid(folder, isOwner));
            }
        });
    },

    /**
     * 渲染文件列表
     */
    renderFiles: function(files, isOwner, roomModel) {
        if (!files || files.length === 0) return;
        
        files.forEach(file => {
            if (this.listContainer) {
                this.listContainer.insertAdjacentHTML('beforeend', this.renderFileRow(file, isOwner, roomModel));
            }
            if (this.gridContainer) {
                this.gridContainer.insertAdjacentHTML('beforeend', this.renderFileGrid(file, isOwner, roomModel));
            }
        });
        
        // 设置倒计时
        this.setupCountdowns();
    },

    /**
     * 渲染文件夹行（列表视图）
     */
    renderFolderRow: function(folder, isOwner) {
        const icon = this.getFolderIcon(folder);
        const escapedName = this.escapeHtml(folder.name);
        const lang = this.getLang();
        
        return `
            <div class="fl-file-row folder fl-animate-in" 
                 data-fl-type="folder" data-fl-id="${folder.mr_id}"
                 onclick="FILELIST.onItemClick(event, this)">
                <div class="fl-checkbox" onclick="event.stopPropagation(); FileListSelect.toggle(this.parentNode, event)">
                    <iconpark-icon name="check"></iconpark-icon>
                </div>
                <div class="fl-file-name">
                    <div class="fl-file-icon folder">
                        <iconpark-icon name="${icon}"></iconpark-icon>
                    </div>
                    <div class="fl-file-name-text">
                        <div class="fl-file-title">${escapedName}</div>
                        <div class="fl-file-subtitle">${lang.filelist_dir || '文件夹'}</div>
                    </div>
                </div>
                <div class="fl-file-size">--</div>
                <div class="fl-file-date">--</div>
                <div class="fl-file-actions">
                    ${isOwner ? `
                        <button class="fl-file-action" onclick="event.stopPropagation(); FILELIST.renameFolder('${folder.mr_id}')" title="${lang.menu_rename || '重命名'}">
                            <iconpark-icon name="pen-to-square"></iconpark-icon>
                        </button>
                        <button class="fl-file-action danger" onclick="event.stopPropagation(); FILELIST.deleteFolder('${folder.mr_id}')" title="${lang.menu_delete || '删除'}">
                            <iconpark-icon name="trash"></iconpark-icon>
                        </button>
                    ` : ''}
                    ${folder.model === 'public' || folder.publish === 'yes' ? `
                        <button class="fl-file-action" onclick="event.stopPropagation(); FILELIST.shareFolder('${folder.mr_id}')" title="${lang.model_copy || '复制链接'}">
                            <iconpark-icon name="share-from-square"></iconpark-icon>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    },

    /**
     * 渲染文件夹（网格视图）
     */
    renderFolderGrid: function(folder, isOwner) {
        const icon = this.getFolderIcon(folder);
        const escapedName = this.escapeHtml(folder.name);
        const lang = this.getLang();
        
        return `
            <div class="fl-grid-item" 
                 data-fl-type="folder" data-fl-id="${folder.mr_id}"
                 onclick="FILELIST.onItemClick(event, this)">
                <div class="fl-grid-item-checkbox">
                    <div class="fl-checkbox" onclick="event.stopPropagation(); FileListSelect.toggle(this.parentNode.parentNode, event)">
                        <iconpark-icon name="check"></iconpark-icon>
                    </div>
                </div>
                <div class="fl-grid-icon folder">
                    <iconpark-icon name="${icon}"></iconpark-icon>
                </div>
                <div class="fl-grid-name">${escapedName}</div>
                <div class="fl-grid-meta">${lang.filelist_dir || '文件夹'}</div>
            </div>
        `;
    },

    /**
     * 渲染文件行（列表视图）
     */
    renderFileRow: function(file, isOwner, roomModel) {
        const iconName = this.getFileIcon(file.ftype);
        const iconClass = this.getFileIconClass(file.ftype);
        const size = file.fsize_formated || this.formatSize(file.fsize);
        const date = file.cctime || '';
        const escapedName = this.escapeHtml(file.fname);
        const lang = this.getLang();
        
        return `
            <div class="fl-file-row fl-animate-in" 
                 data-fl-type="file" data-fl-id="${file.ukey}"
                 onclick="FILELIST.onItemClick(event, this)">
                <div class="fl-checkbox" onclick="event.stopPropagation(); FileListSelect.toggle(this.parentNode, event)">
                    <iconpark-icon name="check"></iconpark-icon>
                </div>
                <div class="fl-file-name">
                    <div class="fl-file-icon ${iconClass}">
                        <iconpark-icon name="${iconName}"></iconpark-icon>
                    </div>
                    <div class="fl-file-name-text">
                        <div class="fl-file-title">${escapedName}</div>
                        <div class="fl-file-subtitle">
                            ${file.model !== 99 ? `<span class="fl-countdown" data-lefttime="${file.lefttime}" id="fl-r-${file.ukey}"></span>` : ''}
                            ${file.like > 0 ? `<iconpark-icon name="like" style="color: #ec4899; margin-left: 8px;"></iconpark-icon> ${file.like}` : ''}
                        </div>
                    </div>
                </div>
                <div class="fl-file-size">${size}</div>
                <div class="fl-file-date">${date}</div>
                <div class="fl-file-actions">
                    <button class="fl-file-action" onclick="event.stopPropagation(); FILELIST.downloadFile('${file.ukey}')" title="${lang.on_select_download || '下载'}">
                        <iconpark-icon name="cloud-arrow-down"></iconpark-icon>
                    </button>
                    ${roomModel === 'public' ? `
                        <button class="fl-file-action" onclick="event.stopPropagation(); FILELIST.shareFile('${file.ukey}')" title="${lang.model_copy || '复制链接'}">
                            <iconpark-icon name="share-from-square"></iconpark-icon>
                        </button>
                    ` : ''}
                    ${isOwner ? `
                        <button class="fl-file-action" onclick="event.stopPropagation(); FILELIST.showFileMenu(event, '${file.ukey}')" title="${lang.more || '更多'}">
                            <iconpark-icon name="ellipsis"></iconpark-icon>
                        </button>
                    ` : ''}
                </div>
                <div class="fl-download-progress" style="display: none;">
                    <div class="fl-download-progress-bar" id="fl-progress-${file.ukey}"></div>
                </div>
            </div>
        `;
    },

    /**
     * 渲染文件（网格视图）
     */
    renderFileGrid: function(file, isOwner, roomModel) {
        const iconName = this.getFileIcon(file.ftype);
        const iconClass = this.getFileIconClass(file.ftype);
        const size = file.fsize_formated || this.formatSize(file.fsize);
        const escapedName = this.escapeHtml(file.fname);
        
        return `
            <div class="fl-grid-item" 
                 data-fl-type="file" data-fl-id="${file.ukey}"
                 onclick="FILELIST.onItemClick(event, this)">
                <div class="fl-grid-item-checkbox">
                    <div class="fl-checkbox" onclick="event.stopPropagation(); FileListSelect.toggle(this.parentNode.parentNode, event)">
                        <iconpark-icon name="check"></iconpark-icon>
                    </div>
                </div>
                <div class="fl-grid-icon ${iconClass}">
                    <iconpark-icon name="${iconName}"></iconpark-icon>
                </div>
                <div class="fl-grid-name">${escapedName}</div>
                <div class="fl-grid-meta">${size}</div>
            </div>
        `;
    },

    /**
     * 渲染面包屑
     */
    renderBreadcrumb: function(path, currentName) {
        const container = document.getElementById('fl-breadcrumb');
        if (!container) return;
        
        const lang = this.getLang();
        let html = `<a href="javascript:;" class="fl-breadcrumb-item" onclick="FILELIST.navigateTo(0)">${lang.navbar_meetingroom || '桌面'}</a>`;
        
        if (path && path.length > 0) {
            path.forEach(item => {
                html += `<span class="fl-breadcrumb-separator">/</span>`;
                html += `<a href="javascript:;" class="fl-breadcrumb-item" onclick="FILELIST.navigateTo('${item.mr_id}')">${this.escapeHtml(item.name)}</a>`;
            });
        }
        
        if (currentName) {
            html += `<span class="fl-breadcrumb-separator">/</span>`;
            html += `<span class="fl-breadcrumb-item current">${this.escapeHtml(currentName)}</span>`;
        }
        
        container.innerHTML = html;
    },

    /**
     * 渲染空状态
     */
    renderEmpty: function(show) {
        const emptyEl = document.getElementById('fl-empty');
        if (emptyEl) {
            emptyEl.style.display = show ? '' : 'none';
        }
    },

    /**
     * 设置倒计时
     */
    setupCountdowns: function() {
        document.querySelectorAll('.fl-countdown').forEach(el => {
            const id = el.id;
            const time = el.dataset.lefttime;
            if (id && time && typeof countDown === 'function') {
                const lang = typeof TL !== 'undefined' ? TL.currentLanguage : 'cn';
                countDown(id, time, lang);
            }
        });
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
     * 格式化文件大小
     */
    formatSize: function(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * 获取文件夹图标
     */
    getFolderIcon: function(folder) {
        if (folder.model === 'public' || folder.publish === 'yes') {
            return 'folder-open';
        }
        if (folder.direct === 'yes') {
            return 'folder-open';
        }
        return 'folder';
    },

    /**
     * 获取文件图标
     */
    getFileIcon: function(ftype) {
        if (!ftype) return 'file';
        
        const type = ftype.toLowerCase();
        const iconMap = {
            // 图片
            'jpg': 'file-image', 'jpeg': 'file-image', 'png': 'file-image', 
            'gif': 'file-image', 'webp': 'file-image', 'bmp': 'file-image', 'svg': 'file-image',
            // 视频
            'mp4': 'file-video', 'avi': 'file-video', 'mkv': 'file-video', 
            'mov': 'file-video', 'wmv': 'file-video', 'flv': 'file-video', 'webm': 'file-video',
            // 音频
            'mp3': 'file-audio', 'wav': 'file-audio', 'flac': 'file-audio', 
            'aac': 'file-audio', 'ogg': 'file-audio', 'm4a': 'file-audio',
            // 文档
            'pdf': 'file-pdf', 'doc': 'file-word', 'docx': 'file-word',
            'xls': 'file-excel', 'xlsx': 'file-excel', 'ppt': 'file-powerpoint', 'pptx': 'file-powerpoint',
            'txt': 'file-text', 'md': 'file-text',
            // 压缩
            'zip': 'file-zipper', 'rar': 'file-zipper', '7z': 'file-zipper', 
            'tar': 'file-zipper', 'gz': 'file-zipper',
            // 代码
            'js': 'file-code', 'ts': 'file-code', 'py': 'file-code', 
            'java': 'file-code', 'c': 'file-code', 'cpp': 'file-code', 'h': 'file-code',
            'html': 'file-code', 'css': 'file-code', 'json': 'file-code'
        };
        
        return iconMap[type] || 'file';
    },

    /**
     * 获取文件图标 CSS 类
     */
    getFileIconClass: function(ftype) {
        if (!ftype) return '';
        const type = ftype.toLowerCase();
        
        const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'];
        const videoTypes = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'];
        const audioTypes = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
        const docTypes = ['doc', 'docx', 'pdf', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx'];
        const archiveTypes = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];
        
        if (imageTypes.includes(type)) return 'image';
        if (videoTypes.includes(type)) return 'video';
        if (audioTypes.includes(type)) return 'audio';
        if (docTypes.includes(type)) return 'document';
        if (archiveTypes.includes(type)) return 'archive';
        
        return '';
    }
};

// 导出模块
if (typeof window !== 'undefined') {
    window.FileListRender = FileListRender;
}
