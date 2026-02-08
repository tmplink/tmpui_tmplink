/**
 * Photo Album Module - Modern Immersive Gallery
 * A sleek, full-screen photo browsing experience
 * URL format: 
 *   - Folder mode: /?tmpui_page=/app&listview=photo&mrid=xxx
 *   - Workspace mode: /?tmpui_page=/app&listview=photo&mode=workspace
 * 
 * @author tmpUI
 * @version 2.1
 */

// Photo Album Global Object
var PHOTO = {
    // State
    mrid: null,
    mode: 'folder', // 'folder' or 'workspace'
    roomData: null,
    photoList: [],
    folderList: [],
    currentPage: 0,
    isLoading: false,
    hasMore: true,
    isSelectMode: false,
    selectedItems: new Set(),
    downloader: null,
    gridSize: 'normal', // 'small', 'normal', 'large'
    
    // AutoLoader for workspace mode
    autoLoader: null,
    
    // Room hierarchy info (like TL.dir.room)
    room: {
        mr_id: null,
        parent: null,
        top: null,
        owner: 0,
        name: ''
    },
    
    // Lightbox State
    lightboxIndex: 0,
    lightboxRotation: 0,
    lastTrackedLightboxIndex: null,
    
    // Permissions
    isOwner: false,
    isPublic: false,
    
    // Image extensions
    imageExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'],

    // ==================== Analytics ====================

    /**
     * Track UI analytics for photo album.
     * Reuses the project's existing pattern: TL.ga(title) -> /user action=event_ui.
     */
    track: function(action) {
        try {
            if (typeof TL === 'undefined' || !TL || typeof TL.ga !== 'function') return;
            const mode = this.isWorkspaceMode && this.isWorkspaceMode() ? 'Workspace' : 'Folder';
            const mrid = (this.mrid !== null && this.mrid !== undefined && this.mrid !== '') ? this.mrid : '0';

            // Check if running in VXUI context (URL contains /vx)
            if (window.location.href.indexOf('/vx') > -1) {
                TL.ga(`vui_photo_${action}[${mrid}]`);
            } else {
                TL.ga(`Photo_Album_${action}_${mode}[${mrid}]`);
            }
        } catch (e) {
            // No-op: analytics should never break UI
        }
    },

    /**
     * Build image processing URL.
     * New image server format (see img.md):
    *   https://img-{sid}.5t-cdn.com:998/{op}/{size}/{sha1}.{ext}
     */
    buildImageUrl: function(photo, op, size) {
        const sid = photo && photo.sid;
        const sha1 = photo && photo.sha1;
        const ext = (photo && photo.ftype ? String(photo.ftype) : 'jpg').toLowerCase();

        if (!sid || !sha1) {
            console.warn('[PHOTO] Missing sid/sha1 for image url', photo);
            return '';
        }

        return `https://img-${sid}.5t-cdn.com:998/${op}/${size}/${sha1}.${ext}`;
    },

    /**
     * Initialize the photo album module
     */
    init: function() {
        // Hide global loading box to prevent it from showing over the album
        // (album has its own #album-loading indicator)
        if (typeof TL !== 'undefined' && TL.loading_box_off) {
            TL.loading_box_off();
        }
        
        let params = app.getUrlVars(window.location.href);
        this.mrid = params.mrid || '0';
        this.mode = params.mode || 'folder';
        
        // Reset state
        this.photoList = [];
        this.folderList = [];
        this.currentPage = 0;
        this.hasMore = true;
        this.isSelectMode = false;
        this.selectedItems.clear();

        // Prepare downloader
        this.ensureDownloader();
        
        // Clean up previous autoLoader if exists
        if (this.autoLoader) {
            this.autoLoader.disable();
            this.autoLoader = null;
        }
        
        // Reset room info
        this.room = {
            mr_id: null,
            parent: null,
            top: null,
            owner: 0,
            name: ''
        };

        // Track entry
        this.track('Enter');
        
        // Sync theme with main app (delay to ensure DOM is ready)
        setTimeout(() => this.syncTheme(), 10);
        
        // Load saved grid size
        this.gridSize = localStorage.getItem('album_grid_size') || 'normal';
        this.applyGridSize();
        
        // Setup events
        this.setupKeyboardEvents();
        this.setupTouchEvents();
        
        // Apply language
        app.languageBuild();

        // Initially hide share buttons until data loads
        $('#album-share-btn').hide();
        $('#album-share-btn-side').hide();
        
        // Show loading immediately
        this.showLoading();
        
        // Initialize based on mode
        if (this.isWorkspaceMode()) {
            this.initWorkspaceMode();
        } else {
            this.initFolderMode();
        }
    },

    /**
     * Check if current mode is workspace
     */
    isWorkspaceMode: function() {
        return this.mode === 'workspace';
    },

    /**
     * Initialize folder mode
     */
    initFolderMode: function() {
        // Setup infinite scroll for folder mode
        this.setupInfiniteScroll();
        // Load folder data
        this.loadFolderData();
    },

    /**
     * Initialize workspace mode
     */
    initWorkspaceMode: function() {
        // Check login
        if (TL.isLogin() === false) {
            app.open('/login');
            return;
        }
        
        // Update UI for workspace mode
        this.updateWorkspaceUI();
        
        // Initialize AutoLoader for workspace
        this.initAutoLoader();
        
        // Load photos
        this.loadWorkspacePhotos(0);
    },

    /**
     * Update UI elements for workspace mode
     */
    updateWorkspaceUI: function() {
        const title = app.languageData.ws_album_title || '仓库相册';
        $('#album-folder-name').text(title);
        $('#album-folder-name-m').text(title);
        $('#album-mobile-title').text(title);
        document.title = title + ' - Photo Album';
        
        // Hide breadcrumb in workspace mode (no folder hierarchy)
        $('#album-breadcrumb').hide();
        
        // Hide back button in sidebar (no hierarchy in workspace)
        $('.album-back-btn').hide();

        // Hide share button in workspace mode
        this.updateShareButtonVisibility();
    },

    /**
     * Initialize AutoLoader for workspace mode
     */
    initAutoLoader: function() {
        const self = this;
        this.autoLoader = new AutoLoader({
            loadFunction: (page) => {
                if (page === 1 && !self.isLoading && self.hasMore) {
                    self.loadWorkspacePhotos(self.currentPage + 1);
                }
                return true;
            },
            threshold: 200,
            minScrollTop: 100,
            minItemsForDisable: 20
        });
        
        // Override scroll binding to use .album-content instead of window
        this.autoLoader.bindScrollEvent = () => {
            this.autoLoader.isScrollListenerActive = true;
            $('.album-content').on('scroll.autoloader', this.handleWorkspaceScroll.bind(this));
        };
        
        this.autoLoader.unbindScrollEvent = () => {
            this.autoLoader.isScrollListenerActive = false;
            $('.album-content').off('scroll.autoloader');
        };
        
        // Enable auto loading
        this.autoLoader.enable();
    },

    /**
     * Handle scroll event for workspace infinite loading
     */
    handleWorkspaceScroll: function(event) {
        const container = $(event.currentTarget);
        const scrollTop = container.scrollTop();
        const scrollHeight = container[0].scrollHeight;
        const clientHeight = container.height();
        const threshold = 200;
        
        if (scrollTop + clientHeight + threshold >= scrollHeight && scrollTop > 100) {
            if (this.autoLoader && this.autoLoader.autoload && !this.isLoading && this.hasMore) {
                this.autoLoader.autoload = false;
                this.loadWorkspacePhotos(this.currentPage + 1);
            }
        }
    },

    /**
     * Load photos from workspace API
     */
    loadWorkspacePhotos: function(page) {
        if (this.isLoading) return;
        this.isLoading = true;

        if (page > 0) {
            this.track('LoadMore');
        }
        
        if (page === 0) {
            // Loading is already shown by init
            this.photoList = [];
            $('#album-grid').html('');
        }
        
        let keys = typeof getSortKeys === 'function' ? getSortKeys() : { sort_by: 'sort_by', sort_type: 'sort_type' };
        let sort_by = localStorage.getItem(keys.sort_by) || 'time';
        let sort_type = localStorage.getItem(keys.sort_type) || 'desc';
        
        $.post(TL.api_file, {
            action: 'workspace_filelist_page',
            page: page,
            token: TL.api_token,
            sort_type: sort_type,
            sort_by: sort_by,
            photo: 1
        }, (rsp) => {
            this.isLoading = false;
            this.hideLoading();
            this.currentPage = page;
            
            if (rsp.status === 0 || !rsp.data || rsp.data.length === 0) {
                this.hasMore = false;
                if (page === 0) {
                    this.showEmpty();
                }
                if (this.autoLoader) {
                    this.autoLoader.unbindScrollEvent();
                }
                return;
            }
            
            // Filter only image files
            let photos = rsp.data.filter(file => {
                return this.imageExtensions.includes(file.ftype.toLowerCase());
            });
            
            if (photos.length > 0) {
                this.photoList = this.photoList.concat(photos);
                this.renderPhotos(photos);
            }
            
            // Check if there might be more data
            if (rsp.data.length < 20) {
                this.hasMore = false;
                if (this.autoLoader) {
                    this.autoLoader.unbindScrollEvent();
                }
            } else {
                this.hasMore = true;
                if (this.autoLoader) {
                    this.autoLoader.autoload = true;
                }
            }
            
            // Update stats
            this.updateStats();
            
            // Show empty if no photos
            if (this.photoList.length === 0) {
                this.showEmpty();
            }
        }, 'json');
    },

    /**
     * Sync theme from main app (body.dark-mode) to photo album container
     */
    syncTheme: function() {
        const container = document.querySelector('.photo-album-container');
        if (!container) return;
        
        const savedTheme = localStorage.getItem('theme-preference');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const bodyHasDarkMode = document.body.classList.contains('dark-mode');
        
        // Determine if dark mode should be active
        let isDark = false;
        if (savedTheme) {
            isDark = savedTheme === 'dark';
        } else if (systemPrefersDark || bodyHasDarkMode) {
            isDark = true;
        }
        
        // Apply to container
        if (isDark) {
            container.classList.add('dark-mode');
        } else {
            container.classList.remove('dark-mode');
        }
    },

    /**
     * Check if current view is desktop (mrid=0)
     */
    isDesktop: function() {
        return this.mrid === '0' || this.mrid === 0;
    },

    /**
     * Load folder details
     */
    loadFolderData: function() {
        // Loading is already shown by init
        
        $.post(TL.api_mr, {
            action: 'details',
            token: TL.api_token,
            mr_id: this.mrid
        }, (rsp) => {
            if (rsp.status === 0) {
                app.open('/404');
                return;
            }
            
            if (rsp.status === 3) {
                localStorage.setItem('return_page', window.location.href);
                app.open('/login');
                return;
            }
            
            this.roomData = rsp.data;
            
            // Store room hierarchy info (like TL.dir.room)
            this.room.mr_id = rsp.data.mr_id;
            this.room.parent = rsp.data.parent;
            this.room.top = rsp.data.top;
            this.room.owner = rsp.data.owner;
            this.room.name = rsp.data.name;
            
            // Special handling for desktop (mrid=0)
            if (this.isDesktop()) {
                this.room.mr_id = 0;
                this.room.parent = null;
                this.room.top = 0; // Desktop has no top
                this.room.name = app.languageData.navbar_meetingroom || '桌面';
            }
            
            // Debug log for hierarchy
            console.log('[PHOTO] Room hierarchy loaded:', {
                mr_id: this.room.mr_id,
                parent: this.room.parent,
                top: this.room.top,
                name: this.room.name,
                isDesktop: this.isDesktop()
            });
            
            this.isOwner = rsp.data.owner === 1;
            this.isPublic = rsp.data.model === 'public';
            
            // Update UI
            this.updateHeader();
            this.updateBreadcrumb();
            
            // Store subfolders
            this.folderList = [];
            if (rsp.data.sub_rooms && rsp.data.sub_rooms !== 0) {
                this.folderList = rsp.data.sub_rooms;
            }
            
            // Update share button visibility after data is loaded
            this.updateShareButtonVisibility();
            
            // Load photos (desktop won't have photos, only folders)
            this.loadPhotos(0);
        }, 'json');
    },

    /**
     * Update header information
     */
    updateHeader: function() {
        if (!this.roomData) return;
        
        const name = this.roomData.name || app.languageData.album_title || '相册';
        
        $('#album-folder-name').text(name);
        $('#album-folder-name-m').text(name);
        $('#album-mobile-title').text(name);
        
        document.title = name + ' - Photo Album';
    },

    /**
     * Update breadcrumb navigation
     * Similar to how room.html handles navigation
     */
    updateBreadcrumb: function() {
        let html = '';
        
        // Determine if we can go back:
        // - Desktop (mrid=0): cannot go back
        // - First-level folder (top=99): can go back to desktop (mrid=0)
        // - Deeper folder (top!=99): can go back to parent
        const canGoBack = !this.isDesktop();
        
        if (canGoBack) {
            // Show parent folder link
            html += `<span class="album-breadcrumb-item" onclick="PHOTO.goBack()">
                <iconpark-icon name="left-c"></iconpark-icon>
                ${app.languageData.filelist_dir_parent || '上级目录'}
            </span>`;
            html += `<span class="album-breadcrumb-separator">/</span>`;
        }
        
        // Current folder name
        html += `<span class="album-breadcrumb-current">${this.room.name || app.languageData.album_title || '相册'}</span>`;
        
        $('#album-breadcrumb').html(html).show();
        
        // Update back button visibility
        if (canGoBack) {
            $('.album-back-btn').show();
            $('#mobile-back-btn').show();
        } else {
            // At desktop - hide back button
            $('.album-back-btn').hide();
            $('#mobile-back-btn').hide();
        }
    },

    /**
     * Show/hide share button based on mode
     */
    updateShareButtonVisibility: function() {
        const headerBtn = $('#album-share-btn');
        const sideBtn = $('#album-share-btn-side');
        const shouldShow = !this.isWorkspaceMode();
        if (headerBtn.length) {
            shouldShow ? headerBtn.show() : headerBtn.hide();
        }
        if (sideBtn.length) {
            shouldShow ? sideBtn.show() : sideBtn.hide();
        }
    },

    /**
     * Load photos from API
     */
    loadPhotos: function(page) {
        if (this.isLoading) return;
        this.isLoading = true;

        if (page > 0) {
            this.track('LoadMore');
        }
        
        // Loading is already shown by init or loadFolderData
        // Only show loading for subsequent pages
        if (page > 0) {
            this.showLoading();
        }
        
        let keys = typeof getSortKeys === 'function' ? getSortKeys() : { sort_by: 'sort_by', sort_type: 'sort_type' };
        let sort_by = localStorage.getItem(keys.sort_by) || 'time';
        let sort_type = localStorage.getItem(keys.sort_type) || 'desc';
        
        $.post(TL.api_mr, {
            action: 'file_list_page',
            token: TL.api_token,
            page: page,
            photo: 1,
            mr_id: this.mrid,
            sort_by: sort_by,
            sort_type: sort_type
        }, (rsp) => {
            this.isLoading = false;
            this.hideLoading();
            
            if (page === 0) {
                this.photoList = [];
                $('#album-grid').html('');
                
                // Render folders first
                this.renderFolders();
            }
            
            if (rsp.data && rsp.data.length > 0) {
                let photos = rsp.data.filter(file => {
                    return this.imageExtensions.includes(file.ftype.toLowerCase());
                });
                
                this.photoList = this.photoList.concat(photos);
                this.currentPage = page;
                
                // Render photos
                this.renderPhotos(photos);
                
                this.hasMore = rsp.data.length >= 20;
            } else {
                this.hasMore = false;
            }
            
            // Update stats
            this.updateStats();
            
            // Show empty state if needed
            if (this.photoList.length === 0 && this.folderList.length === 0) {
                this.showEmpty();
            }
        }, 'json');
    },

    /**
     * Render folders
     */
    renderFolders: function() {
        if (this.folderList.length === 0) return;
        
        const tpl = $('#tpl-folder-card').html();
        let html = '';
        
        this.folderList.forEach(folder => {
            html += tpl
                .replace(/{mrid}/g, folder.mr_id)
                .replace(/{name}/g, this.escapeHtml(folder.name))
                .replace(/{count}/g, folder.file_count || 0);
        });
        
        $('#album-grid').append(html);
    },

    bindPhotoImageLoading: function(photos) {
        if (!photos || photos.length === 0) return;

        photos.forEach((photo) => {
            const index = this.photoList.indexOf(photo);
            if (index === -1) return;

            const card = $(`.photo-card[data-index="${index}"]`);
            const img = card.find('.photo-card-image');
            if (!card.length || !img.length) return;

            const markLoaded = () => card.addClass('is-loaded');

            img.one('load.photoalbum', markLoaded);
            img.one('error.photoalbum', markLoaded);

            if (img[0] && img[0].complete) {
                // If already loaded from cache, mark immediately
                markLoaded();
            }
        });
    },

    /**
     * Render photos with fade-in animation
     */
    renderPhotos: function(photos) {
        if (photos.length === 0) return;
        
        const tpl = $('#tpl-photo-card').html();
        let html = '';
        
        photos.forEach((photo, idx) => {
            const globalIndex = this.photoList.indexOf(photo);
            const thumbnail = this.buildImageUrl(photo, 'thumb', '800x600');
            const size = typeof bytetoconver === 'function' ? bytetoconver(photo.fsize, true) : photo.fsize;
            
            html += tpl
                .replace(/{index}/g, globalIndex)
                .replace(/{fid}/g, photo.ukey)
                .replace(/{thumbnail}/g, thumbnail)
                .replace(/{name}/g, this.escapeHtml(photo.fname))
                .replace(/{size}/g, size);
        });
        
        $('#album-grid').append(html);

        // Attach loading handlers for the appended photos
        this.bindPhotoImageLoading(photos);
    },

    /**
     * Update album statistics
     */
    updateStats: function() {
        const count = this.photoList.length;
        $('#album-photo-count').text(count);
        $('#album-photo-count-m').text(count);
    },

    /**
     * Photo card click handler
     */
    cardClick: function(event, index) {
        if (this.isSelectMode) {
            this.toggleSelect(index);
        } else {
            this.openLightbox(index);
        }
    },

    /**
     * Toggle photo selection
     */
    toggleSelect: function(index) {
        const card = $(`.photo-card[data-index="${index}"]`);
        const photo = this.photoList[index];
        
        if (!photo) return;
        
        if (this.selectedItems.has(photo.ukey)) {
            this.selectedItems.delete(photo.ukey);
            card.removeClass('selected');
        } else {
            this.selectedItems.add(photo.ukey);
            card.addClass('selected');
        }
        
        this.updateSelectionUI();
    },

    /**
     * Toggle select mode
     */
    toggleSelectMode: function() {
        this.isSelectMode = !this.isSelectMode;
        this.selectedItems.clear();
        
        $('.photo-card').removeClass('selected');
        $('#btn-select').toggleClass('active', this.isSelectMode);
        
        this.updateSelectionUI();
    },

    /**
     * Update selection UI
     */
    updateSelectionUI: function() {
        const count = this.selectedItems.size;
        $('#selection-count-num').text(count);
        
        if (count > 0) {
            $('#album-selection-bar').addClass('active');
            // Show download buttons when items are selected
            $('#album-download-btn').show();
            $('#album-mobile-download-btn').show();
            $('#album-download-btn-m').show();
            $('#album-mobile-download-btn-m').show();
        } else {
            $('#album-selection-bar').removeClass('active');
            // Hide download buttons when no items are selected
            $('#album-download-btn').hide();
            $('#album-mobile-download-btn').hide();
            $('#album-download-btn-m').hide();
            $('#album-mobile-download-btn-m').hide();
        }
    },

    /**
     * Select all photos
     */
    selectAll: function() {
        this.isSelectMode = true;
        this.selectedItems.clear();
        
        this.photoList.forEach(photo => {
            this.selectedItems.add(photo.ukey);
        });
        
        $('.photo-card').addClass('selected');
        this.updateSelectionUI();
    },

    /**
     * Cancel selection
     */
    cancelSelection: function() {
        this.isSelectMode = false;
        this.selectedItems.clear();
        $('.photo-card').removeClass('selected');
        $('#btn-select').removeClass('active');
        this.updateSelectionUI();
    },

    /**
     * Set grid size
     */
    setGridSize: function(size) {
        this.gridSize = size;
        localStorage.setItem('album_grid_size', size);
        this.applyGridSize();
        this.track('GridChange');
    },

    /**
     * Apply grid size
     */
    applyGridSize: function() {
        const grid = $('#album-grid');
        grid.removeClass('small normal large');
        grid.addClass(this.gridSize);
        
        // Update nav items
        $('.album-nav-item').removeClass('active');
        $(`#nav-${this.gridSize}`).addClass('active');
        $(`#nav-${this.gridSize}-m`).addClass('active');
        
        // Update view buttons
        $('.album-view-btn').removeClass('active');
        $(`#view-${this.gridSize}`).addClass('active');
    },

    /**
     * Toggle sidebar (mobile)
     */
    toggleSidebar: function() {
        $('.album-layout').toggleClass('sidebar-open');
    },

    /**
     * Refresh album
     */
    refresh: function() {
        this.track('Refresh');
        if (this.isWorkspaceMode()) {
            // Reset and reload workspace photos
            this.photoList = [];
            this.currentPage = 0;
            this.hasMore = true;
            if (this.autoLoader) {
                this.autoLoader.enable();
            }
            this.loadWorkspacePhotos(0);
        } else {
            this.loadFolderData();
        }
    },

    /**
     * Navigate to a folder in photo mode without full page reload
     * This updates the URL and reloads data, but doesn't redraw the entire page
     */
    navigateTo: function(mrid) {
        this.track('Navigate');
        // Update mrid
        this.mrid = String(mrid);
        
        // Update URL without triggering full route
        const url = '/app&listview=photo&mrid=' + mrid;
        app.dynOpen(url);
        
        // Reset state for new folder
        this.photoList = [];
        this.folderList = [];
        this.currentPage = 0;
        this.hasMore = true;
        this.isSelectMode = false;
        this.selectedItems.clear();
        this.lightboxIndex = 0;
        
        // Clear grid
        $('#album-grid').html('');
        $('#album-empty').hide();
        
        // Load new folder data
        this.loadFolderData();
    },

    /**
     * Exit photo mode and return to normal view
     * This DOES require a full page load since we're changing listview
     */
    exitPhotoMode: function() {
        this.track('Exit');
        // Clean up autoLoader if exists
        if (this.autoLoader) {
            this.autoLoader.disable();
            this.autoLoader = null;
        }
        
        if (this.isWorkspaceMode()) {
            // Return to workspace
            this.resetPreferredListView();
            app.open('/app&listview=workspace');
        } else {
            // Return to room view
            const mrid = this.isDesktop() ? 0 : this.room.mr_id;
            const url = '/app&listview=room&mrid=' + mrid;
            console.log('[PHOTO] Exiting photo mode:', url);
            this.resetPreferredListView();
            app.open(url);
        }
    },

    /**
     * Ensure returning views default to list mode
     */
    resetPreferredListView: function() {
        if (this.isWorkspaceMode()) {
            localStorage.setItem('app_workspace_view', 'list');
            return;
        }

        const roomId = (this.room && this.room.mr_id !== undefined) ? this.room.mr_id : this.mrid;
        if (roomId !== undefined && roomId !== null) {
            const roomKey = 'app_room_view_' + roomId;
            localStorage.setItem(roomKey, 'list');
        }
    },

    /**
     * Go back - in workspace mode, exit; in folder mode, go to parent
     */
    goBack: function() {
        if (this.isWorkspaceMode()) {
            this.exitPhotoMode();
            return;
        }
        
        // Original folder mode goBack logic
        console.log('[PHOTO] goBack called, room info:', this.room);
        
        // Desktop - cannot go back
        if (this.isDesktop()) {
            console.log('[PHOTO] Already at desktop, cannot go back');
            return;
        }

        this.track('GoBack');
        
        // Determine parent folder
        let parentMrid;
        if (this.room.top === 99) {
            // First-level folder, go back to desktop (mrid=0)
            parentMrid = 0;
        } else {
            // Deeper folder, go back to parent
            parentMrid = this.room.parent;
        }
        
        console.log('[PHOTO] Going back to:', parentMrid);
        this.navigateTo(parentMrid);
    },

    /**
     * Open subfolder in photo mode (no full page reload)
     */
    openFolder: function(mrid) {
        console.log('[PHOTO] Opening folder:', mrid);
        this.track('OpenFolder');
        this.navigateTo(mrid);
    },

    /**
     * Copy album URL for sharing (folder mode only)
     */
    shareAlbumLink: function() {
        if (this.isWorkspaceMode()) {
            TL.alert(app.languageData.album_share_workspace_disabled || '仓库模式暂不支持分享链接');
            return;
        }

        this.track('ShareLink');

        const url = `${window.location.origin}/vx_photo/${encodeURIComponent(this.mrid)}`;
        const onSuccess = () => {
            this.shareButtonFeedback('success');
            TL.alert(app.languageData.album_share_copied || '相册链接已复制');
            this.track('ShareLinkSuccess');
        };
        const onFail = () => {
            this.shareButtonFeedback('error');
            TL.alert((app.languageData.album_share_copy_failed || '复制失败，请手动复制链接') + `\n${url}`);
            this.track('ShareLinkFail');
        };

        this.shareButtonFeedback('pending');
        this.copyToClipboard(url, onSuccess, onFail);
    },

    shareButtonFeedback: function(state) {
        const headerBtn = $('#album-share-btn');
        const sideBtn = $('#album-share-btn-side');
        const classes = 'copied share-error share-pending';
        const apply = (btn) => {
            if (!btn || !btn.length) return;
            // Cache originals
            const icon = btn.find('iconpark-icon');
            if (icon.length && !btn.data('share-icon')) {
                btn.data('share-icon', icon.attr('name') || 'share-from-square');
            }
            const label = btn.find('[data-role="album-share-text"]');
            if (label.length && !btn.data('share-text')) {
                btn.data('share-text', label.text());
            }

            btn.removeClass(classes);
            if (state === 'success') {
                btn.addClass('copied');
                if (icon.length) icon.attr('name', 'circle-check');
                if (label.length) label.text(app.languageData.album_share_copied || '已复制');
            } else if (state === 'error') {
                btn.addClass('share-error');
                if (icon.length) icon.attr('name', 'close-one');
                if (label.length) label.text(app.languageData.album_share_copy_failed || '复制失败');
            } else if (state === 'pending') {
                btn.addClass('share-pending');
                if (icon.length) icon.attr('name', 'loading');
                if (label.length) label.text(app.languageData.album_share_copying || '复制中...');
            }

            if (state === 'success' || state === 'error') {
                setTimeout(() => this.restoreShareButton(btn), 1400);
            }
        };
        apply(headerBtn);
        apply(sideBtn);
    },

    restoreShareButton: function(btn) {
        if (!btn || !btn.length) return;
        btn.removeClass('copied share-error share-pending');
        const icon = btn.find('iconpark-icon');
        const label = btn.find('[data-role="album-share-text"]');
        if (icon.length && btn.data('share-icon')) {
            icon.attr('name', btn.data('share-icon'));
        }
        if (label.length && btn.data('share-text')) {
            label.text(btn.data('share-text'));
        }
    },

    copyToClipboard: function(text, onSuccess, onFail) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => onSuccess && onSuccess())
                .catch(() => this.fallbackCopy(text, onSuccess, onFail));
            return;
        }
        this.fallbackCopy(text, onSuccess, onFail);
    },

    fallbackCopy: function(text, onSuccess, onFail) {
        const input = document.createElement('input');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        try {
            const ok = document.execCommand('copy');
            document.body.removeChild(input);
            if (ok) {
                onSuccess && onSuccess();
            } else {
                onFail && onFail();
            }
        } catch (err) {
            document.body.removeChild(input);
            onFail && onFail(err);
        }
    },

    ensureDownloader: function() {
        if (!this.downloader) {
            this.downloader = new download_photo();
            this.downloader.init(TL);
        }
    },

    getDownloadUI: function(index) {
        if (typeof index !== 'number') return null;
        const card = $(`.photo-card[data-index="${index}"]`);
        if (!card.length) return null;

        return {
            card,
            button: card.find('.photo-card-action'),
            overlay: card.find('.photo-download-overlay'),
            progress: card.find('.photo-download-progress-bar'),
            status: card.find('[data-role="download-status"]')
        };
    },

    resetDownloadUI: function(ui) {
        if (!ui) return;
        ui.card.removeClass('downloading');
        ui.overlay.removeClass('active error');
        ui.progress.css('width', '0%');
        ui.status.text('');
        ui.button.prop('disabled', false).removeClass('is-downloading');
    },

    formatBytesFallback: function(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
        const val = bytes / Math.pow(k, i);
        return `${val.toFixed(2)} ${sizes[i]}`;
    },

    /**
     * Download single photo by ukey
     */
    downloadByUkey: async function(ukey, options = {}) {
        this.ensureDownloader();

        const ui = this.getDownloadUI(options.index);
        const formatBytes = (val) => {
            if (typeof bytetoconver === 'function') {
                return bytetoconver(val, true);
            }
            return this.formatBytesFallback(val);
        };

        const uiCallbacks = ui ? {
            onStart: () => {
                ui.card.addClass('downloading');
                ui.overlay.addClass('active').removeClass('error');
                ui.progress.css('width', '8%');
                ui.status.text(app.languageData.download_preparing || '准备下载...');
                ui.button.prop('disabled', true).addClass('is-downloading');
            },
            onProgress: (loaded, total) => {
                const percent = total ? Math.min(100, Math.round((loaded / total) * 100)) : Math.min(95, Math.round((loaded / 1024) % 95));
                ui.progress.css('width', `${percent}%`);
                const loadedText = formatBytes(loaded);
                const totalText = total ? formatBytes(total) : '';
                ui.status.text(total ? `${loadedText} / ${totalText}` : loadedText);
            },
            onComplete: () => {
                ui.progress.css('width', '100%');
                ui.status.text(app.languageData.multi_download_finish || '下载完成');
                setTimeout(() => this.resetDownloadUI(ui), 600);
            },
            onError: () => {
                ui.overlay.addClass('error');
                ui.status.text(app.languageData.multi_download_error || '下载失败');
                setTimeout(() => this.resetDownloadUI(ui), 1200);
            }
        } : null;

        try {
            await this.downloader.download({
                ukey,
                filename: options.filename,
                ui: uiCallbacks
            });
        } catch (error) {
            console.error('Download failed:', error);
            TL.alert(app.languageData.download_error_retry || '下载失败，请重试');
        }
    },

    /**
     * Download single photo
     */
    downloadPhoto: function(index) {
        const photo = this.photoList[index];
        if (photo) {
            this.downloadByUkey(photo.ukey, {
                index,
                filename: photo.fname
            });
        }
    },

    /**
     * Download selected or all photos
     */
    downloadSelected: async function() {
        let items = [];
        
        if (this.selectedItems.size > 0) {
            items = Array.from(this.selectedItems);
        } else {
            items = this.photoList.map(p => p.ukey);
        }
        
        if (items.length === 0) {
            return;
        }

        this.track('DownloadSelected');
        
        // 逐个下载
        for (const ukey of items) {
            const index = this.photoList.findIndex(p => p.ukey === ukey);
            const filename = index >= 0 ? this.photoList[index].fname : undefined;
            await this.downloadByUkey(ukey, { index, filename });
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    },

    /**
     * Download current lightbox photo
     */
    downloadCurrent: function() {
        const photo = this.photoList[this.lightboxIndex];
        if (photo) {
            this.track('DownloadCurrent');
            this.downloadByUkey(photo.ukey, {
                index: this.lightboxIndex,
                filename: photo.fname
            });
        }
    },

    // ==================== Lightbox ====================

    /**
     * Open lightbox
     */
    openLightbox: function(index) {
        if (index < 0 || index >= this.photoList.length) return;
        
        this.lightboxIndex = index;
        this.lightboxRotation = 0;
        this.updateLightbox();
        this.renderThumbnails();
        
        $('#album-lightbox').addClass('active');
        $('body').css('overflow', 'hidden');

        this.lastTrackedLightboxIndex = null;
    },

    /**
     * Close lightbox
     */
    closeLightbox: function() {
        $('#album-lightbox').removeClass('active');
        $('body').css('overflow', '');
    },

    /**
     * Update lightbox content
     */
    updateLightbox: function() {
        const photo = this.photoList[this.lightboxIndex];
        if (!photo) return;

        if (this.lastTrackedLightboxIndex !== this.lightboxIndex) {
            this.lastTrackedLightboxIndex = this.lightboxIndex;
        }

        const imageUrl = this.buildImageUrl(photo, 'thumb', '0x0');
        
        // Reset rotation
        $('#lightbox-image').css('transform', 'rotate(0deg)');
        
        // Show loading, clear image
        $('#lightbox-loading').removeClass('hidden');
        $('#lightbox-image').attr('src', '');
        
        // Load image
        const img = new Image();
        img.onload = () => {
            $('#lightbox-image').attr('src', imageUrl);
            $('#lightbox-loading').addClass('hidden');
        };
        img.onerror = () => {
            $('#lightbox-loading').addClass('hidden');
        };
        img.src = imageUrl;
        
        // Update info
        $('#lightbox-title').text(photo.fname);
        $('#lightbox-counter').text(`${this.lightboxIndex + 1} / ${this.photoList.length}`);
        
        // Update thumbnails active state
        $('.lightbox-thumbnail').removeClass('active');
        $(`.lightbox-thumbnail[data-index="${this.lightboxIndex}"]`).addClass('active');
    },

    /**
     * Render lightbox thumbnails
     */
    renderThumbnails: function() {
        const tpl = $('#tpl-lightbox-thumb').html();
        let html = '';
        
        this.photoList.forEach((photo, index) => {
            const thumbnail = this.buildImageUrl(photo, 'thumb', '128x128');
            const active = index === this.lightboxIndex ? 'active' : '';
            
            html += tpl
                .replace(/{index}/g, index)
                .replace(/{thumbnail}/g, thumbnail)
                .replace(/{active}/g, active);
        });
        
        $('#lightbox-thumbnails').html(html);
    },

    /**
     * Previous photo in lightbox
     */
    lightboxPrev: function() {
        if (this.lightboxIndex > 0) {
            this.lightboxIndex--;
            this.lightboxRotation = 0;
            this.updateLightbox();
        }
    },

    /**
     * Next photo in lightbox
     */
    lightboxNext: function() {
        if (this.lightboxIndex < this.photoList.length - 1) {
            this.lightboxIndex++;
            this.lightboxRotation = 0;
            this.updateLightbox();
        }
    },

    /**
     * Go to specific photo
     */
    goToPhoto: function(index) {
        if (index >= 0 && index < this.photoList.length) {
            this.lightboxIndex = index;
            this.lightboxRotation = 0;
            this.updateLightbox();
        }
    },

    /**
     * Rotate current image
     */
    rotateLightbox: function() {
        this.lightboxRotation = (this.lightboxRotation + 90) % 360;
        $('#lightbox-image').css('transform', `rotate(${this.lightboxRotation}deg)`);

        // analytics removed: Rotate
    },

    // ==================== UI Helpers ====================

    /**
     * Show loading state
     */
    showLoading: function() {
        $('#album-loading').show();
        $('#album-empty').hide();
        $('#album-grid').hide();
    },

    /**
     * Hide loading state
     */
    hideLoading: function() {
        $('#album-loading').hide();
        $('#album-grid').show();
    },

    /**
     * Show empty state
     */
    showEmpty: function() {
        // Different empty message based on mode
        if (this.isWorkspaceMode()) {
            $('#album-empty .album-empty-title').text(app.languageData.ws_album_empty_title || '暂无照片');
            $('#album-empty .album-empty-text').text(app.languageData.ws_album_empty_text || '您的仓库中没有图片文件');
        } else if (this.isDesktop()) {
            $('#album-empty .album-empty-title').text(app.languageData.page_no_dir_title || '暂无文件夹');
            $('#album-empty .album-empty-text').text(app.languageData.page_no_dir_text || '请先在桌面创建文件夹');
        } else {
            $('#album-empty .album-empty-title').text(app.languageData.album_empty_title || '暂无照片');
            $('#album-empty .album-empty-text').text(app.languageData.album_empty_text || '此文件夹中没有图片文件');
        }
        $('#album-empty').show();
    },

    /**
     * Escape HTML
     */
    escapeHtml: function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // ==================== Events ====================

    /**
     * Setup keyboard events
     */
    setupKeyboardEvents: function() {
        $(document).off('keydown.photoalbum').on('keydown.photoalbum', (e) => {
            // Only in lightbox
            if (!$('#album-lightbox').hasClass('active')) return;
            
            switch(e.key) {
                case 'Escape':
                    this.closeLightbox();
                    break;
                case 'ArrowLeft':
                    this.lightboxPrev();
                    break;
                case 'ArrowRight':
                    this.lightboxNext();
                    break;
            }
        });
    },

    /**
     * Setup infinite scroll
     */
    setupInfiniteScroll: function() {
        $('.album-content').off('scroll.photoalbum').on('scroll.photoalbum', (e) => {
            if (this.isLoading || !this.hasMore) return;
            
            const el = e.target;
            const scrollTop = el.scrollTop;
            const scrollHeight = el.scrollHeight;
            const clientHeight = el.clientHeight;
            
            if (scrollTop + clientHeight >= scrollHeight - 200) {
                this.loadPhotos(this.currentPage + 1);
            }
        });
    },

    /**
     * Setup touch events for lightbox
     */
    setupTouchEvents: function() {
        let startX = 0;
        let startY = 0;
        
        $('.lightbox-content').off('touchstart.photoalbum').on('touchstart.photoalbum', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });
        
        $('.lightbox-content').off('touchend.photoalbum').on('touchend.photoalbum', (e) => {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            
            const diffX = endX - startX;
            const diffY = endY - startY;
            
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                if (diffX > 0) {
                    this.lightboxPrev();
                } else {
                    this.lightboxNext();
                }
            }
        });
        
        // Handle orientation change
        $(window).off('orientationchange.photoalbum resize.photoalbum');
    },

    /**
     * Cleanup
     */
    destroy: function() {
        $(document).off('keydown.photoalbum');
        $('.album-content').off('scroll.photoalbum');
        $('.lightbox-content').off('touchstart.photoalbum touchend.photoalbum');
        this.closeLightbox();
    }
};

/**
 * Initialize photo album module
 */
function INIT_photo() {
    TL.ready(() => {
        PHOTO.init();
        $('title').html(app.languageData.album_title || 'Photo Album');
    });
}

// Register exit handler
if (typeof app !== 'undefined' && app.onExit) {
    app.onExit(() => {
        if (typeof PHOTO !== 'undefined') {
            PHOTO.destroy();
        }
    });
}
