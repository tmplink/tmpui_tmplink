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
    foldersReqSeq: 0,

    // search/sort
    sort_by: 0,
    sort_type: 0,
    search: '',

    // timers
    _readyTimer: null,

    // usage chart
    usageRt: 2,
    usageChart: null,

    allow_ext: ['mp4', 'm4v', 'webm', 'mov', 'ogg', 'mp3'],

    // ==================== Lifecycle ====================
    init(params = {}) {
        console.log('[VX_DIRECT] Initializing...', params);

        if (typeof TL !== 'undefined' && !TL.isLogin()) {
            VXUI.navigate('login');
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
        this.sortSettingsInit();
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
                    VXUI.navigate('login');
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

        this.pageNumber = 0;
        this.hasMore = true;
        this.isLoading = false;

        this.filesReqSeq = 0;
        this.foldersReqSeq = 0;

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
        this.activeTab = next;

        this.updateTabUI();

        if (this.domain === 0 && next !== 'domain') {
            this.activeTab = 'domain';
            this.updateTabUI();
            return;
        }

        this.loadCurrentTab(true);
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
        this.domain = rsp.data.domain;
        this.quota = rsp.data.quota;
        this.quota_free = rsp.data.quota_free;
        this.total_downloads = rsp.data.total_downloads;
        this.total_transfer = rsp.data.total_transfer;
        this.hp_time = parseInt(rsp.data.hp_time || '0', 10);
        this.ssl_auto = rsp.data.ssl_auto === 'yes';
        this.traffic_limit = rsp.data.traffic_limit;
        this.ssl = rsp.data.ssl_status === 'yes';
        this.ssl_acme = rsp.data.ssl_acme === 'disable' ? false : true;

        // branding (optional fields)
        this.brand_logo_id = (rsp.data.brand_logo_id != null) ? String(rsp.data.brand_logo_id) : '0';
        this.brand_title = (rsp.data.brand_title != null) ? String(rsp.data.brand_title) : '0';
        this.brand_content = (rsp.data.brand_content != null) ? String(rsp.data.brand_content) : '0';
        this.brand_status = (rsp.data.brand_status != null) ? String(rsp.data.brand_status) : '';

        if (this.ssl || this.ssl_acme) {
            this.protocol = 'https://';
        } else {
            this.protocol = 'http://';
        }

        return rsp;
    },

    applyDetailsToUI() {
        const domainText = document.getElementById('vx-direct-domain-text');
        const lock = document.getElementById('vx-direct-domain-lock');
        if (domainText) {
            domainText.textContent = this.domain && this.domain !== 0 ? String(this.domain) : '未绑定域名';
        }
        if (lock) {
            lock.style.display = (this.ssl || this.ssl_acme) ? '' : 'none';
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
            if (this.ssl || this.ssl_acme) {
                sslYes.checked = true;
            } else {
                sslNo.checked = true;
            }
        }

        // disable SSL button
        const disableSSLBtn = document.getElementById('vx-direct-disable-ssl');
        if (disableSSLBtn) {
            disableSSLBtn.style.display = (this.ssl || this.ssl_acme) ? '' : 'none';
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
        if (typeof VX_SHOP !== 'undefined' && VX_SHOP && typeof VX_SHOP.openQuota === 'function') {
            VX_SHOP.openQuota();
            return;
        }
        if (typeof VXUI !== 'undefined' && typeof VXUI.navigate === 'function') {
            VXUI.navigate('shop');
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
        switch (s) {
            case 'ok':
                return '已通过';
            case 'reject':
                return '已拒绝';
            case 'wait':
                return '待提交';
            case 'review':
                return '审核中';
            default:
                return '-';
        }
    },

    brandLogoSet(inputEl) {
        const msgEl = document.getElementById('vx-direct-brand-logo-msg');
        const file = inputEl?.files?.[0];
        if (!file) return;

        const token = this.getToken();
        if (!token) {
            VXUI.toastError('登录状态无效');
            VXUI.navigate('login');
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
        const hint = document.getElementById('vx-direct-domain-hint');
        const err = document.getElementById('vx-direct-domain-error');
        if (!domainInput || !hint || !err) return;

        const domain = String(domainInput.value || '').trim();
        err.style.display = 'none';
        hint.style.display = 'none';

        if (domain.length === 0) return;

        // light validation
        const ok = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain);
        if (!ok) {
            err.textContent = '域名格式不正确';
            err.style.display = '';
            return;
        }

        hint.textContent = '请确保域名已正确配置 CNAME 解析后再保存。';
        hint.style.display = '';
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
    async loadUsage(rt = 2) {
        this.usageRt = rt;
        const container = document.getElementById('vx-direct-usage-chart');
        if (!container) return;

        if (typeof ApexCharts === 'undefined') {
            container.innerHTML = '<div class="vx-text-muted">ApexCharts 未加载</div>';
            return;
        }

        try {
            const rsp = await this.apiPost({ action: 'chart_get_usage', rt: rt });
            const traffic = rsp?.data?.traffic || [];
            const time = rsp?.data?.time || [];

            if (this.usageChart && typeof this.usageChart.destroy === 'function') {
                try {
                    this.usageChart.destroy();
                } catch (e) {
                    // ignore
                }
                this.usageChart = null;
            }

            const options = {
                series: [{
                    name: '流量',
                    data: traffic
                }],
                chart: {
                    height: 220,
                    type: 'bar',
                    toolbar: { show: false }
                },
                plotOptions: {
                    bar: {
                        borderRadius: 8,
                        dataLabels: { position: 'top' }
                    }
                },
                dataLabels: {
                    enabled: true,
                    formatter: (val) => this.formatBytes(val, true),
                    offsetY: -14,
                    style: { fontSize: '12px' }
                },
                tooltip: { enabled: false },
                xaxis: {
                    categories: time,
                    axisBorder: { show: false },
                    axisTicks: { show: false }
                },
                yaxis: {
                    labels: { show: false }
                },
                grid: {
                    strokeDashArray: 4
                }
            };

            this.usageChart = new ApexCharts(container, options);
            await this.usageChart.render();
        } catch (e) {
            console.error('[VX_DIRECT] loadUsage error', e);
            container.innerHTML = '<div class="vx-text-muted">加载统计失败</div>';
        }
    },

    // ==================== Lists ====================
    loadCurrentTab(reset = false) {
        if (this.activeTab === 'dashboard') {
            this.applyGateUI();
            if (this.domain && this.domain !== 0) {
                this.loadUsage(this.usageRt).catch(() => { /* ignore */ });
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

    load() {
        // Backward compatibility
        this.loadCurrentTab(true);
    },

    async loadFiles(reset = false) {
        if (this.domain === 0) {
            this.renderFiles();
            return;
        }

        if (reset) {
            this.pageNumber = 0;
            this.hasMore = true;
            this.files = [];
            this.selectedItems.clear();
            // do NOT force isLoading=false here; that can allow concurrent
            // requests to append duplicate data.
        }

        const seq = ++this.filesReqSeq;
        if (this.isLoading && !reset) return;
        this.isLoading = true;

        try {
            const key = this.keyGet();
            const sort_by = localStorage.getItem(key.sort_by) ?? String(this.sort_by);
            const sort_type = localStorage.getItem(key.sort_type) ?? String(this.sort_type);

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
            } else {
                this.hasMore = false;
            }

            this.renderFiles();
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

        if (reset) {
            this.folders = [];
        }

        const seq = ++this.foldersReqSeq;

        try {
            const rsp = await this.apiPost({ action: 'room_list' });
            if (seq !== this.foldersReqSeq) return; // stale response
            if (rsp && rsp.status === 1) {
                this.folders = rsp.data || [];
            } else {
                this.folders = [];
            }
            this.renderFolders();
        } catch (e) {
            console.error('[VX_DIRECT] loadFolders error:', e);
            VXUI.toastError('加载失败');
        }
    },

    // ==================== Render (Files) ====================
    renderFiles() {
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
            <div class="vx-list-date vx-hide-mobile">${this.escapeHtml(createTime)}</div>
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
            </div>
        `;
        return row;
    },

    // ==================== Render (Folders) ====================
    renderFolders() {
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
            return;
        }

        if (!this.folders || this.folders.length === 0) {
            if (listBody) listBody.innerHTML = '';
            empty.style.display = '';
            if (listContainer) listContainer.style.display = 'none';
            return;
        }

        empty.style.display = 'none';

        if (listContainer) listContainer.style.display = '';
        listBody.innerHTML = '';
        for (const item of this.folders) {
            listBody.appendChild(this.createDirectFolderRow(item));
        }
    },

    createDirectFolderRow(item) {
        const directKey = item.direct_key;
        const name = item.name || '未命名文件夹';
        const createTime = item.ctime || '--';
        const mrid = item.mrid;
        const link = `${this.protocol}${this.domain}/share/${directKey}/`;

        const row = document.createElement('div');
        row.className = 'vx-list-row';
        row.dataset.id = String(directKey);
        row.dataset.type = 'folder';
        row.innerHTML = `
            <div class="vx-list-checkbox" style="visibility:hidden"></div>
            <div class="vx-list-name">
                <div class="vx-list-icon vx-icon-folder">
                    <iconpark-icon name="folder-open-e1ad2j7l"></iconpark-icon>
                </div>
                <div class="vx-list-filename">
                    <a href="javascript:;" onclick="event.stopPropagation(); VXUI.navigate('filelist', { mrid: '${String(mrid)}', view: 'list' })">${this.escapeHtml(name)}</a>
                </div>
            </div>
            <div class="vx-list-size"><span class="vx-type-folder">文件夹</span></div>
            <div class="vx-list-date vx-hide-mobile">${this.escapeHtml(createTime)}</div>
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

        if (loading) loading.classList.remove('vx-hidden');
        if (panels) panels.classList.add('vx-hidden');
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
        if (countEl) countEl.textContent = String(this.files.length || 0);
    }

    ,

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
        // debounce
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this.loadFiles(true), 250);
    },

    onSortChange() {
        const sortByEl = document.getElementById('vx-direct-sort-by');
        const sortTypeEl = document.getElementById('vx-direct-sort-type');
        const key = this.keyGet();
        if (sortByEl) localStorage.setItem(key.sort_by, String(sortByEl.value));
        if (sortTypeEl) localStorage.setItem(key.sort_type, String(sortTypeEl.value));
        this.loadFiles(true);
    },

    sortSettingsInit() {
        const key = this.keyGet();
        const sortByEl = document.getElementById('vx-direct-sort-by');
        const sortTypeEl = document.getElementById('vx-direct-sort-type');

        const storage_sort_by = localStorage.getItem(key.sort_by);
        const storage_sort_type = localStorage.getItem(key.sort_type);
        const sort_by = storage_sort_by === null ? String(this.sort_by) : String(storage_sort_by);
        const sort_type = storage_sort_type === null ? String(this.sort_type) : String(storage_sort_type);

        localStorage.setItem(key.sort_by, sort_by);
        localStorage.setItem(key.sort_type, sort_type);

        if (sortByEl) sortByEl.value = sort_by;
        if (sortTypeEl) sortTypeEl.value = sort_type;
    },

    keyGet() {
        return {
            sort_by: 'vx_direct_sort_by',
            sort_type: 'vx_direct_sort_type'
        };
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
