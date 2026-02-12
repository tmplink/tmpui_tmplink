/**
 * VXUI Direct (直链) Module
 * 直链管理模块 - 基于新 VXUI 框架
 * @version 1.0.0
 */

'use strict';

const VX_DIRECT = {
    // ==================== State ====================
    activeTab: 'dashboard',

    // details
    isInit: false,
    domain: 0,
    protocol: 'http://',
    quota: 0,
    quota_free: 0,
    total_transfer: 0,
    total_downloads: 0,
    hp_time: 0,
    ssl: false,
    ssl_acme: false,
    ssl_auto: false,
    traffic_limit: 0,
    key: 0,

    // branding
    brand_logo_id: '0',
    brand_title: '0',
    brand_content: '0',
    brand_status: '',

    // files list
    files: [],
    selectedItems: new Set(),
    pageNumber: 0,
    hasMore: true,
    isLoading: false,
    filesReqSeq: 0,

    // folders list
    folders: [],
    selectedFolders: new Set(),
    foldersReqSeq: 0,

    // 预加载缓存状态
    filesPreloaded: false,
    foldersPreloaded: false,

    // search
    search: '',

    // Sorters (initialized in init)
    fileSorter: null,
    folderSorter: null,

    // timers
    _readyTimer: null,

    // usage chart
    usageRt: 5,
    usageChart: null,

    allow_ext: ['mp4', 'm4v', 'webm', 'mov', 'ogg', 'mp3'],

    // ==================== Analytics ====================
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

    // ==================== Sorting ====================
    setFileSort(col) {
        if (this.fileSorter) {
            this.fileSorter.set(col);
        }
    },
    
    setFolderSort(col) {
        if (this.folderSorter) {
            this.folderSorter.set(col);
        }
    },
    
    // ==================== Lifecycle ====================
    init(params = {}) {
        console.log('[VX_DIRECT] Initializing...', params);

        // 初始化排序管理器
        if (typeof VxSort !== 'undefined') {
            if (!this.fileSorter) {
                this.fileSorter = new VxSort({
                    key: 'vx_direct_file_',
                    iconPrefix: 'vx-direct-file-sort-icon-',
                    onSortChange: () => {
                        this.pageNumber = 0;
                        this.files = [];
                        this.loadFiles(true);
                    }
                });
                this.fileSorter.load('default', 0, 0);
            }
            if (!this.folderSorter) {
                this.folderSorter = new VxSort({
                    key: 'vx_direct_folder_', 
                    iconPrefix: 'vx-direct-folder-sort-icon-',
                    onSortChange: () => {
                        this.folders = [];
                        this.loadFolders(true);
                    }
                });
                this.folderSorter.load('default', 0, 0);
            }
        }

        if (typeof TL !== 'undefined' && !TL.isLogin()) {
            VXUI.toastWarning('请先登录');
            setTimeout(() => {
                app.open('/login');
            }, 300);
            return;
        }

        // VXUI 可能在 TL.api_token 尚未填充时加载模块：兜底从存储恢复
        if (typeof TL !== 'undefined' && !TL.api_token) {
            const stored = localStorage.getItem('app_token');
            if (stored) {
                TL.api_token = stored;
            } else if (typeof getCookie === 'function') {
                const c = getCookie('token');
                if (c) TL.api_token = c;
            }
        }

        this.resetState();
        this.applyUrlParams(params);
        this.updateSidebar();
        this.bindEvents();

        this.showLoading();
        this.loadDetails()
            .then(() => {
                this.applyDetailsToUI();

            // Sidebar gating needs details (domain status)
            this.updateSidebar();
            this.applyGateUI();

                const preferTab = params.tab ? String(params.tab) : null;
                if (this.domain === 0) {
                    this.showTab('domain');
                } else {
                    this.showTab(preferTab || 'dashboard');
                }

                this.hideLoading();
                this.loadCurrentTab(true);
            })
            .catch((err) => {
                console.error('[VX_DIRECT] init details error:', err);
                this.hideLoading();
                if (String(err?.message || '').includes('token')) {
                    VXUI.toastError('登录状态无效，请重新登录');
                    setTimeout(() => {
                        app.open('/login');
                    }, 300);
                } else {
                    VXUI.toastError('加载直链信息失败');
                }
            });
    },

    destroy() {
        console.log('[VX_DIRECT] Destroying...');
        this.unbindEvents();
        this.stopReadyTimer();

        if (this.usageChart && typeof this.usageChart.destroy === 'function') {
            try {
                this.usageChart.destroy();
            } catch (e) {
                // ignore
            }
        }
        this.usageChart = null;
    },

    resetState() {
        this.activeTab = 'dashboard';

        this.isInit = false;
        this.domain = 0;
        this.protocol = 'http://';
        this.quota = 0;
        this.quota_free = 0;
        this.total_transfer = 0;
        this.total_downloads = 0;
        this.hp_time = 0;
        this.ssl = false;
        this.ssl_acme = false;
        this.ssl_auto = false;
        this.traffic_limit = 0;
        this.key = 0;

        this.brand_logo_id = '0';
        this.brand_title = '0';
        this.brand_content = '0';
        this.brand_status = '';

        this.files = [];
        this.folders = [];
        this.selectedItems.clear();
        this.selectedFolders.clear();

        this.pageNumber = 0;
        this.hasMore = true;
        this.isLoading = false;

        this.filesReqSeq = 0;
        this.foldersReqSeq = 0;

        // 重置预加载缓存状态
        this.filesPreloaded = false;
        this.foldersPreloaded = false;

        this.search = '';
    },

    // ==================== Sidebar / Tabs ====================
    updateSidebar() {
        const tpl = document.getElementById('vx-direct-sidebar-tpl');
        const container = document.getElementById('vx-sidebar-dynamic');
        if (!tpl || !container) return;

        const content = tpl.content.cloneNode(true);
        container.innerHTML = '';
        container.appendChild(content);

        if (typeof VXUI !== 'undefined' && typeof VXUI.refreshSidebarDivider === 'function') {
            VXUI.refreshSidebarDivider();
        }
        if (typeof app !== 'undefined') {
            app.languageBuild();
        }

        this.updateTabUI();
        this.applyGateUI();
    },

    showTab(tab) {
        const next = String(tab || 'dashboard');
        
        // 如果没有配置域名，只允许显示 domain 标签
        if (this.domain === 0 && next !== 'domain') {
            this.activeTab = 'domain';
            this.updateTabUI();
            this.applyGateUI();
            this.syncUrlState();
            return;
        }
        
        this.activeTab = next;
        this.updateTabUI();
        this.applyGateUI();
        this.syncUrlState();

        this.trackUI(`vui_direct[${this.activeTab}]`);

        this.loadCurrentTab(true);
    },

    syncUrlState() {
        if (typeof VXUI === 'undefined' || !VXUI || typeof VXUI.updateUrl !== 'function') return;
        let params = {};
        if (typeof VXUI.getUrlParams === 'function') {
            params = { ...VXUI.getUrlParams() };
            delete params.module;
        }
        params.tab = this.activeTab;

        let sorter = null;
        if (this.activeTab === 'files') sorter = this.fileSorter;
        else if (this.activeTab === 'folders') sorter = this.folderSorter;

        if (sorter) {
             params.sort_by = String(sorter.currentBy);
             params.sort_type = String(sorter.currentType);
        } else {
             delete params.sort_by;
             delete params.sort_type;
        }

        if (this.search) params.search = String(this.search);
        else delete params.search;
        VXUI.updateUrl('direct', params);
    },

    applyUrlParams(params = {}) {
        const tab = params.tab || 'dashboard';
        const urlSortBy = params.sort_by;
        const urlSortType = params.sort_type;
        const urlSearch = params.search;

        if (urlSearch !== undefined && urlSearch !== null) {
            this.search = String(urlSearch);
        }

        let sorter = null;
        if (tab === 'files') sorter = this.fileSorter;
        else if (tab === 'folders') sorter = this.folderSorter;

        if (sorter && urlSortBy !== undefined) {
             let by = parseInt(urlSortBy);
             let type = urlSortType !== undefined ? parseInt(urlSortType) : 0;
             if (!isNaN(by)) {
                  sorter.setRaw(by, type);
             }
        }
    },

    updateTabUI() {
        const panels = document.getElementById('vx-direct-panels');
        if (panels) panels.classList.remove('vx-hidden');

        const setActive = (id, active) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.toggle('active', !!active);
        };

        setActive('vx-direct-nav-dashboard', this.activeTab === 'dashboard');
        setActive('vx-direct-nav-files', this.activeTab === 'files');
        setActive('vx-direct-nav-folders', this.activeTab === 'folders');
        setActive('vx-direct-nav-api', this.activeTab === 'api');
        setActive('vx-direct-nav-domain', this.activeTab === 'domain');

        const showPanel = (panelId, show) => {
            const el = document.getElementById(panelId);
            if (!el) return;
            el.style.display = show ? '' : 'none';
        };

        showPanel('vx-direct-panel-dashboard', this.activeTab === 'dashboard');
        showPanel('vx-direct-panel-files', this.activeTab === 'files');
        showPanel('vx-direct-panel-folders', this.activeTab === 'folders');
        showPanel('vx-direct-panel-api', this.activeTab === 'api');
        showPanel('vx-direct-panel-domain', this.activeTab === 'domain');

        // filelist-like layout for list tabs
        const content = document.getElementById('vx-direct-content');
        if (content) {
            const listMode = (this.activeTab === 'files' || this.activeTab === 'folders');
            content.classList.toggle('vx-content-list', listMode);
        }

        // Header controls (files only)
        const filesControls = document.getElementById('vx-direct-header-files-controls');
        if (filesControls) {
            filesControls.style.display = (this.activeTab === 'files') ? 'flex' : 'none';
        }

        // keep init_vx_direct.js compatibility: hasMore/loadMore based on current tab
        this.hasMore = (this.activeTab === 'files') ? this.hasMore : false;
    },

    applyGateUI() {
        const configured = !!(this.domain && this.domain !== 0);

        // Sidebar items: only show Domain when not configured
        const navDashboard = document.getElementById('vx-direct-nav-dashboard');
        const navFiles = document.getElementById('vx-direct-nav-files');
        const navFolders = document.getElementById('vx-direct-nav-folders');
        const navApi = document.getElementById('vx-direct-nav-api');
        if (navDashboard) navDashboard.style.display = configured ? '' : 'none';
        if (navFiles) navFiles.style.display = configured ? '' : 'none';
        if (navFolders) navFolders.style.display = configured ? '' : 'none';
        if (navApi) navApi.style.display = configured ? '' : 'none';

        // Top right action buttons
        const topBrand = document.getElementById('vx-direct-top-brand');
        const topQuota = document.getElementById('vx-direct-top-quota');
        if (topBrand) topBrand.style.display = configured ? '' : 'none';
        if (topQuota) topQuota.style.display = configured ? '' : 'none';

        // When not configured, only show the Domain panel and hide other tabs content
        const dashboardPanel = document.getElementById('vx-direct-panel-dashboard');
        const filesPanel = document.getElementById('vx-direct-panel-files');
        const foldersPanel = document.getElementById('vx-direct-panel-folders');
        const apiPanel = document.getElementById('vx-direct-panel-api');
        if (dashboardPanel) dashboardPanel.style.display = configured && this.activeTab === 'dashboard' ? '' : 'none';
        if (filesPanel) filesPanel.style.display = configured && this.activeTab === 'files' ? '' : 'none';
        if (foldersPanel) foldersPanel.style.display = configured && this.activeTab === 'folders' ? '' : 'none';
        if (apiPanel) apiPanel.style.display = configured && this.activeTab === 'api' ? '' : 'none';

        // Domain sub-sections
        const trafficBlock = document.getElementById('vx-direct-traffic-block');
        const brandCard = document.getElementById('vx-direct-brand-card');
        if (trafficBlock) trafficBlock.style.display = configured ? '' : 'none';
        if (brandCard) brandCard.style.display = configured ? '' : 'none';
    },

    // ==================== Events ====================
    bindEvents() {
        this._scrollHandler = (typeof VXUI !== 'undefined' && typeof VXUI.throttle === 'function')
            ? VXUI.throttle(() => this.onScroll(), 200)
            : () => this.onScroll();

        (document.getElementById('vx-direct-content') || document.querySelector('.vx-content'))?.addEventListener('scroll', this._scrollHandler);
        document.getElementById('vx-direct-files-list-body')?.addEventListener('scroll', this._scrollHandler);
    },

    unbindEvents() {
        if (this._scrollHandler) {
            (document.getElementById('vx-direct-content') || document.querySelector('.vx-content'))?.removeEventListener('scroll', this._scrollHandler);
            document.getElementById('vx-direct-files-list-body')?.removeEventListener('scroll', this._scrollHandler);
        }
    },

    onScroll() {
        if (this.activeTab !== 'files') return;
        const content = document.getElementById('vx-direct-files-list-body') || document.getElementById('vx-direct-content') || document.querySelector('.vx-content');
        if (!content) return;
        if (this.isLoading || !this.hasMore) return;

        const { scrollTop, scrollHeight, clientHeight } = content;
        if (scrollTop + clientHeight >= scrollHeight - 200) {
            this.loadMore();
        }
    },

    // ==================== API Helpers ====================
    /**
     * 获取 API Token（与 VX_FILELIST 一致）
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

    apiPost(data) {
        return new Promise((resolve, reject) => {
            if (typeof TL === 'undefined') {
                reject(new Error('TL not ready'));
                return;
            }
            const token = this.getToken();
            if (token && !TL.api_token) {
                // keep other modules compatible
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

    // ==================== Details / Domain ====================
    async loadDetails() {
        const rsp = await this.apiPost({ action: 'details' });
        if (!rsp || rsp.status !== 1 || !rsp.data) {
            throw new Error('invalid details response');
        }

        this.isInit = true;
        this.key = rsp.data.key;
        // 规范化 domain 值：将 "0" 字符串、null、undefined 都转为数字 0
        const rawDomain = rsp.data.domain;
        this.domain = (rawDomain && rawDomain !== '0' && rawDomain !== 0) ? rawDomain : 0;
        this.quota = rsp.data.quota;
        this.quota_free = rsp.data.quota_free;
        this.total_downloads = rsp.data.total_downloads;
        this.total_transfer = rsp.data.total_transfer;
        this.hp_time = parseInt(rsp.data.hp_time || '0', 10);
        this.ssl_auto = rsp.data.ssl_auto === 'yes';
        this.traffic_limit = rsp.data.traffic_limit;
        this.ssl = rsp.data.ssl_status === 'yes';
        this.ssl_acme = (rsp.data.ssl_acme === 'yes' || rsp.data.ssl_acme === 'enable' || rsp.data.ssl_acme === true);

        // branding (optional fields)
        this.brand_logo_id = (rsp.data.brand_logo_id != null) ? String(rsp.data.brand_logo_id) : '0';
        this.brand_title = (rsp.data.brand_title != null) ? String(rsp.data.brand_title) : '0';
        this.brand_content = (rsp.data.brand_content != null) ? String(rsp.data.brand_content) : '0';
        this.brand_status = (rsp.data.brand_status != null) ? String(rsp.data.brand_status) : '';

        this.protocol = this.ssl ? 'https://' : 'http://';

        return rsp;
    },

    applyDetailsToUI() {
        const domainText = document.getElementById('vx-direct-domain-text');
        const lock = document.getElementById('vx-direct-domain-lock');
        if (domainText) {
            const noDomainText = (typeof app !== 'undefined' && app.languageData && app.languageData.direct_no_domain)
                ? app.languageData.direct_no_domain
                : '未绑定域名';
            if (this.domain && this.domain !== 0) {
                domainText.textContent = String(this.domain);
                // prevent i18n from overriding actual domain
                domainText.removeAttribute('data-tpl');
            } else {
                domainText.textContent = noDomainText;
                domainText.setAttribute('data-tpl', 'direct_no_domain');
            }
        }
        if (lock) {
            lock.style.display = this.ssl ? '' : 'none';
        }

        // stats
        const quotaEl = document.getElementById('vx-direct-quota');
        const transferEl = document.getElementById('vx-direct-total-transfer');
        const dlEl = document.getElementById('vx-direct-total-downloads');
        if (quotaEl) quotaEl.textContent = this.formatBytes(this.quota, true);
        if (transferEl) transferEl.textContent = this.formatBytes(this.total_transfer, true);
        if (dlEl) dlEl.textContent = String(this.total_downloads || 0);

        // api key
        const keyEl = document.getElementById('vx-direct-api-key');
        if (keyEl) {
            keyEl.textContent = (this.key && this.key !== 0) ? String(this.key) : '-';
        }

        // api base (legacy/CLI docs)
        const baseEl = document.getElementById('vx-direct-api-base');
        if (baseEl) {
            baseEl.textContent = 'https://tmp-api.vx-cdn.com';
        }

        // sponsor free quota button visibility
        const freeBtn = document.getElementById('vx-direct-free-quota-btn');
        if (freeBtn) {
            freeBtn.style.display = (typeof TL !== 'undefined' && TL.api_pay) ? '' : 'none';
        }

        // domain input defaults
        const domainInput = document.getElementById('vx-direct-domain-input');
        if (domainInput && this.domain && this.domain !== 0) {
            domainInput.value = String(this.domain);
        }

        // ssl radio
        const sslYes = document.querySelector('input[name="vx-direct-ssl"][value="yes"]');
        const sslNo = document.querySelector('input[name="vx-direct-ssl"][value="no"]');
        if (sslYes && sslNo) {
            if (this.ssl) {
                sslYes.checked = true;
            } else {
                sslNo.checked = true;
            }
        }

        // disable SSL button
        const disableSSLBtn = document.getElementById('vx-direct-disable-ssl');
        if (disableSSLBtn) {
            disableSSLBtn.style.display = this.ssl ? '' : 'none';
        }

        // traffic limit
        const tlEl = document.getElementById('vx-direct-traffic-limit');
        if (tlEl) tlEl.value = String(this.traffic_limit || 0);

        this.applyBrandToUI();

        this.applyGateUI();

        this.startReadyTimer();
        this.checkDomainAndQuotaNotices();
    },

    // ==================== Quota ====================
    openQuotaPurchase() {
        // 导航到商店页面并传递参数打开配额购买
        if (typeof VXUI !== 'undefined' && typeof VXUI.navigate === 'function') {
            VXUI.navigate('shop', { action: 'quota' });
            return;
        }
        VXUI.toastWarning('无法打开购买页面');
    },

    openBrandSettings() {
        this.showTab('domain');
        setTimeout(() => {
            const el = document.getElementById('vx-direct-brand-card');
            if (el && typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 50);
    },

    // ==================== Branding ====================
    getBrandLogoUrl() {
        if (!this.brand_logo_id || this.brand_logo_id === '0') return '';
        return `https://tmp-static.vx-cdn.com/static/logo?id=${encodeURIComponent(String(this.brand_logo_id))}`;
    },

    applyBrandToUI() {
        const preview = document.getElementById('vx-direct-brand-logo-preview');
        const titleEl = document.getElementById('vx-direct-brand-title');
        const contentEl = document.getElementById('vx-direct-brand-content');
        const statusEl = document.getElementById('vx-direct-brand-status');
        if (titleEl) titleEl.value = (this.brand_title && this.brand_title !== '0') ? this.brand_title : '';
        if (contentEl) contentEl.value = (this.brand_content && this.brand_content !== '0') ? this.brand_content : '';

        if (statusEl) statusEl.textContent = this.brandStatusText(this.brand_status);

        if (preview) {
            const url = this.getBrandLogoUrl();
            if (url) {
                preview.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit: cover;" />`;
            } else {
                preview.innerHTML = '<iconpark-icon name="image" style="font-size: 28px; color: var(--vx-text-muted);"></iconpark-icon>';
            }
        }
    },

    brandStatusText(status) {
        const s = String(status || '').toLowerCase();
        // 使用翻译系统获取状态文本
        const lang = (typeof app !== 'undefined' && app.languageData) ? app.languageData : {};
        switch (s) {
            case 'ok':
                return lang['brand_status_ok'] || '已通过';
            case 'reject':
                return lang['brand_status_reject'] || '已拒绝';
            case 'wait':
                return lang['brand_status_wait'] || '待提交';
            case 'review':
                return lang['brand_status_review'] || '审核中';
            default:
                return '-';
        }
    },

    brandLogoSet(inputEl) {
        const msgEl = document.getElementById('vx-direct-brand-logo-msg');
        const file = inputEl?.files?.[0];
        if (!file) return;

        this.trackUI('vui_direct[brand_logo_set]');
        const token = this.getToken();
        if (!token) {
            VXUI.toastError('登录状态无效');
            setTimeout(() => {
                app.open('/login');
            }, 300);
            return;
        }

        if (msgEl) msgEl.textContent = '上传中...';

        const formData = new FormData();
        formData.append('action', 'brand_set_logo');
        formData.append('token', token);
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        const apiUrl = (typeof TL !== 'undefined' && TL.api_direct) ? TL.api_direct : '/api_v2/direct';
        xhr.open('POST', apiUrl, true);
        xhr.onload = async () => {
            try {
                if (xhr.status !== 200) {
                    if (msgEl) msgEl.textContent = '上传失败';
                    VXUI.toastError('上传失败');
                    return;
                }
                const rsp = JSON.parse(xhr.responseText);
                if (rsp.status === 1) {
                    if (msgEl) msgEl.textContent = '上传成功';
                    VXUI.toastSuccess('上传成功');
                } else if (rsp.status === 2) {
                    if (msgEl) msgEl.textContent = '图片过大';
                    VXUI.toastWarning('图片过大');
                } else {
                    if (msgEl) msgEl.textContent = '图片无效';
                    VXUI.toastWarning('图片无效');
                }

                await this.loadDetails();
                this.applyDetailsToUI();
            } catch (e) {
                console.error(e);
                if (msgEl) msgEl.textContent = '上传失败';
                VXUI.toastError('上传失败');
            }
        };
        xhr.send(formData);
    },

    async brandSet() {
        const titleEl = document.getElementById('vx-direct-brand-title');
        const contentEl = document.getElementById('vx-direct-brand-content');
        const statusEl = document.getElementById('vx-direct-brand-save-status');

        const brand_title = String(titleEl?.value || '').trim();
        const brand_content = String(contentEl?.value || '').trim();

        if (!brand_title || !brand_content) {
            VXUI.toastWarning('品牌标题和描述不能为空');
            return;
        }

        this.trackUI('vui_direct[brand_set]');
        if (statusEl) statusEl.textContent = '保存中...';
        try {
            const rsp = await this.apiPost({
                action: 'brand_set',
                brand_title,
                brand_content
            });
            if (rsp && rsp.status === 1) {
                if (statusEl) statusEl.textContent = '已保存';
                VXUI.toastSuccess('已保存');
                await this.loadDetails();
                this.applyDetailsToUI();
            } else {
                if (statusEl) statusEl.textContent = '保存失败';
                VXUI.toastError('保存失败');
            }
        } catch (e) {
            console.error(e);
            if (statusEl) statusEl.textContent = '保存失败';
            VXUI.toastError('保存失败');
        }
    },

    async brandReview() {
        this.trackUI('vui_direct[brand_review]');
        try {
            const rsp = await this.apiPost({ action: 'brand_review' });
            if (rsp && rsp.status === 1) {
                VXUI.toastSuccess('已提交审核');
                await this.loadDetails();
                this.applyDetailsToUI();
            } else {
                VXUI.toastWarning('提交失败');
            }
        } catch (e) {
            console.error(e);
            VXUI.toastError('提交失败');
        }
    },


    startReadyTimer() {
        this.stopReadyTimer();

        const readyEl = document.getElementById('vx-direct-ready');
        const progressEl = document.getElementById('vx-direct-progress');
        const bar = document.getElementById('vx-direct-progress-bar');
        if (!readyEl || !progressEl || !bar) return;

        const update = () => {
            if (this.hp_time < 1) {
                readyEl.style.display = '';
                progressEl.style.display = 'none';
                bar.style.width = '100%';
                this.stopReadyTimer();
                return;
            }

            readyEl.style.display = 'none';
            progressEl.style.display = '';

            let percent = 100;
            if (this.hp_time > 1) {
                percent = 100 - (this.hp_time / 300 * 100);
            }
            percent = Math.max(0, Math.min(100, percent));
            bar.style.width = percent + '%';
            this.hp_time -= 1;
        };

        update();
        this._readyTimer = setInterval(update, 1000);
    },

    stopReadyTimer() {
        if (this._readyTimer) {
            clearInterval(this._readyTimer);
            this._readyTimer = null;
        }
    },

    async checkDomainAndQuotaNotices() {
        const cnameNotice = document.getElementById('vx-direct-notice-cname');
        const quotaNotice = document.getElementById('vx-direct-notice-quota');

        if (cnameNotice) cnameNotice.style.display = 'none';
        if (quotaNotice) quotaNotice.style.display = 'none';

        if (!this.domain || this.domain === 0) return;

        // check domain cname
        try {
            const rsp = await this.apiPost({ action: 'check_domain' });
            if (rsp && rsp.status === 0) {
                if (cnameNotice) cnameNotice.style.display = '';
            }
        } catch (e) {
            // ignore
        }

        // quota low
        const low = (this.quota < (1024 * 1024 * 1024 * 5)) && (this.quota_free < (1024 * 1024 * 1024 * 5));
        if (low && quotaNotice) quotaNotice.style.display = '';
    },

    onDomainInput() {
        const domainInput = document.getElementById('vx-direct-domain-input');
        const err = document.getElementById('vx-direct-domain-error');
        const acmeHint = document.getElementById('vx-direct-domain-acme-hint');
        const cnameHint = document.getElementById('vx-direct-domain-cname-hint');
        const sslBox = document.getElementById('vx-direct-ssl-box');
        const acmeDomain = document.getElementById('vx-direct-acme-domain');
        const cnameDomain = document.getElementById('vx-direct-cname-domain');
        
        if (!domainInput) return;

        const domain = String(domainInput.value || '').trim();
        const enableSsl = document.querySelector('input[name="vx-direct-ssl"]:checked')?.value || 'no';
        
        // 隐藏所有提示
        if (err) err.style.display = 'none';
        if (acmeHint) acmeHint.style.display = 'none';
        if (cnameHint) cnameHint.style.display = 'none';

        if (domain.length === 0) return;

        // 如果域名是 *.5t-cdn.com 作为子域名，则不执行任何检查，也隐藏 SSL 选项
        if (domain.indexOf('.5t-cdn.com') !== -1) {
            // 不能是三级域名
            if (domain.split('.').length > 3) {
                if (err) {
                    err.textContent = '域名格式不正确';
                    err.style.display = '';
                }
                return;
            }
            // 隐藏 SSL 选项（5t-cdn.com 子域名不需要单独配置 SSL）
            if (sslBox) sslBox.style.display = 'none';
            return;
        }

        // 显示 SSL 选项
        if (sslBox) sslBox.style.display = '';

        // 域名格式验证
        const reg = /^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?$/;
        if (!reg.test(domain)) {
            if (err) {
                err.textContent = '域名格式不正确';
                err.style.display = '';
            }
            return;
        }

        // 更新动态域名显示
        if (acmeDomain) acmeDomain.textContent = `_acme-challenge.${domain}`;
        if (cnameDomain) cnameDomain.textContent = domain;

        // 如果启用 SSL，显示 ACME DNS 提示
        if (enableSsl === 'yes') {
            if (acmeHint) acmeHint.style.display = '';
        }
        
        // 始终显示 CNAME 提示
        if (cnameHint) cnameHint.style.display = '';
    },

    showCloudflareNotice() {
        VXUI.alert({
            title: 'Cloudflare 用户注意',
            message: `<p>如果您使用 Cloudflare 管理域名，请使用二级域名作为直链域名。</p>
                      <p>例如：如果您的域名是 <span class="vx-text-primary">abc.com</span>，您应该使用 <span class="vx-text-primary">download.abc.com</span> 作为直链域名。</p>
                      <p>此外，请勿为该域名启用 HTTP 代理（橙色云朵），否则会降低下载速度。</p>`
        });
    },

    async saveDomain() {
        const domainInput = document.getElementById('vx-direct-domain-input');
        const err = document.getElementById('vx-direct-domain-error');
        if (!domainInput) return;

        const domain = String(domainInput.value || '').trim();
        if (!domain) {
            if (err) {
                err.textContent = '请输入域名';
                err.style.display = '';
            }
            return;
        }

        this.trackUI('vui_direct[save_domain]');
        const sslEnable = document.querySelector('input[name="vx-direct-ssl"]:checked')?.value || 'no';

        this.showLoading();
        try {
            const rsp = await this.apiPost({
                action: 'direct_set_domain',
                domain,
                ssl_enable: sslEnable
            });

            if (!rsp) {
                VXUI.toastError('保存失败');
                return;
            }

            if (rsp.status === 1) {
                VXUI.toastSuccess('保存成功');
                await this.loadDetails();
                this.applyDetailsToUI();
                if (this.domain && this.domain !== 0) {
                    this.showTab('dashboard');
                }
            } else {
                const msg = this.selectBingDomainText(rsp.status);
                VXUI.toastWarning(msg);
            }
        } catch (e) {
            console.error(e);
            VXUI.toastError('保存失败');
        } finally {
            this.hideLoading();
        }
    },

    async disableSSL() {
        if (!this.ssl && !this.ssl_acme) return;
        this.trackUI('vui_direct[disable_ssl]');
        VXUI.confirm({
            title: '停用 HTTPS',
            message: '确定要停用 HTTPS 吗？停用后直链将使用 HTTP。',
            confirmClass: 'vx-btn-danger',
            onConfirm: async () => {
                this.showLoading();
                try {
                    await this.apiPost({ action: 'direct_disable_ssl' });
                    await this.loadDetails();
                    this.applyDetailsToUI();
                    VXUI.toastSuccess('已停用 HTTPS');
                } catch (e) {
                    console.error(e);
                    VXUI.toastError('操作失败');
                } finally {
                    this.hideLoading();
                }
            }
        });
    },

    async saveTrafficLimit() {
        const el = document.getElementById('vx-direct-traffic-limit');
        if (!el) return;
        const val = parseInt(String(el.value || '0'), 10);
        const safe = Number.isFinite(val) && val >= 0 ? val : 0;
        try {
            await this.apiPost({ action: 'set_traffic_limit', val: safe });
            VXUI.toastSuccess('已保存');
            this.traffic_limit = safe;
        } catch (e) {
            console.error(e);
            VXUI.toastError('保存失败');
        }
    },

    // ==================== Usage Chart ====================
    async loadUsage(rt = 5) {
        this.usageRt = rt;
        this.updateUsageButtons();
        const container = document.getElementById('vx-direct-usage-chart');
        if (!container) return;

        if (typeof ApexCharts === 'undefined') {
            container.innerHTML = '<div class="vx-text-muted">ApexCharts 未加载</div>';
            return;
        }

        try {
            const rsp = await this.apiPost({ action: 'chart_get_usage', rt: rt });
            const { traffic, time } = this.normalizeUsageData(rsp);
            const spec = this.getUsageSpec(rt);
            const normalized = this.applyUsageSpec(traffic, time, spec.rows);

            if (this.usageChart && typeof this.usageChart.destroy === 'function') {
                try {
                    this.usageChart.destroy();
                } catch (e) {
                    // ignore
                }
                this.usageChart = null;
            }

            const ld = (typeof app !== 'undefined' && app.languageData) ? app.languageData : {};
            const denseView = spec.rows > 12;
            let options = {
                series: [{
                    name: ld.direct_total_transfer || '传输',
                    data: normalized.traffic
                }],
                chart: {
                    height: 200,
                    type: 'bar',
                    toolbar: { show: false }
                },
                plotOptions: {
                    bar: {
                        borderRadius: 10,
                        dataLabels: { position: 'top' }
                    }
                },
                tooltip: {
                    enabled: denseView,
                    y: {
                        formatter: (val) => (typeof bytetoconver === 'function' ? bytetoconver(val, true) : this.formatBytes(val, true))
                    }
                },
                dataLabels: {
                    enabled: !denseView,
                    formatter: (val) => (typeof bytetoconver === 'function' ? bytetoconver(val, true) : this.formatBytes(val, true)),
                    offsetY: -20,
                    style: {
                        fontSize: '12px',
                        colors: ['#304758']
                    }
                },
                xaxis: {
                    categories: normalized.time,
                    tickAmount: denseView ? 6 : (spec.rows - 1),
                    position: 'top',
                    axisBorder: { show: false },
                    axisTicks: { show: false },
                    labels: {
                        formatter: (val) => this.formatUsageLabel(val, spec.timeFormat),
                        rotate: 0,
                        hideOverlappingLabels: true,
                        trim: true
                    },
                    crosshairs: {
                        fill: {
                            type: 'gradient',
                            gradient: {
                                colorFrom: '#D8E3F0',
                                colorTo: '#BED1E6',
                                stops: [0, 100],
                                opacityFrom: 0.4,
                                opacityTo: 0.5
                            }
                        }
                    },
                    tooltip: { enabled: false }
                },
                yaxis: {
                    axisBorder: { show: false },
                    axisTicks: { show: false },
                    labels: { show: !denseView }
                },
                title: {
                    floating: true,
                    offsetY: 330,
                    align: 'center',
                    style: { color: '#444' }
                }
            };

            if (typeof getChartThemeOptions === 'function') {
                options = getChartThemeOptions(options);
            }

            this.usageChart = new ApexCharts(container, options);
            await this.usageChart.render();
        } catch (e) {
            console.error('[VX_DIRECT] loadUsage error', e);
            container.innerHTML = '<div class="vx-text-muted">加载统计失败</div>';
        }
    },

    updateUsageButtons() {
        const buttons = document.querySelectorAll('.vx-direct-usage-btn');
        if (!buttons || !buttons.length) return;
        buttons.forEach((btn) => {
            const rt = Number(btn.getAttribute('data-rt'));
            const active = rt === Number(this.usageRt);
            btn.classList.toggle('vx-btn-primary', active);
            btn.classList.toggle('vx-btn-ghost', !active);
        });
    },

    getUsageSpec(rt) {
        const table = {
            0: { rows: 6, timeFormat: 'H:i' },
            1: { rows: 12, timeFormat: 'H:i' },
            2: { rows: 12, timeFormat: 'H' },
            3: { rows: 12, timeFormat: 'm-d' },
            4: { rows: 12, timeFormat: 'm-d' },
            5: { rows: 30, timeFormat: 'm-d' }
        };
        return table[Number(rt)] || table[5];
    },

    applyUsageSpec(traffic, time, rows) {
        let t = Array.isArray(traffic) ? [...traffic] : [];
        let x = Array.isArray(time) ? [...time] : [];

        if (rows && t.length > rows) {
            t = t.slice(-rows);
        }
        if (rows && x.length > rows) {
            x = x.slice(-rows);
        }

        const maxLen = Math.max(t.length, x.length);
        if (t.length < maxLen) t = t.concat(new Array(maxLen - t.length).fill(0));
        if (x.length < maxLen) x = x.concat(new Array(maxLen - x.length).fill(''));

        if (rows && maxLen < rows) {
            const pad = rows - maxLen;
            t = new Array(pad).fill(0).concat(t);
            x = new Array(pad).fill('').concat(x);
        }

        return { traffic: t, time: x };
    },

    formatUsageLabel(val, format) {
        if (val === undefined || val === null) return '';
        const raw = String(val).trim();
        if (!raw) return '';
        if (raw.includes(':') || raw.includes('-')) return raw;

        let ts = Number(raw);
        if (!Number.isFinite(ts)) return raw;
        if (ts < 1e12) ts *= 1000; // seconds -> ms
        const d = new Date(ts);
        if (Number.isNaN(d.getTime())) return raw;

        const pad = (n) => String(n).padStart(2, '0');
        switch (format) {
            case 'H:i':
                return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
            case 'H':
                return `${pad(d.getHours())}`;
            case 'm-d':
                return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            default:
                return raw;
        }
    },

    normalizeUsageData(rsp) {
        const parseMaybeJson = (val) => {
            if (typeof val !== 'string') return val;
            const trimmed = val.trim();
            if (!trimmed) return val;
            if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
                try {
                    return JSON.parse(trimmed);
                } catch (e) {
                    return val;
                }
            }
            return val;
        };

        let trafficRaw = parseMaybeJson(rsp?.data?.traffic ?? []);
        let timeRaw = parseMaybeJson(rsp?.data?.time ?? []);

        const parseValue = (val) => {
            if (val === undefined || val === null) return 0;
            if (typeof val === 'number' && Number.isFinite(val)) return val;
            const str = String(val).trim();
            if (!str) return 0;
            const directNum = Number(str);
            if (Number.isFinite(directNum)) return directNum;

            const match = str.match(/([\d.]+)\s*(B|KB|MB|GB|TB|PB)?/i);
            if (!match) return 0;
            const num = parseFloat(match[1]);
            const unit = (match[2] || 'B').toUpperCase();
            const units = { B: 0, KB: 1, MB: 2, GB: 3, TB: 4, PB: 5 };
            const power = units[unit] ?? 0;
            return Number.isFinite(num) ? num * Math.pow(1024, power) : 0;
        };

        let traffic = [];
        let time = [];

        if (Array.isArray(trafficRaw)) {
            if (trafficRaw.length && Array.isArray(trafficRaw[0])) {
                trafficRaw.forEach((pair) => {
                    time.push(String(pair?.[0] ?? ''));
                    traffic.push(parseValue(pair?.[1]));
                });
            } else if (trafficRaw.length && typeof trafficRaw[0] === 'object') {
                trafficRaw.forEach((item) => {
                    const label = item?.time ?? item?.t ?? item?.date ?? item?.label;
                    if (label !== undefined) time.push(String(label));
                    traffic.push(parseValue(item?.val ?? item?.value ?? item?.size ?? item?.traffic));
                });
            } else {
                traffic = trafficRaw.map(parseValue);
            }
        } else if (typeof trafficRaw === 'string') {
            const parts = trafficRaw.split(',').map((s) => s.trim()).filter(Boolean);
            traffic = parts.map(parseValue);
        } else if (trafficRaw && typeof trafficRaw === 'object') {
            Object.keys(trafficRaw).forEach((key) => {
                time.push(String(key));
                traffic.push(parseValue(trafficRaw[key]));
            });
        }

        if (typeof timeRaw === 'string') {
            const parts = timeRaw.split(',').map((s) => s.trim()).filter(Boolean);
            if (parts.length) time = parts;
        } else if (Array.isArray(timeRaw) && timeRaw.length) {
            if (!time.length) {
                time = timeRaw.map((t) => String(t));
            } else if (timeRaw.length === traffic.length) {
                time = timeRaw.map((t) => String(t));
            }
        }

        if (!traffic.length && time.length) {
            traffic = new Array(time.length).fill(0);
        }

        if (traffic.length < time.length) {
            traffic = traffic.concat(new Array(time.length - traffic.length).fill(0));
        } else if (time.length < traffic.length) {
            time = time.concat(
                new Array(traffic.length - time.length)
                    .fill(0)
                    .map((_, idx) => String(time.length + idx + 1))
            );
        }

        return { traffic, time };
    },

    // ==================== Lists ====================
    loadCurrentTab(reset = false) {
        if (this.activeTab === 'dashboard') {
            this.applyGateUI();
            if (this.domain && this.domain !== 0) {
                this.loadUsage(this.usageRt).catch(() => { /* ignore */ });
                // 预加载文件和文件夹数据用于统计显示
                this.preloadData();
            }
            this.updateStats();
        } else if (this.activeTab === 'files') {
            this.applyGateUI();
            this.loadFiles(reset);
        } else if (this.activeTab === 'folders') {
            this.applyGateUI();
            this.loadFolders(reset);
        } else if (this.activeTab === 'api') {
            this.applyGateUI();
            // no-op (details already applied)
        } else if (this.activeTab === 'domain') {
            this.applyGateUI();
            // no-op
        }

        // Selection bar should only appear on files page
        if (this.activeTab !== 'files') {
            const bar = document.getElementById('vx-direct-selection-bar');
            if (bar) bar.style.display = 'none';
        }
    },

    /**
     * 预加载文件和文件夹数据
     * 在仪表盘加载时调用，用于统计显示和后续Tab切换时复用
     */
    async preloadData() {
        if (this.domain === 0) return;

        // 并行预加载文件和文件夹数据
        const promises = [];

        // 预加载文件（只加载第一页用于统计）
        if (!this.filesPreloaded) {
            promises.push(this.preloadFiles());
        }

        // 预加载文件夹
        if (!this.foldersPreloaded) {
            promises.push(this.preloadFolders());
        }

        if (promises.length > 0) {
            await Promise.all(promises).catch(e => {
                console.error('[VX_DIRECT] preloadData error:', e);
            });
            this.updateStats();
        }
    },

    /**
     * 预加载文件列表（第一页）
     */
    async preloadFiles() {
        try {
            const sort_by = this.fileSorter ? this.fileSorter.currentBy : 0;
            const sort_type = this.fileSorter ? this.fileSorter.currentType : 0;

            const rsp = await this.apiPost({
                action: 'filelist_page',
                page: 0,
                sort_by,
                sort_type,
                search: ''
            });

            if (rsp && rsp.status === 1) {
                this.files = rsp.data || [];
                this.pageNumber = 0;
                this.hasMore = (rsp.data || []).length > 0;
                this.filesPreloaded = true;
            }
        } catch (e) {
            console.error('[VX_DIRECT] preloadFiles error:', e);
        }
    },

    /**
     * 预加载文件夹列表
     */
    async preloadFolders() {
        try {
            const rsp = await this.apiPost({ action: 'room_list' });
            if (rsp && rsp.status === 1) {
                this.folders = rsp.data || [];
                this.foldersPreloaded = true;
            }
        } catch (e) {
            console.error('[VX_DIRECT] preloadFolders error:', e);
        }
    },

    load() {
        // Backward compatibility
        this.loadCurrentTab(true);
    },

    async loadFiles(reset = false) {
        if (this.domain === 0) {
            this.renderFiles();
            return;
        }

        // 如果有预加载缓存且不是强制重置，直接使用缓存数据渲染
        if (this.filesPreloaded && !reset && this.pageNumber === 0 && !this.search) {
            this.renderFiles();
            return;
        }

        if (reset) {
            this.pageNumber = 0;
            this.hasMore = true;
            this.files = [];
            this.selectedItems.clear();
            this.filesPreloaded = false; // 重置时清除缓存标志
            // do NOT force isLoading=false here; that can allow concurrent
            // requests to append duplicate data.
        }

        const seq = ++this.filesReqSeq;
        if (this.isLoading && !reset) return;
        this.isLoading = true;

        try {
            const sort_by = this.fileSorter ? this.fileSorter.currentBy : 0;
            const sort_type = this.fileSorter ? this.fileSorter.currentType : 0;

            const rsp = await this.apiPost({
                action: 'filelist_page',
                page: this.pageNumber,
                sort_by,
                sort_type,
                search: this.search || ''
            });

            if (seq !== this.filesReqSeq) return; // stale response

            if (rsp && rsp.status === 1) {
                const data = rsp.data || [];
                // Deduplicate by direct_key to avoid duplicated rows
                const existing = new Set((this.files || []).map(it => String(it.direct_key)));
                const toAdd = data.filter(it => {
                    const k = String(it && it.direct_key);
                    if (!k || existing.has(k)) return false;
                    existing.add(k);
                    return true;
                });
                this.files = [...this.files, ...toAdd];
                this.hasMore = data.length > 0;
                // 标记已加载（用于后续tab切换）
                if (this.pageNumber === 0 && !this.search) {
                    this.filesPreloaded = true;
                }
            } else {
                this.hasMore = false;
            }

            this.renderFiles();
            this.updateStats(); // 刷新后更新统计
        } catch (e) {
            console.error('[VX_DIRECT] loadFiles error:', e);
            VXUI.toastError('加载失败');
        } finally {
            if (seq === this.filesReqSeq) {
                this.isLoading = false;
            }
        }
    },

    loadMore() {
        if (this.activeTab !== 'files') return;
        if (this.isLoading || !this.hasMore) return;
        this.pageNumber += 1;
        this.loadFiles(false);
    },

    async loadFolders(reset = false) {
        if (this.domain === 0) {
            this.renderFolders();
            return;
        }

        // 如果有预加载缓存且不是强制重置，直接使用缓存数据渲染
        if (this.foldersPreloaded && !reset) {
            this.renderFolders();
            return;
        }

        if (reset) {
            this.folders = [];
            this.foldersPreloaded = false; // 重置时清除缓存标志
        }

        const seq = ++this.foldersReqSeq;

        try {
            const rsp = await this.apiPost({ action: 'room_list' });
            if (seq !== this.foldersReqSeq) return; // stale response
            if (rsp && rsp.status === 1) {
                this.folders = rsp.data || [];
                this.foldersPreloaded = true; // 标记已加载
            } else {
                this.folders = [];
            }
            this.renderFolders();
            this.updateStats(); // 刷新后更新统计
        } catch (e) {
            console.error('[VX_DIRECT] loadFolders error:', e);
            VXUI.toastError('加载失败');
        }
    },

    // ==================== Render (Files) ====================
    formatTime(timeStr) {
        if (!timeStr) return '--';
        if (typeof timeStr === 'string' && timeStr.length >= 16) {
            return timeStr.substring(0, 16);
        }
        return timeStr;
    },

    formatDateOnly(timeStr) {
        if (!timeStr) return '--';
        if (typeof timeStr === 'string' && timeStr.length >= 10) {
            return timeStr.substring(0, 10);
        }
        return timeStr;
    },

    renderFiles() {
        if (this.fileSorter) this.fileSorter.updateIcons();

        const container = document.getElementById('vx-direct-files-list');
        const body = document.getElementById('vx-direct-files-list-body');
        const empty = document.getElementById('vx-direct-files-empty');
        if ((!container && !body) || !empty) return;

        const listContainer = container;
        const listBody = body || container;

        if (!this.domain || this.domain === 0) {
            if (listBody) listBody.innerHTML = '';
            empty.style.display = '';
            if (listContainer) listContainer.style.display = 'none';
            this.updateStats();
            return;
        }

        if (!this.files || this.files.length === 0) {
            if (listBody) listBody.innerHTML = '';
            empty.style.display = '';
            if (listContainer) listContainer.style.display = 'none';
            this.updateStats();
            return;
        }

        empty.style.display = 'none';

        if (listContainer) listContainer.style.display = '';
        listBody.innerHTML = '';
        for (const item of this.files) {
            listBody.appendChild(this.createDirectFileRow(item));
        }

        this.updateSelectionUI();
        this.updateStats();
        
        // 初始化文件名滚动效果
        this.initFilenameScroll();
    },

    createDirectFileRow(item) {
        const directKey = item.direct_key;
        const fileName = item.fname || '未命名文件';
        const fileSize = item.fsize_formated || this.formatBytes(item.fsize || 0, true);
        const createTime = item.ctime || '--';
        const icon = (typeof TL !== 'undefined' && typeof TL.fileicon === 'function')
            ? TL.fileicon(item.ftype)
            : 'file';
        const filenameEncoded = encodeURIComponent(fileName);
        const directLink = this.genLinkDirect(directKey, filenameEncoded).download;
        const isSelected = this.selectedItems.has(String(directKey));

        const row = document.createElement('div');
        row.className = 'vx-list-row' + (isSelected ? ' selected' : '');
        row.dataset.id = String(directKey);
        row.dataset.type = 'file';
        row.innerHTML = `
            <div class="vx-list-checkbox" onclick="event.stopPropagation(); VX_DIRECT.toggleItemSelect(this.parentNode)"></div>
            <div class="vx-list-name">
                <div class="vx-list-icon vx-icon-file">
                    <iconpark-icon name="${this.escapeAttr(icon)}"></iconpark-icon>
                </div>
                <div class="vx-list-filename">
                    <a href="javascript:;" onclick="event.stopPropagation(); VX_DIRECT.openUrl('${this.escapeAttr(directLink)}')">${this.escapeHtml(fileName)}</a>
                </div>
            </div>
            <div class="vx-list-size">${this.escapeHtml(fileSize)}</div>
            <div class="vx-list-date vx-hide-mobile" title="${this.formatTime(createTime)}">${this.formatDateOnly(createTime)}</div>
            <div class="vx-list-actions">
                <button class="vx-list-action-btn" onclick="event.stopPropagation(); VX_DIRECT.copyUrl('${this.escapeAttr(directLink)}')" title="复制链接">
                    <iconpark-icon name="copy"></iconpark-icon>
                </button>
                <button class="vx-list-action-btn" onclick="event.stopPropagation(); VX_DIRECT.openUrl('${this.escapeAttr(directLink)}')" title="打开">
                    <iconpark-icon name="link"></iconpark-icon>
                </button>
                <button class="vx-list-action-btn" onclick="event.stopPropagation(); VX_DIRECT.openUrl('${this.escapeAttr(directLink)}')" title="下载">
                    <iconpark-icon name="cloud-arrow-down"></iconpark-icon>
                </button>
                <button class="vx-list-action-btn vx-action-danger" onclick="event.stopPropagation(); VX_DIRECT.deleteLink('${String(directKey)}')" title="删除">
                    <iconpark-icon name="trash"></iconpark-icon>
                </button>
                <!-- Mobile More Button -->
                <button class="vx-list-action-btn vx-more-btn" onclick="event.stopPropagation(); VX_DIRECT.openMoreMenu(event, '${String(directKey)}', '${this.escapeAttr(directLink)}')" title="更多">
                    <iconpark-icon name="ellipsis"></iconpark-icon>
                </button>
            </div>
        `;
        return row;
    },

    /**
     * 打开更多菜单 (移动端)
     */
    openMoreMenu(event, directKey, directLink) {
        // 使用系统的 Action Sheet 风格菜单
        if (typeof VXUI !== 'undefined' && VXUI.showActionSheet) {
            VXUI.showActionSheet('操作', [
                { text: '复制链接', icon: 'copy', action: () => this.copyUrl(directLink) },
                { text: '下载', icon: 'cloud-arrow-down', action: () => this.openUrl(directLink) },
                { text: '删除', icon: 'trash', danger: true, action: () => this.deleteLink(directKey) }
            ]);
        } else {
            // 兜底：如果 VXUI 没有封装 ActionSheet，则使用简单的自定义菜单或 alert
            // 这里我们动态创建一个简单的菜单遮罩
            this.showCustomActionSheet(directKey, directLink);
        }
    },

    /**
     * 打开文件夹更多菜单 (移动端)
     */
    openFolderMoreMenu(event, directKey, mrid, link) {
        if (typeof VXUI !== 'undefined' && VXUI.showActionSheet) {
            VXUI.showActionSheet('操作', [
                { text: '打开文件夹', icon: 'folder-open-e1ad2j7l', action: () => VXUI.navigate('filelist', { mrid: String(mrid), view: 'list' }) },
                { text: '打开直链', icon: 'circle-location-arrow', action: () => this.openUrl(link) },
                { text: '复制直链', icon: 'copy', action: () => this.copyUrl(link) },
                { text: '删除', icon: 'trash', danger: true, action: () => this.deleteRoom(directKey) }
            ]);
        }
    },

    /**
     * 自定义简单 Action Sheet (兜底)
     */
    showCustomActionSheet(directKey, directLink) {
        const id = 'vx-direct-action-sheet';
        let sheet = document.getElementById(id);
        if (sheet) document.body.removeChild(sheet);

        sheet = document.createElement('div');
        sheet.id = id;
        sheet.className = 'vx-modal-overlay';
        sheet.style.zIndex = '2000';
        sheet.style.display = 'flex';
        sheet.style.alignItems = 'flex-end';
        sheet.style.justifyContent = 'center';
        sheet.onclick = (e) => { if(e.target === sheet) document.body.removeChild(sheet); };

        sheet.innerHTML = `
            <div style="background:var(--vx-surface); width:100%; max-width:600px; border-radius:20px 20px 0 0; overflow:hidden; box-shadow:0 -10px 40px rgba(0,0,0,0.2); animation: slideUp 0.3s ease;">
                 <div style="padding:16px; border-bottom:1px solid var(--vx-border);">
                    <div style="font-weight:600; text-align:center;">操作</div>
                 </div>
                 <div style="padding:10px 16px;">
                    <button class="vx-btn vx-btn-ghost vx-btn-block" style="justify-content:flex-start; height:50px;" onclick="VX_DIRECT.copyUrl('${directLink}'); document.getElementById('${id}').remove()">
                        <iconpark-icon name="copy" style="font-size:20px; margin-right:12px;"></iconpark-icon> 复制链接
                    </button>
                    <button class="vx-btn vx-btn-ghost vx-btn-block" style="justify-content:flex-start; height:50px;" onclick="VX_DIRECT.openUrl('${directLink}'); document.getElementById('${id}').remove()">
                        <iconpark-icon name="link" style="font-size:20px; margin-right:12px;"></iconpark-icon> 打开/下载
                    </button>
                    <button class="vx-btn vx-btn-ghost vx-btn-block vx-text-danger" style="justify-content:flex-start; height:50px;" onclick="VX_DIRECT.deleteLink('${directKey}'); document.getElementById('${id}').remove()">
                        <iconpark-icon name="trash" style="font-size:20px; margin-right:12px;"></iconpark-icon> 删除
                    </button>
                 </div>
                 <div style="padding:10px 16px 30px; background:var(--vx-bg-secondary);">
                    <button class="vx-btn vx-btn-secondary vx-btn-block" onclick="document.getElementById('${id}').remove()">取消</button>
                 </div>
            </div>
            <style>@keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }</style>
        `;
        document.body.appendChild(sheet);
    },

    // ==================== Render (Folders) ====================
    renderFolders() {
        if (this.folderSorter) this.folderSorter.updateIcons();

        const container = document.getElementById('vx-direct-folders-list');
        const body = document.getElementById('vx-direct-folders-list-body');
        const empty = document.getElementById('vx-direct-folders-empty');
        if ((!container && !body) || !empty) return;

        const listContainer = container;
        const listBody = body || container;

        if (!this.domain || this.domain === 0) {
            if (listBody) listBody.innerHTML = '';
            empty.style.display = '';
            if (listContainer) listContainer.style.display = 'none';
            this.updateStats();
            return;
        }

        if (!this.folders || this.folders.length === 0) {
            if (listBody) listBody.innerHTML = '';
            empty.style.display = '';
            if (listContainer) listContainer.style.display = 'none';
            this.updateStats();
            return;
        }

        empty.style.display = 'none';
        
        // Sorting Logic
        if (this.folderSorter) {
             this.folders = this.folderSorter.sortArray(this.folders, {
                 0: (f) => parseInt(f.ctime || 0),
                 1: (f) => (f.name || '').toLowerCase(),
                 2: (f) => parseInt(f.size || f.count || 0)
             });
        }

        if (listContainer) listContainer.style.display = '';
        listBody.innerHTML = '';
        for (const item of this.folders) {
            listBody.appendChild(this.createDirectFolderRow(item));
        }
        
        this.updateStats();
        
        // 初始化文件名滚动效果
        this.initFilenameScroll();
    },

    createDirectFolderRow(item) {
        const directKey = item.direct_key;
        const name = item.name || '未命名文件夹';
        const createTime = item.ctime || '--';
        const mrid = item.mrid;
        const link = `${this.protocol}${this.domain}/share/${directKey}/`;

        const isSelected = this.selectedFolders.has(String(directKey));
        const row = document.createElement('div');
        row.className = 'vx-list-row' + (isSelected ? ' selected' : '');
        row.dataset.id = String(directKey);
        row.dataset.type = 'folder';
        row.innerHTML = `
            <div class="vx-list-checkbox" onclick="event.stopPropagation(); VX_DIRECT.toggleFolderSelect('${String(directKey)}')"></div>
            <div class="vx-list-name">
                <div class="vx-list-icon vx-icon-folder">
                    <iconpark-icon name="folder-open-e1ad2j7l"></iconpark-icon>
                </div>
                <div class="vx-list-filename">
                    <a href="javascript:;" onclick="event.stopPropagation(); VXUI.navigate('filelist', { mrid: '${String(mrid)}', view: 'list' })">${this.escapeHtml(name)}</a>
                </div>
            </div>
            <div class="vx-list-size"><span class="vx-type-folder">文件夹</span></div>
            <div class="vx-list-date vx-hide-mobile" title="${this.formatTime(createTime)}">${this.formatDateOnly(createTime)}</div>
            <div class="vx-list-actions">
                <button class="vx-list-action-btn" onclick="event.stopPropagation(); VXUI.navigate('filelist', { mrid: '${String(mrid)}', view: 'list' })" title="打开文件夹">
                    <iconpark-icon name="folder-open-e1ad2j7l"></iconpark-icon>
                </button>
                <button class="vx-list-action-btn" onclick="event.stopPropagation(); VX_DIRECT.openUrl('${this.escapeAttr(link)}')" title="打开直链">
                    <iconpark-icon name="circle-location-arrow"></iconpark-icon>
                </button>
                <button class="vx-list-action-btn" onclick="event.stopPropagation(); VX_DIRECT.copyUrl('${this.escapeAttr(link)}')" title="复制直链">
                    <iconpark-icon name="copy"></iconpark-icon>
                </button>
                <button class="vx-list-action-btn vx-action-danger" onclick="event.stopPropagation(); VX_DIRECT.deleteRoom('${String(directKey)}')" title="删除">
                    <iconpark-icon name="trash"></iconpark-icon>
                </button>
                <!-- Mobile More Button -->
                <button class="vx-list-action-btn vx-more-btn" onclick="event.stopPropagation(); VX_DIRECT.openFolderMoreMenu(event, '${String(directKey)}', '${String(mrid)}', '${this.escapeAttr(link)}')" title="更多">
                    <iconpark-icon name="ellipsis"></iconpark-icon>
                </button>
            </div>
        `;

        row.onclick = () => {
            if (typeof VXUI !== 'undefined') {
                VXUI.navigate('filelist', { mrid: String(mrid), view: 'list' });
            }
        };

        return row;
    },
    
    /**
     * 切换选择
     */
    // ==================== Selection ====================
    toggleItemSelect(rowEl) {
        if (!rowEl) return;
        const id = rowEl.dataset && rowEl.dataset.id ? String(rowEl.dataset.id) : '';
        if (!id) return;
        this.toggleSelect(id);
    },

    toggleSelectAllFromHeader() {
        this.toggleSelectAll();
    },

    toggleSelect(id) {
        const key = String(id);
        if (this.selectedItems.has(key)) {
            this.selectedItems.delete(key);
        } else {
            this.selectedItems.add(key);
        }
        this.updateSelectionUI();
    },
    
    /**
     * 全选/取消全选
     */
    toggleSelectAll() {
        if (this.activeTab !== 'files') return;
        if (this.selectedItems.size === this.files.length) {
            this.selectedItems.clear();
        } else {
            this.files.forEach(item => this.selectedItems.add(String(item.direct_key)));
        }
        this.updateSelectionUI();
    },

    // ==================== Folder Selection ====================
    /**
     * 切换文件夹选择
     */
    toggleFolderSelect(id) {
        const key = String(id);
        if (this.selectedFolders.has(key)) {
            this.selectedFolders.delete(key);
        } else {
            this.selectedFolders.add(key);
        }
        this.updateFolderSelectionUI();
    },

    /**
     * 文件夹全选/取消全选
     */
    toggleFolderSelectAll() {
        if (this.activeTab !== 'folders') return;
        if (this.selectedFolders.size === this.folders.length) {
            this.selectedFolders.clear();
        } else {
            this.folders.forEach(item => this.selectedFolders.add(String(item.direct_key)));
        }
        this.updateFolderSelectionUI();
    },

    /**
     * 更新文件夹选择 UI
     */
    updateFolderSelectionUI() {
        if (this.activeTab !== 'folders') return;

        document.querySelectorAll('#vx-direct-folders-list-body .vx-list-row').forEach(row => {
            const id = String(row.dataset.id);
            row.classList.toggle('selected', this.selectedFolders.has(id));
        });

        // Update header select-all checkbox state
        const headerCb = document.getElementById('vx-direct-folder-select-all');
        if (headerCb) {
            headerCb.classList.remove('vx-checked', 'vx-indeterminate');
            const total = (this.folders || []).length;
            const selected = this.selectedFolders.size;
            if (total > 0 && selected === total) {
                headerCb.classList.add('vx-checked');
            } else if (selected > 0) {
                headerCb.classList.add('vx-indeterminate');
            }
        }

        this.updateFolderSelectionBar();
    },

    updateFolderSelectionBar() {
        const bar = document.getElementById('vx-direct-folder-selection-bar');
        const countEl = document.getElementById('vx-direct-folder-selected-count');
        if (!bar || !countEl) return;

        const count = this.selectedFolders.size;
        countEl.textContent = String(count);
        bar.style.display = count > 0 ? 'flex' : 'none';
    },

    clearFolderSelection() {
        this.selectedFolders.clear();
        this.updateFolderSelectionUI();
    },

    /**
     * 批量删除文件夹直链
     */
    deleteSelectedFolders() {
        if (this.selectedFolders.size === 0) {
            VXUI.toast('请先选择要删除的项目', 'warning');
            return;
        }
        const count = this.selectedFolders.size;
        VXUI.confirm({
            title: '批量删除',
            message: `确定要删除选中的 ${count} 个文件夹直链吗？删除后无法恢复。`,
            confirmClass: 'vx-btn-danger',
            onConfirm: () => this.doDeleteRooms([...this.selectedFolders])
        });
    },

    /**
     * 批量删除文件夹直链（实际执行）
     */
    async doDeleteRooms(keys) {
        if (!keys || keys.length === 0) return;
        try {
            for (const key of keys) {
                await this.apiPost({ action: 'room_del', direct_key: String(key) });
            }
            this.selectedFolders.clear();
            this.foldersPreloaded = false;
            await this.loadFolders(true);
            VXUI.toast(`已删除 ${keys.length} 个直链`, 'success');
        } catch (e) {
            console.error('[VX_DIRECT] doDeleteRooms error:', e);
            VXUI.toast('删除失败', 'error');
        }
    },
    
    /**
     * 更新选择 UI
     */
    updateSelectionUI() {
        if (this.activeTab !== 'files') return;

        document.querySelectorAll('#vx-direct-files-list-body .vx-list-row').forEach(row => {
            const id = String(row.dataset.id);
            row.classList.toggle('selected', this.selectedItems.has(id));
        });

        // Update header select-all checkbox state
        const headerCb = document.getElementById('vx-direct-select-all');
        if (headerCb) {
            headerCb.classList.remove('vx-checked', 'vx-indeterminate');
            const total = (this.files || []).length;
            const selected = this.selectedItems.size;
            if (total > 0 && selected === total) {
                headerCb.classList.add('vx-checked');
            } else if (selected > 0) {
                headerCb.classList.add('vx-indeterminate');
            }
        }

        this.updateSelectionBar();
    },

    updateSelectionBar() {
        const bar = document.getElementById('vx-direct-selection-bar');
        const countEl = document.getElementById('vx-direct-selected-count');
        if (!bar || !countEl) return;

        const count = this.selectedItems.size;
        countEl.textContent = String(count);
        bar.style.display = count > 0 ? 'flex' : 'none';
    },

    clearSelection() {
        this.selectedItems.clear();
        this.updateSelectionUI();
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
    deleteLink(directKey) {
        VXUI.confirm({
            title: '删除确认',
            message: '确定要删除这个直链吗？删除后无法恢复。',
            confirmClass: 'vx-btn-danger',
            onConfirm: () => this.doDeleteLinks([String(directKey)])
        });
    },
    
    /**
     * 删除选中项
     */
    deleteSelected() {
        if (this.activeTab !== 'files') return;
        if (this.selectedItems.size === 0) {
            VXUI.toastWarning('请先选择要删除的项目');
            return;
        }

        const count = this.selectedItems.size;
        VXUI.confirm({
            title: '批量删除',
            message: `确定要删除选中的 ${count} 个直链吗？`,
            confirmClass: 'vx-btn-danger',
            onConfirm: () => this.doDeleteLinks([...this.selectedItems])
        });
    },
    
    /**
     * 执行删除
     */
    doDeleteLinks(directKeys) {
        if (typeof TL === 'undefined') return;
        const keys = (directKeys || []).map(String).filter(Boolean);
        if (keys.length === 0) return;

        const req = () => this.apiPost({ action: 'del_link', direct_key: keys });
        req()
            .then(() => {
                VXUI.toastSuccess('删除成功');
                this.selectedItems.clear();
                this.updateSelectionBar();
                this.loadFiles(true);
            })
            .catch((e) => {
                console.error(e);
                VXUI.toastError('删除失败');
            });
    },

    deleteRoom(directKey) {
        VXUI.confirm({
            title: '删除确认',
            message: '确定要删除这个直链文件夹吗？',
            confirmClass: 'vx-btn-danger',
            onConfirm: async () => {
                try {
                    await this.apiPost({ action: 'room_del', direct_key: String(directKey) });
                    VXUI.toastSuccess('删除成功');
                    this.loadFolders(true);
                } catch (e) {
                    console.error(e);
                    VXUI.toastError('删除失败');
                }
            }
        });
    },
    
    /**
     * 复制选中项链接
     */
    copySelectedUrls() {
        if (this.activeTab !== 'files') return;
        if (this.selectedItems.size === 0) {
            VXUI.toastWarning('请先选择项目');
            return;
        }

        const urls = [];
        for (const item of this.files) {
            const key = String(item.direct_key);
            if (!this.selectedItems.has(key)) continue;
            const fileName = item.fname || '';
            const filenameEncoded = encodeURIComponent(fileName);
            const link = this.genLinkDirect(item.direct_key, filenameEncoded).download;
            urls.push(link);
        }
        VXUI.copyToClipboard(urls.join('\n'));
    },
    
    /**
     * 刷新
     */
    refresh() {
        // 清除预加载缓存，强制重新加载
        this.filesPreloaded = false;
        this.foldersPreloaded = false;
        
        this.showLoading();
        this.loadDetails()
            .then(() => {
                this.applyDetailsToUI();
                this.hideLoading();
                this.loadCurrentTab(true);
            })
            .catch((e) => {
                console.error(e);
                this.hideLoading();
                VXUI.toastError('刷新失败');
            });
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
        const panels = document.getElementById('vx-direct-panels');
        const content = document.getElementById('vx-direct-content');

        if (loading) loading.classList.remove('vx-hidden');
        if (panels) panels.classList.add('vx-hidden');
        // 确保加载时也应用列表模式样式（无边距）
        if (content) content.classList.add('vx-content-list');
    },
    
    /**
     * 隐藏加载状态
     */
    hideLoading() {
        const loading = document.getElementById('vx-direct-loading');
        const panels = document.getElementById('vx-direct-panels');

        if (loading) loading.classList.add('vx-hidden');
        if (panels) panels.classList.remove('vx-hidden');
    },
    
    /**
     * 显示空状态
     */
    // (old empty helpers removed; empty is per-tab)
    
    /**
     * 更新统计
     */
    updateStats() {
        const countEl = document.getElementById('vx-direct-count');
        const folderCountEl = document.getElementById('vx-direct-folder-count');
        if (countEl) countEl.textContent = String(this.files.length || 0);
        if (folderCountEl) folderCountEl.textContent = String(this.folders.length || 0);
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
                        // 计算需要滚动的距离
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

    // ==================== API Key ====================
    async resetAPIKey() {
        const btn = document.getElementById('vx-direct-api-reset');
        if (btn) btn.disabled = true;
        try {
            await this.apiPost({ action: 'generate_key' });
            await this.loadDetails();
            this.applyDetailsToUI();
            VXUI.toastSuccess('已重置');
        } catch (e) {
            console.error(e);
            VXUI.toastError('重置失败');
        } finally {
            if (btn) btn.disabled = false;
        }
    },

    async copyAPIKey() {
        if (!this.key || this.key === 0) {
            VXUI.toastWarning('API Key 未设置');
            return;
        }
        VXUI.copyToClipboard(String(this.key));
    },

    // ==================== Search / Sort ====================
    onSearchInput() {
        const el = document.getElementById('vx-direct-search');
        this.search = el ? String(el.value || '') : '';
        this.syncUrlState();
        // debounce
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this.loadFiles(true), 250);
    },

    setSort(target, column) {
        if (typeof VX_SORT === 'undefined') return;
        
        const isFiles = target === 'files';
        const currentBy = isFiles ? this.files_sort_by : this.folders_sort_by;
        const currentType = isFiles ? this.files_sort_type : this.folders_sort_type;
        
        const next = VX_SORT.nextState(currentBy, currentType, column);
        
        if (isFiles) {
            this.files_sort_by = next.by;
            this.files_sort_type = next.type;
            VX_SORT.save('vx_direct_sort', 'files', next.by, next.type);
            this.updateSortIcons();
            this.loadFiles(true); // reload
        } else {
            this.folders_sort_by = next.by;
            this.folders_sort_type = next.type;
            VX_SORT.save('vx_direct_sort', 'folders', next.by, next.type);
            this.updateSortIcons();
            this.renderFolders(); // re-render only, as sort is frontend
        }
    },
    
    updateSortIcons() {
        if (typeof VX_SORT === 'undefined') return;
        VX_SORT.updateIcons('vx-direct-files-sort-icon-', this.files_sort_by, this.files_sort_type);
        VX_SORT.updateIcons('vx-direct-folders-sort-icon-', this.folders_sort_by, this.folders_sort_type);
    },

    // ==================== Link helpers ====================
    is_allow_play(filename) {
        const ext = String(filename || '').split('.').pop();
        return this.allow_ext.indexOf(ext) !== -1;
    },

    genLinkDirect(dkey, filename) {
        const filename2 = filename;
        return {
            download: `${this.protocol}${this.domain}/files/${dkey}/${filename2}`,
            res: `${this.protocol}${this.domain}/res/${dkey}/${filename2}`,
            play: `${this.protocol}${this.domain}/stream-${dkey}`
        };
    },

    // ==================== Misc helpers ====================
    formatBytes(bytes, human = true) {
        if (typeof VXUI !== 'undefined' && typeof VXUI.formatFileSize === 'function') {
            return VXUI.formatFileSize(Number(bytes || 0));
        }
        return human ? String(bytes || 0) : String(bytes || 0);
    },

    selectBingDomainText(number) {
        const n = Number(number);
        const ld = (typeof app !== 'undefined' && app.languageData) ? app.languageData : null;
        if (ld) {
            switch (n) {
                case 1: return ld.direct_intro_modal_msg_1 || '绑定成功';
                case 2: return ld.direct_intro_modal_msg_2 || '域名已被使用';
                case 4: return ld.direct_intro_modal_msg_3 || '域名不合法';
                case 3: return ld.direct_intro_modal_msg_4 || '绑定失败';
                case 5: return ld.direct_ssl_check_input_msg_cname || '需要配置 CNAME 记录';
                case 6: return ld.direct_ssl_check_input_msg_acme || '需要配置 ACME 记录';
                case 7: return ld.direct_ssl_check_input_msg_txt || '需要配置 TXT 记录';
            }
        }
        switch (n) {
            case 1: return '绑定成功';
            case 2: return '域名已被使用';
            case 3: return '绑定失败';
            case 4: return '域名不合法';
            case 5: return '请配置 CNAME 记录';
            case 6: return '请配置 ACME 记录';
            case 7: return '请配置 TXT 记录';
        }
        return '未知错误';
    },

    escapeHtml(s) {
        return String(s ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    },

    escapeAttr(s) {
        return this.escapeHtml(s).replaceAll('`', '&#96;');
    }
};

// 注册模块
if (typeof VXUI !== 'undefined') {
    VXUI.registerModule('direct', VX_DIRECT);
}
