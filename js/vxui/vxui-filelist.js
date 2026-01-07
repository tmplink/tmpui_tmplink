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
    
    // 图片扩展名
    imageExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'],
    
    // 下载器
    downloader: null,
    
    /**
     * 初始化模块
     */
    init(params = {}) {
        console.log('[VX_FILELIST] Initializing...', params);
        
        // 检查登录状态
        if (typeof TL !== 'undefined' && !TL.isLogin()) {
            VXUI.navigate('login');
            return;
        }
        
        // 获取 mrid 参数
        this.mrid = params.mrid || this.getUrlMrid() || 0;
        
        // 获取视图模式参数或从存储恢复
        this.viewMode = params.view || localStorage.getItem('vx_view_mode') || 'list';
        this.gridSize = localStorage.getItem('vx_album_grid_size') || 'normal';
        
        // 重置状态
        this.selectedItems = [];
        this.selectMode = false;
        this.photoList = [];
        this.lightboxOpen = false;
        
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
        
        // 构建语言
        if (typeof app !== 'undefined') {
            app.languageBuild();
        }
    },
    
    /**
     * 更新侧边栏内容
     */
    updateSidebar() {
        const tpl = document.getElementById('vx-filelist-sidebar-tpl');
        const container = document.getElementById('vx-sidebar-dynamic');
        const staticNav = document.getElementById('vx-sidebar-static');
        
        if (!tpl || !container) return;
        
        // 隐藏静态导航
        if (staticNav) {
            staticNav.style.display = 'none';
        }
        
        // 克隆模板内容
        const content = tpl.content.cloneNode(true);
        container.innerHTML = '';
        container.appendChild(content);
        
        // 更新标题
        const title = this.room.name || '桌面';
        const sidebarTitle = document.getElementById('vx-fl-sidebar-title');
        if (sidebarTitle) {
            sidebarTitle.textContent = title;
        }
        
        // 更新相册视图控制显示
        this.updateAlbumViewControls();
    },
    
    /**
     * 更新相册视图控制区域显示
     */
    updateAlbumViewControls() {
        const albumViewSection = document.getElementById('vx-fl-album-view-section');
        const albumControls = document.getElementById('vx-fl-album-controls');
        
        if (albumViewSection) {
            albumViewSection.style.display = this.viewMode === 'album' ? '' : 'none';
        }
        if (albumControls) {
            albumControls.style.display = this.viewMode === 'album' ? '' : 'none';
        }
        
        // 更新视图切换按钮状态
        const listBtn = document.getElementById('vx-fl-view-list');
        const albumBtn = document.getElementById('vx-fl-view-album');
        
        if (listBtn) listBtn.classList.toggle('active', this.viewMode === 'list');
        if (albumBtn) albumBtn.classList.toggle('active', this.viewMode === 'album');
    },
    
    /**
     * 销毁模块 - 恢复侧边栏
     */
    destroy() {
        this.unbindEvents();
        this.hideContextMenu();
        this.closeLightbox();
        
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
     * 绑定事件
     */
    bindEvents() {
        // 右键菜单
        document.addEventListener('contextmenu', this._onContextMenu = (e) => {
            const row = e.target.closest('.vx-list-row');
            if (row) {
                e.preventDefault();
                this.showContextMenu(e.pageX, e.pageY, row);
            }
        });
        
        // 点击隐藏右键菜单
        document.addEventListener('click', this._onDocClick = () => {
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
    },
    
    /**
     * 解绑事件
     */
    unbindEvents() {
        if (this._onContextMenu) {
            document.removeEventListener('contextmenu', this._onContextMenu);
        }
        if (this._onDocClick) {
            document.removeEventListener('click', this._onDocClick);
        }
        if (this._onKeydown) {
            document.removeEventListener('keydown', this._onKeydown);
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
     * 设置视图模式
     */
    setViewMode(mode) {
        if (this.viewMode === mode) return;
        
        this.viewMode = mode;
        localStorage.setItem('vx_view_mode', mode);
        
        // 应用视图模式
        this.applyViewMode();
        
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
    loadRoom() {
        const token = this.getToken();
        
        if (!token) {
            console.warn('[VX_FILELIST] No token available');
            this.hideLoading();
            this.showEmpty();
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
                VXUI.toastError('文件夹不存在');
                return;
            }
            
            if (rsp.status === 3) {
                VXUI.navigate('login');
                return;
            }
            
            // 保存文件夹信息
            this.room = rsp.data;
            this.isOwner = rsp.data.owner === 1;
            this.isDesktop = (rsp.data.top == 99);
            this.subRooms = rsp.data.sub_rooms || [];
            
            // 特殊处理桌面
            if (this.mrid == 0 || this.mrid === '0') {
                this.isDesktop = true;
                this.room.name = (typeof app !== 'undefined' && app.languageData && app.languageData.navbar_meetingroom) 
                    ? app.languageData.navbar_meetingroom : '桌面';
            }
            
            // 更新 UI
            this.updateRoomUI();
            
            // 加载文件列表
            this.loadFileList(0);
            
        }, 'json').fail(() => {
            this.hideLoading();
            VXUI.toastError('加载失败');
        });
    },
    
    /**
     * 更新文件夹 UI
     */
    updateRoomUI() {
        // 标题
        const title = this.room.name || '桌面';
        
        const titleEl = document.getElementById('vx-fl-title');
        if (titleEl) titleEl.textContent = title;
        
        const sidebarTitle = document.getElementById('vx-fl-sidebar-title');
        if (sidebarTitle) sidebarTitle.textContent = title;
        
        document.title = title;
        
        // 更新面包屑
        this.updateBreadcrumb();
        
        // 显示/隐藏返回按钮
        const backBtn = document.getElementById('vx-fl-back-btn');
        if (backBtn) {
            backBtn.style.display = this.mrid != 0 ? '' : 'none';
        }
        
        // 更新分享按钮显示（桌面隐藏）
        const shareBtn = document.getElementById('vx-fl-share-btn');
        if (shareBtn) {
            shareBtn.style.display = this.isDesktop ? 'none' : '';
        }
    },
    
    /**
     * 更新面包屑
     */
    updateBreadcrumb() {
        const container = document.getElementById('vx-fl-breadcrumb');
        if (!container) return;
        
        let html = '<a href="javascript:;" onclick="VX_FILELIST.openFolder(0)">桌面</a>';
        
        if (this.mrid != 0 && this.room.name) {
            html += '<span class="vx-breadcrumb-sep">›</span>';
            html += `<a href="javascript:;">${this.escapeHtml(this.room.name)}</a>`;
        }
        
        container.innerHTML = html;
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
     * 创建文件夹行
     */
    createFolderRow(folder) {
        const row = document.createElement('div');
        row.className = 'vx-list-row';
        row.dataset.type = 'folder';
        row.dataset.mrid = folder.mr_id;
        
        const iconInfo = this.getFolderIcon(folder);
        
        row.innerHTML = `
            <div class="vx-list-checkbox" onclick="event.stopPropagation(); VX_FILELIST.toggleItemSelect(this.parentNode)"></div>
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
                ${this.isOwner ? `
                    <button class="vx-list-action-btn" onclick="event.stopPropagation(); VX_FILELIST.renameFolder('${folder.mr_id}')" title="重命名">
                        <iconpark-icon name="pen-to-square"></iconpark-icon>
                    </button>
                    <button class="vx-list-action-btn vx-action-danger" onclick="event.stopPropagation(); VX_FILELIST.deleteFolder('${folder.mr_id}')" title="删除">
                        <iconpark-icon name="trash"></iconpark-icon>
                    </button>
                ` : ''}
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
        
        row.innerHTML = `
            <div class="vx-list-checkbox" onclick="event.stopPropagation(); VX_FILELIST.toggleItemSelect(this.parentNode)"></div>
            <div class="vx-list-name">
                <div class="vx-list-icon ${iconInfo.class}">
                    <iconpark-icon name="${iconInfo.icon}"></iconpark-icon>
                </div>
                <div class="vx-list-filename">
                    <a href="javascript:;" onclick="event.stopPropagation(); VX_FILELIST.previewFile('${file.ukey}')">${this.escapeHtml(file.fname)}</a>
                    ${file.hot > 0 ? '<iconpark-icon name="fire" class="vx-hot-badge"></iconpark-icon>' : ''}
                    ${file.like > 0 ? `<span class="vx-like-badge"><iconpark-icon name="like"></iconpark-icon>${file.like}</span>` : ''}
                    ${file.lefttime > 0 ? `
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
                <button class="vx-list-action-btn" onclick="event.stopPropagation(); VX_FILELIST.downloadFile('${file.ukey}')" title="下载">
                    <iconpark-icon name="cloud-arrow-down"></iconpark-icon>
                </button>
                ${this.isOwner ? `
                    <button class="vx-list-action-btn" onclick="event.stopPropagation(); VX_FILELIST.renameFile('${file.ukey}', '${this.escapeHtml(file.fname_ex || file.fname)}')" title="重命名">
                        <iconpark-icon name="pen-to-square"></iconpark-icon>
                    </button>
                    <button class="vx-list-action-btn vx-action-danger" onclick="event.stopPropagation(); VX_FILELIST.deleteFile('${file.ukey}')" title="删除">
                        <iconpark-icon name="trash"></iconpark-icon>
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
        const type = (ftype || '').toLowerCase();
        const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
        const videoTypes = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'];
        const audioTypes = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
        const docTypes = ['doc', 'docx', 'pdf', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];
        const archiveTypes = ['zip', 'rar', '7z', 'tar', 'gz'];
        const codeTypes = ['js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'css', 'html', 'json'];
        
        if (imageTypes.includes(type)) return { icon: 'file-image', class: 'vx-icon-image' };
        if (videoTypes.includes(type)) return { icon: 'video', class: 'vx-icon-video' };
        if (audioTypes.includes(type)) return { icon: 'music-note', class: 'vx-icon-audio' };
        if (docTypes.includes(type)) return { icon: 'file-word', class: 'vx-icon-document' };
        if (archiveTypes.includes(type)) return { icon: 'file-archive', class: 'vx-icon-archive' };
        if (codeTypes.includes(type)) return { icon: 'file-code', class: 'vx-icon-code' };
        
        return { icon: 'file', class: 'vx-icon-file' };
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
        VXUI.navigate('filelist', { mrid: mrid });
    },
    
    /**
     * 返回上级
     */
    goToParent() {
        if (this.room && this.room.parent) {
            this.openFolder(this.room.parent);
        } else {
            this.openFolder(0);
        }
    },
    
    /**
     * 刷新
     */
    refresh() {
        this.loadRoom();
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
        this.downloadByUkey(ukey, { filename });
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
        
        // 如果没有下载器，使用简单下载
        if (!this.downloader) {
            this.simpleDownload(ukey);
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
                // 图片卡片 UI
                if (ui) {
                    ui.card.classList.add('downloading');
                    if (ui.overlay) ui.overlay.classList.add('active');
                    if (ui.progress) ui.progress.style.width = '8%';
                    if (ui.status) ui.status.textContent = '准备下载...';
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
                if (ui && ui.progress) ui.progress.style.width = '100%';
                if (ui && ui.status) ui.status.textContent = '下载完成';
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
                VXUI.toastSuccess('下载完成');
            },
            onError: (error) => {
                if (ui && ui.overlay) ui.overlay.classList.add('error');
                if (ui && ui.status) ui.status.textContent = '下载失败';
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
                VXUI.toastError('下载失败，请重试');
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
        if (typeof TL !== 'undefined' && TL.download && TL.download.get_download_url) {
            TL.download.get_download_url(ukey).then(url => {
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
        if (!confirm('确定要删除此文件吗？')) return;
        
        const token = this.getToken();
        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';
        
        $.post(apiUrl, {
            action: 'file_del',
            token: token,
            mr_id: this.mrid,
            ukey: ukey
        }, () => {
            this.refresh();
            VXUI.toastSuccess('删除成功');
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
        if (!confirm('确定要删除此文件夹吗？')) return;
        
        const token = this.getToken();
        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';
        
        $.post(apiUrl, {
            action: 'delete',
            token: token,
            mr_id: mrid
        }, () => {
            this.refresh();
            VXUI.toastSuccess('删除成功');
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
     * 上传文件
     */
    upload() {
        if (typeof TL !== 'undefined' && TL.uploader && TL.uploader.select) {
            TL.uploader.select();
        }
    },
    
    /**
     * 分享文件夹
     */
    shareFolder() {
        if (this.isDesktop) {
            VXUI.toastWarning('桌面无法分享');
            return;
        }
        
        const domain = (typeof TL !== 'undefined' && TL.site_domain) ? TL.site_domain : window.location.host;
        const url = `https://${domain}/room/${this.mrid}`;
        
        if (typeof VXUI !== 'undefined' && VXUI.copyToClipboard) {
            VXUI.copyToClipboard(url);
            VXUI.toastSuccess('链接已复制');
        } else {
            navigator.clipboard.writeText(url).then(() => {
                VXUI.toastSuccess('链接已复制');
            });
        }
    },
    
    // ==================== 选择模式 ====================
    
    /**
     * 切换选择模式
     */
    toggleSelectMode() {
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
    },
    
    /**
     * 下载选中项
     */
    downloadSelected() {
        const files = this.selectedItems.filter(item => item.type === 'file').map(item => item.id);
        
        if (files.length === 0) {
            VXUI.toastWarning('请选择要下载的文件');
            return;
        }
        
        if (typeof TL !== 'undefined' && TL.download && TL.download.selectDownload) {
            TL.download.selectDownload(files);
        } else {
            files.forEach(ukey => {
                window.open(`/file?ukey=${ukey}`, '_blank');
            });
        }
    },
    
    /**
     * 移动选中项
     */
    moveSelected() {
        VXUI.toastInfo('移动功能开发中');
    },
    
    /**
     * 删除选中项
     */
    deleteSelected() {
        if (this.selectedItems.length === 0) return;
        if (!confirm(`确定要删除 ${this.selectedItems.length} 个项目吗？`)) return;
        
        const token = this.getToken();
        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';
        
        let completed = 0;
        const total = this.selectedItems.length;
        
        this.selectedItems.forEach(item => {
            if (item.type === 'folder') {
                $.post(apiUrl, { action: 'delete', token, mr_id: item.id }, () => {
                    completed++;
                    if (completed === total) {
                        this.clearSelection();
                        this.refresh();
                        VXUI.toastSuccess('删除成功');
                    }
                });
            } else {
                $.post(apiUrl, { action: 'file_del', token, mr_id: this.mrid, ukey: item.id }, () => {
                    completed++;
                    if (completed === total) {
                        this.clearSelection();
                        this.refresh();
                        VXUI.toastSuccess('删除成功');
                    }
                });
            }
        });
    },
    
    // ==================== 右键菜单 ====================
    
    showContextMenu(x, y, target) {
        this.contextTarget = target;
        const menu = document.getElementById('vx-fl-context-menu');
        if (!menu) return;
        
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.classList.add('show');
    },
    
    hideContextMenu() {
        const menu = document.getElementById('vx-fl-context-menu');
        if (menu) menu.classList.remove('show');
        this.contextTarget = null;
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
    
    shareContextItem() {
        this.hideContextMenu();
        VXUI.toastInfo('分享功能开发中');
    },
    
    moveContextItem() {
        this.hideContextMenu();
        VXUI.toastInfo('移动功能开发中');
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
        const modal = document.getElementById('vx-fl-create-modal');
        const input = document.getElementById('vx-fl-folder-name');
        if (modal) modal.classList.add('show');
        if (input) {
            input.value = '';
            input.focus();
        }
    },
    
    closeCreateModal() {
        const modal = document.getElementById('vx-fl-create-modal');
        if (modal) modal.classList.remove('show');
    },
    
    createFolder() {
        const name = document.getElementById('vx-fl-folder-name')?.value?.trim();
        if (!name) {
            VXUI.toastWarning('请输入文件夹名称');
            return;
        }
        
        const token = this.getToken();
        const apiUrl = (typeof TL !== 'undefined' && TL.api_mr) ? TL.api_mr : '/api_v2/meetingroom';
        
        $.post(apiUrl, {
            action: 'create',
            token: token,
            name: name,
            mr_id: this.mrid,
            parent: this.room.parent || 0,
            top: this.room.top || 0,
            model: 0
        }, (rsp) => {
            if (rsp.status === 1) {
                this.closeCreateModal();
                this.refresh();
                VXUI.toastSuccess('创建成功');
            } else {
                VXUI.toastError('创建失败');
            }
        });
    },
    
    showRenameModal() {
        const modal = document.getElementById('vx-fl-rename-modal');
        if (modal) modal.classList.add('show');
        const input = document.getElementById('vx-fl-rename-input');
        if (input) input.focus();
    },
    
    closeRenameModal() {
        const modal = document.getElementById('vx-fl-rename-modal');
        if (modal) modal.classList.remove('show');
        this._renameTarget = null;
    },
    
    confirmRename() {
        if (!this._renameTarget) return;
        
        const name = document.getElementById('vx-fl-rename-input')?.value?.trim();
        if (!name) {
            VXUI.toastWarning('请输入新名称');
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
                VXUI.toastSuccess('重命名成功');
            });
        } else {
            if (typeof TL !== 'undefined' && TL.file_rename) {
                TL.file_rename(this._renameTarget.id, name);
                this.closeRenameModal();
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
