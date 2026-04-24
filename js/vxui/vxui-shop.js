/**
 * VXUI Shop Module
 * 商店模块 - 购买赞助、存储空间、直链配额
 */

window.VX_SHOP = {
    // Current state
    currentTab: 'products',
    selectedProduct: null,
    selectedCode: null,
    selectedTime: 1,
    selectedPayment: null,
    purchaseType: null, // 'addon' or 'direct'
    quantity: 1,
    isSponsorExchangeProcessing: false,
    
    // Product definitions
    products: {
        sponsor: {
            type: 'addon',
            code: 'HS',
            name: '赞助者',
            monthlyPrice: 6,
            prices: {
                '1': 6,    // 1 month
                '12': 72   // 1 year (6*12)
            }
        },
        storage: {
            type: 'addon',
            items: {
                '256GB': { code: '256GB', name: '256GB', monthlyPrice: 6, prices: { '1': 6, '12': 72 } },
                '1TB': { code: '1TB', name: '1TB', monthlyPrice: 18, prices: { '1': 18, '12': 216 } },
                '3TB': { code: '3TB', name: '3TB', monthlyPrice: 66, prices: { '1': 66, '12': 792 } },
                '5TB': { code: '5TB', name: '5TB', monthlyPrice: 120, prices: { '1': 120, '12': 1440 } }
            }
        },
        direct: {
            type: 'direct',
            items: {
                'D20': { code: 'D20', name: '20GB', size: '20GB', price: 6 },
                'D100': { code: 'D100', name: '100GB', size: '100GB', price: 18 },
                'D600': { code: 'D600', name: '600GB', size: '600GB', price: 60 },
                'D1024': { code: 'D1024', name: '1TB', size: '1TB', price: 90 }
            }
        },
        firstTimeSponsor: {
            type: 'addon',
            code: 'FN01',
            name: '初次赞助特典',
            price: 36
        }
    },
    
    /**
     * Get translation text safely
     */
    t(key, fallback) {
        return (typeof TL !== 'undefined' && TL.tpl && TL.tpl[key]) ? TL.tpl[key] : fallback;
    },

    fmt(key, params, fallback) {
        const text = String(this.t(key, fallback) || '');
        if (!params) return text;
        return text.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
    },
    
    /**
     * Check if Chinese language
     */
    isCN() {
        return typeof TL !== 'undefined' && TL.lang === 'cn';
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
     * Resolve shop API endpoint with TL runtime config fallback.
     */
    getShopApiUrl() {
        if (typeof TL !== 'undefined' && TL.api_shop) return TL.api_shop;
        const apiBase = (typeof TL !== 'undefined' && TL.api_url) ? TL.api_url : 'https://connect.tmp.link/api_v2';
        return apiBase + '/shop';
    },

    /**
     * Parse JSON response safely and avoid uncaught HTML parse errors.
     */
    async parseJsonResponse(response, tag = 'shop') {
        const raw = await response.text();
        try {
            return JSON.parse(raw);
        } catch (e) {
            console.error(`[VX_SHOP] Invalid JSON response (${tag}), status=${response.status}:`, raw.slice(0, 180));
            throw new Error('invalid_json_response');
        }
    },
    extractApiErrorMessage(result) {
        if (!result) return '';

        if (typeof result.data === 'string' && result.data.trim()) {
            return result.data.trim();
        }

        if (result.data && typeof result.data.message === 'string' && result.data.message.trim()) {
            return result.data.message.trim();
        }

        if (typeof result.debug === 'string' && result.debug.trim()) {
            return result.debug.trim();
        }

        if (Array.isArray(result.debug)) {
            const joined = result.debug.filter(Boolean).join(' ').trim();
            if (joined) return joined;
        }

        return '';
    },

    getKnownSpaceErrorMessage(result, fallbackKey, fallbackText) {
        const status = Number(result && result.status);
        const knownMessages = {
            2003: ['vx_point_insufficient', '点数不足'],
            2004: [fallbackKey, fallbackText],
            2101: ['vx_space_invalid_spec', '无效的私有空间规格'],
            2102: ['vx_space_cap_reached', '私有空间已达上限（10TB），无法继续购买'],
            2103: ['vx_space_invalid_ids', '私有空间记录无效，请刷新后重试'],
            2104: ['vx_space_spec_error', '私有空间规格数据异常，请稍后重试']
        };

        if (knownMessages[status]) {
            return this.t(knownMessages[status][0], knownMessages[status][1]);
        }

        return this.extractApiErrorMessage(result) || this.t(fallbackKey, fallbackText);
    },
    
    /**
     * Initialize the shop module
     */
    init(params = {}) {
        console.log('[VX_SHOP] Initializing shop module...', params);
        
        // Check login
        if (typeof TL !== 'undefined' && !TL.isLogin()) {
            VXUI.toastWarning(this.t('vx_need_login', '请先登录'));
            setTimeout(() => {
                app.open('/login');
            }, 1000);
            return;
        }
        
        // Update sidebar
        this.updateSidebar();
        
        // Apply translations
        if (typeof TL !== 'undefined' && TL.tpl_lang) {
            TL.tpl_lang();
        }
        
        // Check first time sponsor availability
        this.checkFirstTimeSponsor();
        
        // Load user status
        this.loadUserStatus();
        
        // Set default payment method based on language
        this.selectedPayment = (typeof TL !== 'undefined' && TL.lang === 'cn') ? 'alipay' : 'paypal';
        
        // Handle action parameter - open specific modal after init
        if (params.action) {
            setTimeout(() => {
                switch (params.action) {
                    case 'quota':
                        this.openQuota();
                        break;
                    case 'sponsor':
                        this.openSponsor();
                        break;
                    case 'storage':
                        this.openStorage();
                        break;
                }
            }, 100);
        }

        // Restore tab from URL (deep-link). Some router paths do not pass tab through init params.
        const urlParams = (typeof VXUI !== 'undefined' && VXUI && typeof VXUI.getUrlParams === 'function')
            ? (VXUI.getUrlParams() || {})
            : {};
        const nextTab = (params && params.tab) ? String(params.tab) : (urlParams.tab ? String(urlParams.tab) : 'products');
        if (nextTab === 'purchased' || nextTab === 'products' || nextTab === 'spaces') {
            this.showTab(nextTab);
        } else {
            this.showTab('products');
        }
    },
    
    /**
     * Update sidebar content
     */
    updateSidebar() {
        if (typeof VXUI !== 'undefined' && typeof VXUI.setSidebarDynamicFromTemplate === 'function') {
            VXUI.setSidebarDynamicFromTemplate('vx-shop-sidebar-tpl');
        } else {
            const sidebarTpl = document.getElementById('vx-shop-sidebar-tpl');
            const sidebarDynamic = document.getElementById('vx-sidebar-dynamic');
            if (sidebarTpl && sidebarDynamic) {
                sidebarDynamic.innerHTML = sidebarTpl.innerHTML;
            }
        }

        if (typeof TL !== 'undefined' && TL.tpl_lang) {
            TL.tpl_lang();
        }
    },
    
    /**
     * Switch between tabs
     */
    showTab(tab) {
        this.currentTab = tab;

        this.trackUI(`vui_shop[${tab}]`);

        // Sync URL so tabs can be directly opened
        if (typeof VXUI !== 'undefined' && VXUI && typeof VXUI.updateUrl === 'function') {
            const currentParams = (typeof VXUI.getUrlParams === 'function') ? (VXUI.getUrlParams() || {}) : {};
            delete currentParams.module;

            if (tab === 'purchased' || tab === 'spaces') {
                currentParams.tab = tab;
            } else {
                delete currentParams.tab;
            }

            VXUI.updateUrl('shop', currentParams);
        }
        
        // Update tab buttons (if they exist)
        document.querySelectorAll('.vx-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const tabBtn = document.getElementById(`tab-${tab}`);
        if (tabBtn) tabBtn.classList.add('active');
        
        // Update sidebar nav (only module dynamic area)
        document.querySelectorAll('#vx-sidebar-dynamic .vx-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        const navItem = document.getElementById(`nav-shop-${tab}`);
        if (navItem) navItem.classList.add('active');
        
        // Update header subtitle
        const subtitleEl = document.getElementById('vx-shop-header-subtitle');
        if (subtitleEl) {
            if (tab === 'purchased') {
                subtitleEl.textContent = ' - ' + this.t('navbar_hr_shop', '已购');
            } else if (tab === 'spaces') {
                subtitleEl.textContent = ' - ' + this.t('vx_space_mgmt', '私有空间');
            } else {
                subtitleEl.textContent = '';
            }
        }

        // Show/hide content
        document.getElementById('vx-shop-products').style.display = tab === 'products' ? 'block' : 'none';
        document.getElementById('vx-shop-purchased').style.display = tab === 'purchased' ? 'block' : 'none';
        const spacesEl = document.getElementById('vx-shop-spaces');
        if (spacesEl) spacesEl.style.display = tab === 'spaces' ? 'block' : 'none';

        // Load content for the tab
        if (tab === 'purchased') {
            this.loadOrders();
        } else if (tab === 'spaces') {
            this.loadSpaces();
        }
    },
    
    /**
     * Check if first time sponsor is available
     */
    async checkFirstTimeSponsor() {
        const apiUrl = (typeof TL !== 'undefined' && TL.api_pay) ? TL.api_pay : '/api_v2/pay';
        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
        
        if (!token) {
            console.warn('[VX_SHOP] No token, skipping first time sponsor check');
            return;
        }
        
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `action=limit_product_check&token=${token}&code=FN01`
            });
            
            const data = await response.json();
            
            // API returns status=1 when available
            if (data.status === 1) {
                document.getElementById('vx-shop-special').style.display = 'block';
                
                // Update price based on language
                const priceEl = document.getElementById('vx-first-sponsor-price');
                const unitEl = priceEl.nextElementSibling;
                const isCN = typeof TL !== 'undefined' && (TL.lang === 'cn' || TL.lang === 'jp');
                
                if (isCN) {
                    priceEl.textContent = '36';
                    unitEl.textContent = '元';
                } else {
                    priceEl.textContent = '6';
                    unitEl.textContent = 'USD';
                }
            } else {
                // Hide if not available
                document.getElementById('vx-shop-special').style.display = 'none';
            }
        } catch (e) {
            console.warn('[VX_SHOP] First time sponsor check failed:', e);
            document.getElementById('vx-shop-special').style.display = 'none';
        }
    },
    
    /**
     * API request helper
     */
    async apiRequest(action, params = {}) {
        const apiUrl = (typeof TL !== 'undefined' && TL.api_pay) ? TL.api_pay : '/api_v2/pay';
        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
        
        return new Promise((resolve, reject) => {
            $.ajax({
                url: apiUrl,
                type: 'POST',
                data: { action, token, ...params },
                dataType: 'json',
                success: resolve,
                error: reject
            });
        });
    },

    /**
     * Load user status
     * - Keep lightweight and safe: it should never throw.
     * - Prefer reusing TL.get_details() if available.
     */
    loadUserStatus() {
        try {
            const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
            if (!token) return;

            if (typeof TL !== 'undefined' && typeof TL.get_details === 'function') {
                TL.get_details(() => {
                    // Optional: place future VXUI-only status rendering here.
                });
            }
        } catch (e) {
            console.warn('[VX_SHOP] loadUserStatus failed:', e);
        }
    },
    
    // ==================== 私有空间管理 ====================

    /** Renewable specs (only these support space_renew API) */
    _RENEWABLE_SPECS: ['256g', '1t'],

    /** Maximum total active private space capacity: 10 TB */
    _SPACE_CAP_BYTES: 10 * 1024 * 1024 * 1024 * 1024,

    /** Cached total active private space bytes (populated by loadSpaces) */
    _totalActiveSpaceBytes: 0,

    /** Normalize space spec for comparisons (e.g. 256G -> 256g). */
    normalizeSpaceSpec(spec) {
        return String(spec || '').trim().toLowerCase();
    },

    /** Unit monthly price by space spec (points / 30 days). */
    getSpaceMonthlyPrice(spec) {
        const normalized = this.normalizeSpaceSpec(spec);
        if (normalized === '1t') return 2000;
        return 600; // default 256g
    },

    /** Capacity bytes by space spec. */
    getSpaceSpecBytes(spec) {
        const normalized = this.normalizeSpaceSpec(spec);
        if (normalized === '1t') return 1024 * 1024 * 1024 * 1024;
        return 256 * 1024 * 1024 * 1024;
    },

    /** Resolve display label with robust fallback when API returns "unknown". */
    getSpaceDisplayLabel(space) {
        const rawLabel = String(space && space.label ? space.label : '').trim();
        if (rawLabel && rawLabel.toLowerCase() !== 'unknown') return rawLabel;

        const spec = this.normalizeSpaceSpec(space && space.spec);
        if (spec === '256g') return '256GB';
        if (spec === '1t') return '1TB';

        const size = Number(space && space.size);
        if (Number.isFinite(size) && size > 0) {
            return this.formatBytes(size);
        }

        return this.t('vx_space_unknown', '未知规格');
    },

    /**
     * Update the buy-space section UI based on total active space vs. 10TB cap.
     * Called after loadSpaces() resolves.
     */
    _updateSpacesBuySection() {
        const buyBtn = document.getElementById('vx-space-buy-trigger');
        if (!buyBtn) return;

        buyBtn.disabled = (this._totalActiveSpaceBytes || 0) >= this._SPACE_CAP_BYTES;
    },

    _clearSpacesOverview() {
        const overviewEl = document.getElementById('vx-space-overview');
        if (!overviewEl) return;
        overviewEl.style.display = 'none';
        overviewEl.innerHTML = '';
    },

    _getPrivateStorageUsedBytes() {
        const used = (typeof TL !== 'undefined' && TL && TL.private_storage_used !== undefined)
            ? Number(TL.private_storage_used)
            : 0;
        if (!Number.isFinite(used) || used < 0) return 0;
        return used;
    },

    _renderSpacesOverview(spaces) {
        const overviewEl = document.getElementById('vx-space-overview');
        if (!overviewEl) return;

        const activeSpaces = (spaces || []).filter(s => s && s.is_active === 1);
        if (activeSpaces.length === 0) {
            this._clearSpacesOverview();
            return;
        }

        const totalBytes = this._totalActiveSpaceBytes || activeSpaces.reduce((sum, s) => {
            const apiBytes = Number(s.size);
            return sum + (Number.isFinite(apiBytes) && apiBytes > 0 ? apiBytes : this.getSpaceSpecBytes(s.spec));
        }, 0);

        const usedRaw = this._getPrivateStorageUsedBytes();
        const usedBytes = Math.min(usedRaw, totalBytes);
        const freeBytes = Math.max(totalBytes - usedBytes, 0);
        const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

        const groups = {};
        activeSpaces.forEach(space => {
            const label = this.getSpaceDisplayLabel(space);
            const apiBytes = Number(space.size);
            const bytes = Number.isFinite(apiBytes) && apiBytes > 0 ? apiBytes : this.getSpaceSpecBytes(space.spec);
            groups[label] = (groups[label] || 0) + bytes;
        });

        const entries = Object.keys(groups)
            .map(label => ({ label, bytes: groups[label] }))
            .sort((a, b) => b.bytes - a.bytes);

        const palette = ['#2563eb', '#0ea5e9', '#8b5cf6', '#f59e0b', '#14b8a6', '#ef4444'];

        const compBarHtml = entries.map((item, idx) => {
            const pct = totalBytes > 0 ? (item.bytes / totalBytes) * 100 : 0;
            return `<span class="vx-space-comp-seg" style="width:${pct.toFixed(2)}%;background:${palette[idx % palette.length]};"></span>`;
        }).join('');

        const compLegendHtml = entries.map((item, idx) => {
            const pct = totalBytes > 0 ? (item.bytes / totalBytes) * 100 : 0;
            return `
                <div class="vx-space-comp-item">
                    <span class="vx-space-comp-left">
                        <span class="vx-space-comp-dot" style="background:${palette[idx % palette.length]};"></span>
                        <span class="vx-space-comp-name">${this.escapeHtml(item.label)}</span>
                    </span>
                    <span class="vx-space-comp-val">${this.formatBytes(item.bytes)} (${pct.toFixed(1)}%)</span>
                </div>
            `;
        }).join('');

        overviewEl.innerHTML = `
            <div class="vx-space-overview-card">
                <div class="vx-space-overview-top">
                    <span class="vx-space-overview-title">${this.t('vx_space_overview_title', '私有空间总览')}</span>
                    <span class="vx-space-overview-cap">${this.t('vx_space_overview_cap', '总量上限 10TB')}</span>
                </div>

                <div class="vx-space-kpis">
                    <div class="vx-space-kpi">
                        <div class="vx-space-kpi-label">${this.t('vx_space_overview_total', '总容量')}</div>
                        <div class="vx-space-kpi-value">${this.formatBytes(totalBytes)}</div>
                    </div>
                    <div class="vx-space-kpi">
                        <div class="vx-space-kpi-label">${this.t('vx_space_overview_free', '已购可用空间')}</div>
                        <div class="vx-space-kpi-value">${this.formatBytes(freeBytes)}</div>
                    </div>
                    <div class="vx-space-kpi">
                        <div class="vx-space-kpi-label">${this.t('vx_space_overview_used', '已使用空间')}</div>
                        <div class="vx-space-kpi-value">${this.formatBytes(usedBytes)}</div>
                    </div>
                </div>

                <div class="vx-space-section-title">${this.t('vx_space_overview_comp', '私有空间构成')}</div>
                <div class="vx-space-comp-bar">${compBarHtml}</div>
                <div class="vx-space-comp-legend">${compLegendHtml}</div>

                <div class="vx-space-section-title">${this.t('vx_space_overview_usage', '私有空间使用情况')}</div>
                <div class="vx-space-used-bar">
                    <span class="vx-space-used-fill" style="width:${usedPercent.toFixed(2)}%;"></span>
                </div>
                <div class="vx-space-used-meta">
                    <span>${this.t('vx_space_overview_used_ratio', '已使用')} ${this.formatBytes(usedBytes)} / ${this.formatBytes(totalBytes)}</span>
                    <span>${usedPercent.toFixed(1)}%</span>
                </div>
            </div>
        `;

        overviewEl.style.display = '';
    },

    /**
     * Load private spaces and render cards in the spaces tab
     */
    async loadSpaces() {
        const container = document.getElementById('vx-spaces-list-v2');
        if (!container) return;

        container.innerHTML = `
            <div class="vx-spaces-empty">
                <div class="vx-spinner"></div>
            </div>
        `;

        const renewAllBtn = document.getElementById('vx-space-renew-all-btn');
        if (renewAllBtn) renewAllBtn.style.display = 'none';

        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
        if (!token) {
            this._clearSpacesOverview();
            container.innerHTML = `<div class="vx-spaces-empty"><p>${this.t('vx_need_login', '请先登录')}</p></div>`;
            return;
        }

        try {
            const response = await fetch(this.getShopApiUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ action: 'space_list', token }).toString()
            });

            const rsp = await this.parseJsonResponse(response, 'space_list');

            if (rsp.status !== 1 || !rsp.data || rsp.data.length === 0) {
                this._loadedSpaces = [];
                this._totalActiveSpaceBytes = 0;
                this._clearSpacesOverview();
                this._updateSpacesBuySection();
                container.innerHTML = `
                    <div class="vx-spaces-empty">
                        <iconpark-icon name="album-circle-plus"></iconpark-icon>
                        <p>${this.t('vx_space_no_spaces', '暂无私有空间')}</p>
                    </div>
                `;
                return;
            }

            this._loadedSpaces = rsp.data;

            // Calculate total active space capacity for cap enforcement.
            // Prefer the `size` field returned by the API (bytes); fall back to spec-derived value.
            this._totalActiveSpaceBytes = rsp.data
                .filter(s => s.is_active === 1)
                .reduce((sum, s) => {
                    const apiBytes = Number(s.size);
                    return sum + (Number.isFinite(apiBytes) && apiBytes > 0 ? apiBytes : this.getSpaceSpecBytes(s.spec));
                }, 0);
            this._renderSpacesOverview(rsp.data);
            this._updateSpacesBuySection();

            // Refresh used-space stats from profile details when available.
            if (typeof TL !== 'undefined' && TL && typeof TL.get_details === 'function') {
                TL.get_details(() => {
                    this._renderSpacesOverview(this._loadedSpaces || []);
                });
            }

            const hasRenewable = rsp.data.some(s => this._RENEWABLE_SPECS.includes(this.normalizeSpaceSpec(s.spec)));
            if (renewAllBtn) renewAllBtn.style.display = hasRenewable ? '' : 'none';

            let html = '';
            rsp.data.forEach(space => {
                const isActive = space.is_active === 1;
                const normalizedSpec = this.normalizeSpaceSpec(space.spec);
                const canRenew = this._RENEWABLE_SPECS.includes(normalizedSpec);
                const displayLabel = this.getSpaceDisplayLabel(space);

                const statusBadge = isActive
                    ? `<span class="vx-space-status-badge vx-space-status-active">${this.t('vx_space_status_active', '有效')}</span>`
                    : `<span class="vx-space-status-badge vx-space-status-expired">${this.t('vx_space_status_expired', '已过期')}</span>`;

                const iconClass = isActive ? '' : ' vx-space-icon-expired';
                const renewBtn = canRenew
                    ? `<button class="vx-btn vx-btn-sm" onclick="VX_SHOP.openSpaceRenewModal(${space.id}, ${space.renew_price}, '${this.escapeHtml(displayLabel)}', '${normalizedSpec}')">${this.t('vx_space_renew_btn', '续费')}</button>`
                    : '';

                html += `
                    <div class="vx-space-card">
                        <div class="vx-space-card-icon${iconClass}">
                            <iconpark-icon name="album-circle-plus"></iconpark-icon>
                        </div>
                        <div class="vx-space-card-info">
                            <div class="vx-space-card-top">
                                <span class="vx-space-card-label">${this.escapeHtml(displayLabel)}</span>
                                ${statusBadge}
                            </div>
                            <div class="vx-space-card-expiry">${this.t('vx_space_expires', '到期')}: ${space.etime}</div>
                            ${canRenew ? `<div class="vx-space-card-renew-price">${space.renew_price} ${this.t('vx_pay_point', '点数')} / 30${this.t('vx_space_days_abbr', '天')}</div>` : ''}
                        </div>
                        <div class="vx-space-card-action">
                            ${renewBtn}
                        </div>
                    </div>
                `;
            });

            container.innerHTML = html;

        } catch (e) {
            console.error('[VX_SHOP] Failed to load spaces:', e);
            this._clearSpacesOverview();
            container.innerHTML = `
                <div class="vx-spaces-empty">
                    <iconpark-icon name="circle-exclamation"></iconpark-icon>
                    <p>${this.t('vx_load_failed', '加载失败')}</p>
                </div>
            `;
        }
    },

    /**
     * Open renew modal for a single space
     */
    openSpaceRenewModal(id, renew_price, label, spec) {
        const normalizedSpec = this.normalizeSpaceSpec(spec);
        if (!this._RENEWABLE_SPECS.includes(normalizedSpec)) return;

        this._spaceRenewIds = String(id);
        this._spaceRenewTotalCostPerMonth = renew_price;
        this._spaceBulkSpaces = null;
        this._spaceRenewMonths = 1;

        const modalTitle = document.getElementById('vx-modal-title');
        const modalBody = document.getElementById('vx-modal-body');
        if (!modalTitle || !modalBody) return;

        modalTitle.innerHTML = `<iconpark-icon name="rotate"></iconpark-icon> ${this.t('vx_space_renew_title', '续费私有空间')}`;

        modalBody.innerHTML = `
            <div style="margin-bottom:16px;">
                <div style="font-size:15px;font-weight:600;color:var(--vx-text);">${this.escapeHtml(label)}</div>
                <div style="font-size:13px;color:var(--vx-text-secondary);margin-top:2px;">${renew_price} ${this.t('vx_pay_point', '点数')} / 30${this.t('vx_space_days_abbr', '天')}</div>
            </div>
            <h4 class="vx-section-title">${this.t('vx_space_renew_months', '续费月数')}</h4>
            ${this._buildRenewMonthsHtml(renew_price)}
            <div class="vx-renew-cost-summary" id="vx-space-renew-cost">
                <span class="vx-renew-cost-label">${this.t('vx_space_renew_cost', '预计费用')}</span>
                <span class="vx-renew-cost-value"><strong>${renew_price}</strong> ${this.t('vx_pay_point', '点数')}</span>
            </div>
        `;

        this._setRenewModalFooter();
        this.showModal();
    },

    /**
     * Open bulk renew modal for all renewable spaces
     */
    openBulkRenewModal() {
        const renewable = (this._loadedSpaces || []).filter(s => this._RENEWABLE_SPECS.includes(this.normalizeSpaceSpec(s.spec)));

        if (renewable.length === 0) {
            VXUI.toastWarning(this.t('vx_space_renew_no_items', '没有可续费的私有空间'));
            return;
        }

        this._spaceRenewIds = renewable.map(s => s.id).join(',');
        this._spaceBulkSpaces = renewable;
        this._spaceRenewTotalCostPerMonth = renewable.reduce((sum, s) => sum + s.renew_price, 0);
        this._spaceRenewMonths = 1;

        const modalTitle = document.getElementById('vx-modal-title');
        const modalBody = document.getElementById('vx-modal-body');
        if (!modalTitle || !modalBody) return;

        modalTitle.innerHTML = `<iconpark-icon name="rotate"></iconpark-icon> ${this.t('vx_space_bulk_renew_title', '一键续费所有私有空间')}`;

        const summaryItems = renewable.map(s =>
            `<div class="vx-renew-space-item">
                <span class="vx-renew-space-item-label">
                    <iconpark-icon name="album-circle-plus"></iconpark-icon>
                    ${this.escapeHtml(this.getSpaceDisplayLabel(s))}
                    <span class="vx-renew-space-item-etime">${this.t('vx_space_expires', '到期')}: ${s.etime}</span>
                </span>
                <span>${s.renew_price} ${this.t('vx_pay_point', '点数')} / ${this.t('vx_space_month_abbr', '月')}</span>
            </div>`
        ).join('');

        const totalPerMonth = this._spaceRenewTotalCostPerMonth;

        modalBody.innerHTML = `
            <div class="vx-renew-spaces-summary">
                ${summaryItems}
            </div>
            <h4 class="vx-section-title">${this.t('vx_space_renew_months', '续费月数')}</h4>
            ${this._buildRenewMonthsHtml(totalPerMonth)}
            <div class="vx-renew-cost-summary" id="vx-space-renew-cost">
                <span class="vx-renew-cost-label">${this.t('vx_space_renew_cost', '预计费用')}</span>
                <span class="vx-renew-cost-value"><strong>${totalPerMonth}</strong> ${this.t('vx_pay_point', '点数')}</span>
            </div>
        `;

        this._setRenewModalFooter();
        this.showModal();
    },

    /**
     * Build the months selector HTML for renew modals
     */
    _buildRenewMonthsHtml(costPerMonth) {
        const months = [1, 3, 6, 12];
        const monthAbbr = this.t('vx_space_month_abbr', '个月');
        const pointLabel = this.t('vx_pay_point', '点数');

        const opts = months.map(m => `
            <div class="vx-renew-month-opt ${m === 1 ? 'selected' : ''}" data-months="${m}"
                onclick="VX_SHOP._selectRenewMonths(${m})">
                <div class="vx-renew-month-opt-num">${m} ${monthAbbr}</div>
                <div class="vx-renew-month-opt-price">${costPerMonth * m} ${pointLabel}</div>
            </div>
        `).join('');

        return `<div class="vx-renew-months-options" id="vx-space-renew-months-options">${opts}</div>`;
    },

    /**
     * Set custom footer for the renew confirm modal
     */
    _setRenewModalFooter() {
        const modalFooter = document.querySelector('#vx-shop-modal .vx-modal-footer');
        this._originalFooter = modalFooter ? modalFooter.innerHTML : null;
        if (modalFooter) {
            modalFooter.innerHTML = `
                <div></div>
                <div class="vx-modal-actions">
                    <button class="vx-btn vx-btn-secondary" onclick="VX_SHOP.closeModal(); VX_SHOP.restoreModalFooter()">
                        ${this.t('btn_cancel', '取消')}
                    </button>
                    <button class="vx-btn vx-btn-primary" id="vx-space-renew-submit-btn" onclick="VX_SHOP._submitSpaceRenew()">
                        <iconpark-icon name="rotate"></iconpark-icon>
                        ${this.t('vx_space_confirm_renew', '确认续费')}
                    </button>
                </div>
            `;
        }
    },

    /**
     * Update months selection UI and cost display
     */
    _selectRenewMonths(months) {
        this._spaceRenewMonths = months;

        document.querySelectorAll('#vx-space-renew-months-options .vx-renew-month-opt').forEach(opt => {
            opt.classList.toggle('selected', parseInt(opt.dataset.months) === months);
        });

        const totalCost = (this._spaceRenewTotalCostPerMonth || 0) * months;
        const costEl = document.getElementById('vx-space-renew-cost');
        if (costEl) {
            costEl.querySelector('.vx-renew-cost-value').innerHTML =
                `<strong>${totalCost}</strong> ${this.t('vx_pay_point', '点数')}`;
        }
    },

    /**
     * Submit the space renewal
     */
    async _submitSpaceRenew() {
        const ids = this._spaceRenewIds;
        const months = this._spaceRenewMonths || 1;
        if (!ids) return;

        const btn = document.getElementById('vx-space-renew-submit-btn');
        if (btn) btn.disabled = true;

        try {
            const totalCost = await this._doRenewSpaceMonths(ids, months);
            this.closeModal();
            this.restoreModalFooter();
            VXUI.toastSuccess(this.fmt('vx_space_renew_success', { cost: totalCost }, `续费成功！消耗 ${totalCost} 点数`));
            this.loadSpaces();
            if (typeof TL !== 'undefined' && TL.get_details) TL.get_details();
        } catch (e) {
            if (!e || e.message !== 'handled') {
                VXUI.toastError(this.t('vx_space_renew_failed', '续费失败'));
            }
            if (btn) btn.disabled = false;
        }
    },

    /**
     * Perform space renewal for N months (calls space_renew N times sequentially)
     * @returns {Promise<number>} total points spent
     */
    async _doRenewSpaceMonths(ids, months) {
        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
        VXUI.toastInfo(this.t('vx_processing', '处理中...'));
        let totalCost = 0;

        for (let i = 0; i < months; i++) {
            const response = await fetch(this.getShopApiUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ action: 'space_renew', token, ids: String(ids) }).toString()
            });
            const result = await this.parseJsonResponse(response, 'space_renew');

            if (result.status === 1) {
                totalCost += (result.data && result.data.cost) ? result.data.cost : 0;
            } else {
                const msg = this.getKnownSpaceErrorMessage(result, 'vx_space_renew_failed', '续费失败');
                VXUI.toastError(msg);
                throw new Error('handled');
            }
        }

        return totalCost;
    },

    /**
     * Load orders list from API
     */
    async loadOrders() {
        const ordersContainer = document.getElementById('vx-orders-list');
        if (!ordersContainer) return;
        
        // Show loading
        ordersContainer.innerHTML = `
            <div class="vx-orders-loading">
                <div class="vx-spinner"></div>
                <span>${this.t('vx_orders_loading', '加载订单中...')}</span>
            </div>
        `;
        
        try {
            const apiUrl = (typeof TL !== 'undefined' && TL.api_user) ? TL.api_user : '/api_v2/user';
            const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
            
            if (!token) {
                ordersContainer.innerHTML = `<div class="vx-orders-empty">${this.t('vx_need_login', '请先登录')}</div>`;
                return;
            }
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `action=order_list&token=${token}`
            });
            
            const rsp = await response.json();
            
            if (!rsp.data || !rsp.data.service || rsp.data.service === 0) {
                ordersContainer.innerHTML = `
                    <div class="vx-orders-empty">
                        <iconpark-icon name="folder-open" style="font-size: 48px; color: var(--vx-text-muted);"></iconpark-icon>
                        <p>${this.t('vx_orders_empty', '暂无已购项目')}</p>
                    </div>
                `;
                return;
            }
            
            // Process orders
            const orders = this.processOrders(rsp.data.service);
            
            if (Object.keys(orders).length === 0) {
                ordersContainer.innerHTML = `
                    <div class="vx-orders-empty">
                        <iconpark-icon name="folder-open" style="font-size: 48px; color: var(--vx-text-muted);"></iconpark-icon>
                        <p>${this.t('vx_orders_empty', '暂无已购项目')}</p>
                    </div>
                `;
                return;
            }
            
            // Render orders
            let html = '';
            for (const key in orders) {
                const order = orders[key];

                html += `
                    <div class="vx-order-item">
                        <div class="vx-order-icon">
                            <iconpark-icon name="${order.icon}"></iconpark-icon>
                        </div>
                        <div class="vx-order-info">
                            <div class="vx-order-name">${order.name}</div>
                            <div class="vx-order-expiry">${this.t('oders_table3', '到期时间')}:${order.etime}</div>
                            <div class="vx-order-desc">${order.des}</div>
                        </div>
                    </div>
                `;
            }
            
            ordersContainer.innerHTML = html;
            
        } catch (e) {
            console.error('[VX_SHOP] Failed to load orders:', e);
            ordersContainer.innerHTML = `
                <div class="vx-orders-empty">
                    <iconpark-icon name="circle-exclamation" style="font-size: 48px; color: var(--vx-danger);"></iconpark-icon>
                    <p>${this.t('vx_load_failed', '加载失败')}</p>
                </div>
            `;
        }
    },
    
    /**
     * Process orders data (similar to TL.service_code)
     */
    processOrders(data) {
        const orders = {};
        for (let i in data) {
            const item = data[i];
            orders[i] = {
                name: '',
                des: '',
                icon: '',
                etime: item.etime,
                code: item.code
            };
            
            switch (item.code) {
                case 'hs':
                    orders[i].name = this.t('service_code_hs', '赞助者');
                    orders[i].des = this.t('service_code_hs_des', '感谢您为钛盘的持续进化添砖加瓦。');
                    orders[i].icon = 'heart-circle-check';
                    break;
                case 'storage':
                    const storageSize = typeof bytetoconver === 'function' ? bytetoconver(item.val, true) : `${item.val} B`;
                    orders[i].name = `${this.t('service_code_storage', '存储包')} (${storageSize})`;
                    orders[i].des = this.t('service_code_storage_des', '使用存储包可以长期保存上传的文件，不同容量的存储包可以叠加。');
                    orders[i].icon = 'album-circle-plus';
                    break;
                case 'media-video':
                    const mediaSize = typeof bytetoconver === 'function' ? bytetoconver(item.val, true) : `${item.val} B`;
                    orders[i].name = `${this.t('service_code_media', '媒体配额')} (${mediaSize})`;
                    orders[i].des = this.t('service_code_media_des', '用于在线播放视频和音频文件。');
                    orders[i].icon = 'circle-video';
                    break;
                default:
                    // Unknown code, remove item
                    delete orders[i];
                    break;
            }
        }
        return orders;
    },
    
    /**
     * Format bytes to human readable
     */
    formatBytes(bytes) {
        if (!bytes) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let i = 0;
        while (bytes >= 1024 && i < units.length - 1) {
            bytes /= 1024;
            i++;
        }
        return bytes.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
    },
    
    /**
     * Open sponsor purchase modal
     */
    openSponsor() {
        this.trackUI('vui_shop[sponsor]');
        this.purchaseType = 'addon';
        this.selectedProduct = 'sponsor';
        this.selectedCode = 'HS';
        this.selectedTime = 1;
        
        const modalTitle = document.getElementById('vx-modal-title');
        const modalBody = document.getElementById('vx-modal-body');

        if (!modalTitle || !modalBody) {
            console.error('[VX_SHOP] Modal elements not found!');
            return;
        }
        
        modalTitle.innerHTML = '<iconpark-icon name="heart-circle-plus"></iconpark-icon> ' + 
            this.t('model_title_sponsor', '成为赞助者');
        
        modalBody.innerHTML = `
            <p class="vx-modal-desc">${this.t('model_des_sponsor', '获得高速通道、蓝标认证、媒体播放等特权')}</p>
            <p class="vx-modal-desc">${this.t('sponsor_content', '免费，不限速，无广告，这些特性都离不开钛盘赞助者们的支持。<br>财力雄厚的你愿意为这美好的愿景添砖加瓦吗？我们非常欢迎！<br>当然不会亏待赞助者，我们为赞助者们准备以下权益：')}</p>
            <ul class="vx-sponsor-rights">
                <li>${this.t('sponsor_right_1', '通过高速通道下载文件')}</li>
                <li>${this.t('sponsor_right_2', '100 GB 私有存储空间')}</li>
                <li>${this.t('sponsor_right_3', '功能增强：上传效率')}</li>
                <li>${this.t('sponsor_right_4', '在文件下载页和文件夹中展示您的个性化头像和签名')}</li>
                <li>${this.t('sponsor_right_5', '在线点播任意视频')}</li>
                <li>${this.t('sponsor_right_6', '优先认证')}</li>
                <li>${this.t('sponsor_right_7', '更多的智能小薇对话机会')}</li>
                <li>${this.t('sponsor_right_8', '摆摊：出售您的文件')}</li>
            </ul>
            
            <h4 class="vx-section-title">${this.t('payment_duration', '选择时长')}</h4>
            <div class="vx-purchase-options">
                <div class="vx-purchase-option selected" data-type="time" data-time="1" onclick="VX_SHOP.selectTime(1)">
                    <h4>1 月</h4>
                    <div class="vx-option-price">¥${this.products.sponsor.monthlyPrice} / $${Math.ceil(this.products.sponsor.monthlyPrice / 6)}</div>
                </div>
                <div class="vx-purchase-option" data-type="time" data-time="12" onclick="VX_SHOP.selectTime(12)">
                    <h4>1 ${this.t('payment_year', '年')}</h4>
                    <div class="vx-option-price">¥${this.products.sponsor.prices['12']} / $${Math.ceil(this.products.sponsor.prices['12'] / 6)}</div>
                </div>
            </div>
            
            ${this.renderPaymentMethods()}
        `;
        
        this.updateModalPrice();
        this.showModal();
    },
    
    /**
     * Open storage purchase modal
     * @param {string} [spec='256g'] - Pre-selected spec: '256g' or '1t'
     */
    openStorage(spec = '256g') {
        this.trackUI('vui_shop[storage]');

        // Check if already at 10TB cap
        if ((this._totalActiveSpaceBytes || 0) >= this._SPACE_CAP_BYTES) {
            VXUI.toastWarning(this.t('vx_space_cap_reached', '私有空间已达上限（10TB），无法继续购买'));
            return;
        }

        this.purchaseType = 'space';
        this.selectedProduct = 'space';
        this.selectedCode = spec;
        this.selectedTime = 1;
        this.selectedPayment = 'point'; // Space only supports points
        this.spaceQuantity = 1;
        this.spaceMonths = 1;
        
        const modalTitle = document.getElementById('vx-modal-title');
        const modalBody = document.getElementById('vx-modal-body');

        if (!modalTitle || !modalBody) {
            console.error('[VX_SHOP] Modal elements not found!');
            return;
        }
        
        modalTitle.innerHTML = '<iconpark-icon name="album-circle-plus"></iconpark-icon> ' + 
            this.t('model_title_buy_storage', '私有空间');
        
        modalBody.innerHTML = `
            <p class="vx-modal-desc">${this.t('storage_content', '扩展您的私有存储空间')}</p>
            <p style="color: var(--vx-text-secondary); font-size: 13px; margin-bottom: 16px;">
                私有空间每次购买有效期为30天。可多次购买以叠加容量，总量上限为 10TB。
            </p>
            
            <h4 class="vx-section-title"><iconpark-icon name="database"></iconpark-icon> ${this.t('payment_capacity', '选择容量')}</h4>
            <div class="vx-purchase-options">
                <div class="vx-purchase-option ${spec === '256g' ? 'selected' : ''}" data-code="256g" onclick="VX_SHOP.selectCode('256g')">
                    <h4>256GB</h4>
                    <div class="vx-option-price">600 ${this.t('vx_pay_point', '点数')} / 30天</div>
                </div>
                <div class="vx-purchase-option ${spec === '1t' ? 'selected' : ''}" data-code="1t" onclick="VX_SHOP.selectCode('1t')">
                    <h4>1TB</h4>
                    <div class="vx-option-price">2000 ${this.t('vx_pay_point', '点数')} / 30天</div>
                </div>
            </div>

            <h4 class="vx-section-title"><iconpark-icon name="list"></iconpark-icon> ${this.t('vx_space_buy_copies', '购买份数')}</h4>
            <div class="vx-space-slider-wrap">
                <div class="vx-space-slider-head">
                    <strong id="vx-space-qty-value">1 ${this.t('vx_space_buy_copies_unit', '份')}</strong>
                </div>
                <input type="range" class="vx-space-slider" id="vx-space-qty-range"
                    min="1" max="10" step="1" value="1" oninput="VX_SHOP.setSpaceQuantity(this.value)">
            </div>

            <h4 class="vx-section-title"><iconpark-icon name="timer"></iconpark-icon> ${this.t('vx_space_valid_months', '有效期')}</h4>
            <div class="vx-space-slider-wrap">
                <div class="vx-space-slider-head">
                    <strong id="vx-space-months-value">1 ${this.t('vx_space_month_abbr', '个月')}</strong>
                </div>
                <input type="range" class="vx-space-slider" id="vx-space-months-range"
                    min="1" max="12" step="1" value="1" oninput="VX_SHOP.setSpaceMonths(this.value)">
            </div>

            <div class="vx-space-calc-box" id="vx-space-calc-box">
                <div class="vx-space-calc-item">
                    <span><iconpark-icon name="database"></iconpark-icon> ${this.t('vx_space_result_capacity', '新增容量')}</span>
                    <strong id="vx-space-result-capacity">256 GB</strong>
                </div>
                <div class="vx-space-calc-item">
                    <span><iconpark-icon name="timer"></iconpark-icon> ${this.t('vx_space_result_period', '有效期')}</span>
                    <strong id="vx-space-result-period">1 ${this.t('vx_space_month_abbr', '个月')}</strong>
                </div>
            </div>

            <div id="vx-space-exceed-warning" class="vx-space-exceed-warning" style="display:none;">
                <iconpark-icon name="circle-exclamation"></iconpark-icon>
                <span>${this.t('vx_space_would_exceed', '计划购买容量超出上限（10TB），请减少份数')}</span>
            </div>
            
            <h4 class="vx-section-title"><iconpark-icon name="funds"></iconpark-icon> ${this.t('payment_method', '支付方式')}</h4>
            <div class="vx-payment-methods">
                <div class="vx-payment-method selected" onclick="VX_SHOP.selectPayment('point')">
                    <span class="vx-pay-icon vx-pay-point"><iconpark-icon name="funds"></iconpark-icon></span>
                    <span>${this.t('vx_pay_point', '点数')}</span>
                </div>
            </div>
        `;

        this.updateSpacePurchasePreview();
        
        this.updateModalPrice();
        this.showModal();
    },

    setSpaceQuantity(value) {
        this.spaceQuantity = Math.max(1, Math.min(10, parseInt(value, 10) || 1));
        this.updateSpacePurchasePreview();
        this.updateModalPrice();
    },

    setSpaceMonths(value) {
        this.spaceMonths = Math.max(1, Math.min(12, parseInt(value, 10) || 1));
        this.updateSpacePurchasePreview();
        this.updateModalPrice();
    },

    updateSpacePurchasePreview() {
        if (this.purchaseType !== 'space') return;

        const quantity = Math.max(1, Math.min(10, parseInt(this.spaceQuantity, 10) || 1));
        const months = Math.max(1, Math.min(12, parseInt(this.spaceMonths, 10) || 1));

        const qtyEl = document.getElementById('vx-space-qty-value');
        const monthsEl = document.getElementById('vx-space-months-value');
        const resultCapEl = document.getElementById('vx-space-result-capacity');
        const resultPeriodEl = document.getElementById('vx-space-result-period');
        const qtyRangeEl = document.getElementById('vx-space-qty-range');
        const monthsRangeEl = document.getElementById('vx-space-months-range');

        if (qtyEl) qtyEl.textContent = `${quantity} ${this.t('vx_space_buy_copies_unit', '份')}`;
        if (monthsEl) monthsEl.textContent = `${months} ${this.t('vx_space_month_abbr', '个月')}`;

        const totalBytes = this.getSpaceSpecBytes(this.selectedCode) * quantity;
        const totalCapText = this.formatBytes(totalBytes);
        if (resultCapEl) resultCapEl.textContent = totalCapText;
        if (resultPeriodEl) resultPeriodEl.textContent = `${months} ${this.t('vx_space_month_abbr', '个月')}`;

        this._updateRangeProgress(qtyRangeEl, quantity, 1, 10);
        this._updateRangeProgress(monthsRangeEl, months, 1, 12);

        // Check if planned purchase would exceed 10TB cap
        const alreadyBytes = this._totalActiveSpaceBytes || 0;
        const plannedBytes = this.getSpaceSpecBytes(this.selectedCode) * quantity;
        const wouldExceed = alreadyBytes + plannedBytes > this._SPACE_CAP_BYTES;

        const warningEl = document.getElementById('vx-space-exceed-warning');
        if (warningEl) warningEl.style.display = wouldExceed ? '' : 'none';

        const payBtn = document.querySelector('#vx-shop-modal .vx-btn-primary');
        if (payBtn) payBtn.disabled = wouldExceed;
    },

    _updateRangeProgress(el, value, min, max) {
        if (!el || max <= min) return;
        const pct = ((value - min) / (max - min)) * 100;
        el.style.setProperty('--vx-slider-pct', `${pct}%`);
    },
    
    /**
     * Open direct quota purchase modal
     */
    openQuota() {
        this.trackUI('vui_shop[quota]');
        this.purchaseType = 'direct';
        this.selectedProduct = 'direct';
        this.selectedCode = 'D20';
        this.quantity = 1;
        
        const modalTitle = document.getElementById('vx-modal-title');
        const modalBody = document.getElementById('vx-modal-body');

        if (!modalTitle || !modalBody) {
            console.error('[VX_SHOP] Modal elements not found!');
            return;
        }
        
        modalTitle.innerHTML = '<iconpark-icon name="share-nodes"></iconpark-icon> ' + 
            this.t('model_title_buy_direct_quota', '优先配额（直链）');
        
        const items = this.products.direct.items;
        
        modalBody.innerHTML = `
            <p class="vx-modal-desc">${this.t('direct_quota_content', '当您通过直链为其他人提供文件下载服务时，可以使用优先配额获得最大下载速度。')}</p>
            <p style="color: var(--vx-text-secondary); font-size: 13px; margin-bottom: 16px;">
                ${this.t('direct_quota_content2', '优先配额不会过期。多次购买会叠加此配额。')}
            </p>
            
            <h4 class="vx-section-title">${this.t('direct_quota_type', '配额')}</h4>
            <div class="vx-purchase-options vx-purchase-options-grid">
                <div class="vx-purchase-option selected" onclick="VX_SHOP.selectDirectCode('D20')">
                    <h4>${items['D20'].size}</h4>
                    <div class="vx-option-price">¥${items['D20'].price}</div>
                </div>
                <div class="vx-purchase-option" onclick="VX_SHOP.selectDirectCode('D100')">
                    <h4>${items['D100'].size}</h4>
                    <div class="vx-option-price">¥${items['D100'].price}</div>
                </div>
                <div class="vx-purchase-option" onclick="VX_SHOP.selectDirectCode('D600')">
                    <h4>${items['D600'].size}</h4>
                    <div class="vx-option-price">¥${items['D600'].price}</div>
                </div>
                <div class="vx-purchase-option" onclick="VX_SHOP.selectDirectCode('D1024')">
                    <h4>${items['D1024'].size}</h4>
                    <div class="vx-option-price">¥${items['D1024'].price}</div>
                </div>
            </div>
            
            <h4 class="vx-section-title">${this.t('model_buy_nums', '购买数量')}</h4>
            <div class="vx-quantity-input">
                <input type="number" value="1" min="1" max="99" id="vx-direct-quantity" onchange="VX_SHOP.setQuantity(this.value)">
            </div>
            
            ${this.renderPaymentMethods()}
        `;
        
        this.updateModalPrice();
        this.showModal();
    },
    
    /**
     * Select direct quota code
     */
    selectDirectCode(code) {
        this.selectedCode = code;
        
        // Update UI
        document.querySelectorAll('.vx-purchase-options-grid .vx-purchase-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Find and select the clicked option
        const items = this.products.direct.items;
        document.querySelectorAll('.vx-purchase-options-grid .vx-purchase-option').forEach(opt => {
            const h4 = opt.querySelector('h4');
            if (h4 && items[code] && h4.textContent === items[code].size) {
                opt.classList.add('selected');
            }
        });
        
        this.updateModalPrice();
    },
    
    /**
     * Buy first time sponsor special
     */
    async buyFirstTimeSponsor() {
        this.purchaseType = 'addon';
        this.selectedProduct = 'firstTimeSponsor';
        this.selectedCode = 'FN01';
        this.selectedTime = 1;
        
        const modalTitle = document.getElementById('vx-modal-title');
        modalTitle.innerHTML = '<iconpark-icon name="circle-heart"></iconpark-icon> ' + 
            this.t('first_time_sponsor_title', '初次赞助特典');
        
        const modalBody = document.getElementById('vx-modal-body');
        modalBody.innerHTML = `
            <p class="vx-modal-desc">${this.t('first_time_sponsor_description', '每位用户限一次！')}</p>
            
            <div style="text-align: center; padding: 20px 0;">
                <div style="font-size: 48px; font-weight: 700; color: var(--vx-primary);">
                    ${this.isCN() ? '¥36' : '$6'}
                </div>
                <div style="color: var(--vx-text-secondary);">
                    ${this.t('first_time_sponsor_subtitle', '第一次成为赞助者？一年仅需 36 元！')}
                </div>
            </div>
            
            ${this.renderPaymentMethods()}
        `;
        
        this.updateModalPrice();
        this.showModal();
    },
    
    /**
     * Render payment methods
     */
    renderPaymentMethods() {
        const isCN = this.isCN();
        // 每次渲染支付方式时同步重置默认选中状态，避免旧 selectedPayment 残留
        this.selectedPayment = isCN ? 'alipay' : 'paypal';
        
        return `
            <h4 class="vx-section-title">${this.t('payment_method', '支付方式')}</h4>
            <div class="vx-payment-methods">
                <div class="vx-payment-method ${isCN ? 'selected' : ''}" onclick="VX_SHOP.selectPayment('alipay')">
                    <span class="vx-pay-icon vx-pay-alipay">支</span>
                    <span>支付宝</span>
                </div>
                <div class="vx-payment-method ${!isCN ? 'selected' : ''}" onclick="VX_SHOP.selectPayment('paypal')">
                    <span class="vx-pay-icon vx-pay-paypal">P</span>
                    <span>PayPal</span>
                </div>
                <div class="vx-payment-method" onclick="VX_SHOP.selectPayment('point')">
                    <span class="vx-pay-icon vx-pay-point"><iconpark-icon name="funds"></iconpark-icon></span>
                    <span>${this.t('vx_pay_point', '点数')}</span>
                </div>
            </div>
        `;
    },
    
    /**
     * Select product code
     */
    selectCode(code) {
        this.selectedCode = code;
        
        // Update UI - use data-code attribute when available, fall back to h4 text
        document.querySelectorAll('.vx-purchase-options').forEach((group, index) => {
            if (index === 0) { // First group is capacity selection
                group.querySelectorAll('.vx-purchase-option').forEach(opt => {
                    opt.classList.remove('selected');
                    const dataCode = opt.dataset.code;
                    if (dataCode) {
                        if (dataCode === code) opt.classList.add('selected');
                    } else if (opt.querySelector('h4') && opt.querySelector('h4').textContent === code) {
                        opt.classList.add('selected');
                    }
                });
            }
        });

        if (this.purchaseType === 'space') {
            this.updateSpacePurchasePreview();
        }
        
        this.updateModalPrice();
    },
    
    /**
     * Select time period
     */
    selectTime(time) {
        this.selectedTime = time;
        
        // Update UI - find time selection options
        document.querySelectorAll('.vx-purchase-option[data-type="time"]').forEach(opt => {
            opt.classList.toggle('selected', String(opt.dataset.time) === String(time));
        });
        
        this.updateModalPrice();
    },
    
    /**
     * Select payment method
     */
    selectPayment(method) {
        this.selectedPayment = method;
        
        // Update UI
        document.querySelectorAll('.vx-payment-method').forEach(el => {
            el.classList.remove('selected');
            const text = el.textContent.toLowerCase();
            if ((method === 'alipay' && text.includes('支付宝')) ||
                (method === 'paypal' && text.includes('paypal')) ||
                (method === 'point' && (text.includes('点数') || text.includes('point')))) {
                el.classList.add('selected');
            }
        });
        
        this.updateModalPrice();
    },
    
    /**
     * Set quantity for direct quota
     */
    setQuantity(qty) {
        this.quantity = Math.max(1, Math.min(100, parseInt(qty) || 1));
        this.updateModalPrice();
    },
    
    /**
     * Calculate and update modal price
     */
    updateModalPrice() {
        let priceCNY = 0;
        
        if (this.purchaseType === 'space') {
            const unitPrice = this.getSpaceMonthlyPrice(this.selectedCode);
            const quantity = Math.max(1, Math.min(10, parseInt(this.spaceQuantity, 10) || 1));
            const months = Math.max(1, Math.min(12, parseInt(this.spaceMonths, 10) || 1));
            const pts = unitPrice * quantity * months;
            
            const unitEl = document.getElementById('vx-modal-unit');
            const totalEl = document.getElementById('vx-modal-total');
            if (unitEl) unitEl.textContent = '';
            if (totalEl) totalEl.textContent = pts + ' ' + this.t('vx_pay_point', '点数');
            return;
        }
        
        if (this.selectedProduct === 'firstTimeSponsor') {
            priceCNY = 36;
        } else if (this.selectedProduct === 'sponsor') {
            priceCNY = this.products.sponsor.prices[this.selectedTime.toString()];
        } else if (this.selectedProduct === 'storage') {
            const item = this.products.storage.items[this.selectedCode];
            if (item) {
                priceCNY = item.prices[this.selectedTime.toString()];
            }
        } else if (this.selectedProduct === 'direct') {
            const item = this.products.direct.items[this.selectedCode];
            if (item) {
                priceCNY = item.price * this.quantity;
            }
        }
        
        // Convert to USD if PayPal, points if Point
        let displayPrice = priceCNY;
        let unit = '¥';
        
        if (this.selectedPayment === 'paypal') {
            displayPrice = Math.ceil(priceCNY / 6);
            unit = '$';
        } else if (this.selectedPayment === 'point') {
            displayPrice = priceCNY * 100;
            unit = '';
            // 更新单位显示元素
            const unitEl = document.getElementById('vx-modal-unit');
            const totalEl = document.getElementById('vx-modal-total');
            if (unitEl) unitEl.textContent = '';
            if (totalEl) totalEl.textContent = displayPrice + ' ' + this.t('vx_points', '点数');
            return;
        }
        
        document.getElementById('vx-modal-unit').textContent = unit;
        document.getElementById('vx-modal-total').textContent = displayPrice;
    },
    
    /**
     * Show modal
     */
    showModal() {
        const modal = document.getElementById('vx-shop-modal');
        if (modal) {
            modal.classList.add('vx-modal-open');
            document.body.classList.add('vx-modal-body-open');
        } else {
            console.error('[VX_SHOP] Modal element not found!');
        }
    },
    
    /**
     * Close modal
     */
    closeModal() {
        const modal = document.getElementById('vx-shop-modal');
        if (modal) {
            modal.classList.remove('vx-modal-open');
            document.body.classList.remove('vx-modal-body-open');
        }
    },
    
    /**
     * Make order and redirect to payment (or buy with points)
     */
    async makeOrder() {
        this.trackUI('vui_shop[make_order]');

        if (this.purchaseType === 'space') {
            await this._buySpaceWithPoints();
            return;
        }

        // 点数支付：直接调用 point_buy API
        if (this.selectedPayment === 'point') {
            await this._buyWithPoints();
            return;
        }

        const isPayPal = this.selectedPayment === 'paypal';
        let priceCNY = 0;
        
        // Calculate price
        if (this.selectedProduct === 'firstTimeSponsor') {
            priceCNY = 36;
        } else if (this.selectedProduct === 'sponsor') {
            priceCNY = this.products.sponsor.prices[this.selectedTime.toString()];
        } else if (this.selectedProduct === 'storage') {
            const item = this.products.storage.items[this.selectedCode];
            if (item) {
                priceCNY = item.prices[this.selectedTime.toString()];
            }
        } else if (this.selectedProduct === 'direct') {
            const item = this.products.direct.items[this.selectedCode];
            if (item) {
                priceCNY = item.price * this.quantity;
            }
        }
        
        // Build payment URL
        let paymentUrl;
        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
        
        if (isPayPal) {
            const priceUSD = Math.ceil(priceCNY / 6);
            paymentUrl = `https://s12.tmp.link/payment/paypal/checkout_v2` +
                `?price=${priceUSD}` +
                `&token=${token}` +
                `&prepare_type=${this.purchaseType}` +
                `&prepare_code=${this.selectedCode}` +
                `&prepare_times=${this.purchaseType === 'direct' ? this.quantity : this.selectedTime}`;
        } else {
            paymentUrl = `https://pay.vezii.com/id4/pay_v2` +
                `?price=${priceCNY}` +
                `&token=${token}` +
                `&prepare_type=${this.purchaseType}` +
                `&prepare_code=${this.selectedCode}` +
                `&prepare_times=${this.purchaseType === 'direct' ? this.quantity : this.selectedTime}`;
        }
        
        // Close modal and redirect
        this.closeModal();
        
        // Open payment in new window
        window.open(paymentUrl, '_blank');
    },

    /**
     * Buy private space with points
     */
    async _buySpaceWithPoints() {
        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
        if (!token) {
            VXUI.toastWarning(this.t('vx_need_login', '请先登录'));
            return;
        }

        const buyBtn = document.querySelector('#vx-shop-modal .vx-btn-primary');
        if (buyBtn) buyBtn.disabled = true;

        VXUI.toastInfo(this.t('vx_processing', '处理中...'));

        try {
            const apiUrl = this.getShopApiUrl();
            const quantity = Math.max(1, Math.min(10, parseInt(this.spaceQuantity, 10) || 1));
            const months = Math.max(1, Math.min(12, parseInt(this.spaceMonths, 10) || 1));
            const spec = this.normalizeSpaceSpec(this.selectedCode);
            const unitPrice = this.getSpaceMonthlyPrice(spec);

            let totalCost = 0;
            const boughtIds = [];

            // 1) Buy N copies (each copy = one space record, 30 days)
            for (let i = 0; i < quantity; i++) {
                const buyResponse = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        action: 'space_buy',
                        token,
                        spec
                    }).toString()
                });
                const buyResult = await this.parseJsonResponse(buyResponse, 'space_buy');

                if (buyResult.status !== 1) {
                    const msg = this.getKnownSpaceErrorMessage(buyResult, 'vx_purchase_failed', '购买失败');
                    if (buyResult.status === 2102) {
                        // Server-side cap enforcement: refresh UI to reflect real state
                        this.loadSpaces();
                        VXUI.toastError(msg);
                    } else {
                        VXUI.toastError(msg);
                    }
                    // If some copies were already bought, reload spaces to show them
                    if (boughtIds.length > 0) this.loadSpaces();
                    return;
                }

                const boughtId = buyResult.data && buyResult.data.id;
                if (boughtId) boughtIds.push(boughtId);
                totalCost += Number((buyResult.data && buyResult.data.price) || unitPrice);
            }

            // 2) Extend to M months by renewing these newly bought records (M-1 times)
            if (months > 1 && boughtIds.length > 0) {
                const renewIds = boughtIds.join(',');
                for (let m = 1; m < months; m++) {
                    const renewResponse = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            action: 'space_renew',
                            token,
                            ids: renewIds
                        }).toString()
                    });
                    const renewResult = await this.parseJsonResponse(renewResponse, 'space_renew');

                    if (renewResult.status !== 1) {
                        const msg = this.getKnownSpaceErrorMessage(renewResult, 'vx_space_renew_failed', '续费失败');
                        VXUI.toastError(msg);
                        this.loadSpaces();
                        if (typeof TL !== 'undefined' && TL.get_details) {
                            TL.get_details(() => this.loadUserStatus());
                        } else {
                            this.loadUserStatus();
                        }
                        return;
                    }

                    totalCost += Number((renewResult.data && renewResult.data.cost) || (unitPrice * quantity));
                }
            }

            this.closeModal();
            VXUI.toastSuccess(this.fmt('vx_space_renew_success', { cost: totalCost }, `购买成功！共消耗 ${totalCost} 点数`));

            // 刷新用户数据与列表
            if (typeof TL !== 'undefined' && TL.get_details) {
                TL.get_details(() => this.loadUserStatus());
            } else {
                this.loadUserStatus();
            }
            this.loadSpaces();
        } catch (e) {
            console.error('[VX_SHOP] _buySpaceWithPoints error:', e);
            if (e && e.message === 'invalid_json_response') {
                VXUI.toastError(this.t('vx_load_failed', '加载失败'));
            } else {
                VXUI.toastError(this.t('error_network', '网络错误'));
            }
        } finally {
            if (buyBtn) buyBtn.disabled = false;
        }
    },

    /**
     * 使用点数购买商品 (point_buy API)
     */
    async _buyWithPoints() {
        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
        if (!token) {
            VXUI.toastWarning(this.t('vx_need_login', '请先登录'));
            return;
        }

        let productType = '';
        let productId = '';
        let productTimes = 1;

        if (this.selectedProduct === 'firstTimeSponsor') {
            productType = 'ADDON';
            productId = 'FN01';
            productTimes = 1;
        } else if (this.selectedProduct === 'sponsor') {
            productType = 'ADDON';
            productId = 'HS';
            productTimes = this.selectedTime;
        } else if (this.selectedProduct === 'storage') {
            productType = 'ADDON';
            productId = this.selectedCode;
            productTimes = this.selectedTime;
        } else if (this.selectedProduct === 'direct') {
            productType = 'DIRECT';
            productId = this.selectedCode;
            productTimes = this.quantity;
        } else {
            VXUI.toastError(this.t('vx_invalid_product', '无效商品'));
            return;
        }

        // 禁用按钮防重复提交
        const buyBtn = document.querySelector('#vx-shop-modal .vx-btn-primary');
        if (buyBtn) buyBtn.disabled = true;

        VXUI.toastInfo(this.t('vx_processing', '处理中...'));

        try {
            const apiUrl = (typeof TL !== 'undefined' && TL.api_pay) ? TL.api_pay : '/api_v2/pay';
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    action: 'point_buy',
                    token,
                    product_type: productType,
                    product_id: productId,
                    product_times: productTimes
                }).toString()
            });
            const result = await response.json();

            if (result.status === 1) {
                this.closeModal();
                VXUI.toastSuccess(this.t('vx_purchase_success', '购买成功！'));
                // 刷新用户数据
                if (typeof TL !== 'undefined' && TL.get_details) {
                    TL.get_details(() => this.loadUserStatus());
                } else {
                    this.loadUserStatus();
                }
            } else if (result.status === 1001) {
                VXUI.toastError(this.t('vx_point_insufficient', '点数不足'));
            } else if (result.status === 1002) {
                VXUI.toastError(this.t('vx_product_already_bought', '该商品不能重复购买'));
            } else {
                const msg = (result.data && result.data.message) || result.debug || this.t('vx_purchase_failed', '购买失败');
                VXUI.toastError(msg);
            }
        } catch (e) {
            console.error('[VX_SHOP] _buyWithPoints error:', e);
            VXUI.toastError(this.t('error_network', '网络错误'));
        } finally {
            if (buyBtn) buyBtn.disabled = false;
        }
    },
    
    /**
     * Redeem gift card
     */
    redeemGiftCard() {
        const modalTitle = document.getElementById('vx-modal-title');
        modalTitle.innerHTML = `<iconpark-icon name="gift"></iconpark-icon> ${this.t('vx_giftcard_title', '兑换礼品卡')}`;
        
        const modalBody = document.getElementById('vx-modal-body');
        modalBody.innerHTML = `
            <p class="vx-modal-desc">${this.t('vx_giftcard_desc', '输入您的礼品卡兑换码')}</p>
            
            <div class="vx-form-group">
                <input type="text" class="vx-input" id="vx-giftcard-code" 
                    placeholder="${this.t('vx_giftcard_placeholder', '请输入兑换码')}" style="text-transform: uppercase;">
            </div>
        `;
        
        // Update modal footer for gift card
        const modalFooter = document.querySelector('#vx-shop-modal .vx-modal-footer');
        const originalFooter = modalFooter.innerHTML;
        
        modalFooter.innerHTML = `
            <div></div>
            <div class="vx-modal-actions">
                <button class="vx-btn vx-btn-secondary" onclick="VX_SHOP.closeModal(); VX_SHOP.restoreModalFooter()">${this.t('btn_cancel', '取消')}</button>
                <button class="vx-btn vx-btn-primary" onclick="VX_SHOP.submitGiftCard()">${this.t('vx_giftcard_redeem', '兑换')}</button>
            </div>
        `;
        
        // Store original footer
        this._originalFooter = originalFooter;
        
        this.showModal();
        
        // Focus input
        setTimeout(() => {
            document.getElementById('vx-giftcard-code').focus();
        }, 100);
    },
    
    /**
     * Submit gift card redemption
     */
    async submitGiftCard() {
        const code = document.getElementById('vx-giftcard-code').value.trim().toUpperCase();
        
        if (!code) {
            VXUI.toastWarning(this.t('error_empty_giftcard', '请输入兑换码'));
            return;
        }

        this.trackUI('vui_shop[submit_giftcard]');
        
        try {
            const apiUrl = (typeof TL !== 'undefined' && TL.api_pay) ? TL.api_pay : '/api_v2/pay';
            const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `action=giftcard_active&token=${token}&code=${encodeURIComponent(code)}`
            });
            
            const result = await response.json();
            
            if (result.status === 1) {
                VXUI.toastSuccess(this.t('giftcard_success', '兑换成功！'));
                this.closeModal();
                this.restoreModalFooter();
                // Refresh user data
                if (typeof TL !== 'undefined' && TL.get_details) {
                    TL.get_details(() => {
                        this.loadUserStatus();
                    });
                } else {
                    this.loadUserStatus();
                }
            } else {
                VXUI.toastError(result.message || this.t('giftcard_error', '兑换失败'));
            }
        } catch (e) {
            console.error('[VX_SHOP] Gift card redemption error:', e);
            VXUI.toastError(this.t('error_network', '网络错误'));
        }
    },
    
    /**
     * Restore modal footer after gift card dialog
     */
    restoreModalFooter() {
        if (this._originalFooter) {
            const modalFooter = document.querySelector('#vx-shop-modal .vx-modal-footer');
            modalFooter.innerHTML = this._originalFooter;
            this._originalFooter = null;
        }
    },
    
    /**
     * Refresh shop data
     */
    refresh() {
        this.checkFirstTimeSponsor();
        this.loadUserStatus();
        if (this.currentTab === 'spaces') {
            this.loadSpaces();
        } else if (this.currentTab === 'purchased') {
            this.loadOrders();
        }
        VXUI.toastInfo(this.t('vx_refreshed', '已刷新'));
    },

    /**
     * Refresh dynamic text content (called on language change)
     */
    refreshDynamicText() {
        // Update header subtitle
        const subtitleEl = document.getElementById('vx-shop-header-subtitle');
        if (subtitleEl) {
            if (this.currentTab === 'purchased') {
                subtitleEl.textContent = ' - ' + this.t('navbar_hr_shop', '已购');
            } else if (this.currentTab === 'spaces') {
                subtitleEl.textContent = ' - ' + this.t('vx_space_mgmt', '私有空间');
            } else {
                subtitleEl.textContent = '';
            }
        }

        // Reload content for the active tab
        if (this.currentTab === 'purchased') {
            this.loadOrders();
        }
    },
    /**
     * Exchange sponsor rights with share value
     */
    async exchangeSponsorByShare() {
        if (this.isSponsorExchangeProcessing) return;

        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
        if (!token) {
            VXUI.toastWarning(this.t('vx_need_login', '请先登录'));
            setTimeout(() => {
                if (typeof app !== 'undefined' && typeof app.open === 'function') {
                    app.open('/login');
                }
            }, 800);
            return;
        }

        this.trackUI('vui_shop[exchange_sponsor_share]');
        this.isSponsorExchangeProcessing = true;
        VXUI.toastInfo(this.t('sponsor_exchange_processing', '正在为您兑换...'));

        try {
            const apiUrl = (typeof TL !== 'undefined' && TL.api_pay) ? TL.api_pay : '/api_v2/pay';
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `action=ac_exchange&token=${encodeURIComponent(token)}`
            });

            const result = await response.json();

            if (result.status === 1) {
                VXUI.toastSuccess(this.t('sponsor_exchange_success', '兑换成功！'));
                if (typeof TL !== 'undefined' && TL.get_details) {
                    TL.get_details(() => {
                        this.loadUserStatus();
                    });
                } else {
                    this.loadUserStatus();
                }
            } else if (result.status === 1004) {
                VXUI.toastWarning(this.t('sponsor_exchange_insufficient', '分享値不足 100'));
            } else if (result.status === 1002) {
                VXUI.toastWarning(this.t('sponsor_exchange_already', '本月已兑换'));
            } else if (result.status === 0) {
                VXUI.toastError(this.t('sponsor_exchange_auth_fail', '登录已失效，请重新登录'));
                setTimeout(() => {
                    if (typeof app !== 'undefined' && typeof app.open === 'function') {
                        app.open('/login');
                    }
                }, 800);
            } else {
                VXUI.toastError(result.debug || this.t('sponsor_exchange_error', '兑换失败'));
            }
        } catch (e) {
            console.error('[VX_SHOP] Sponsor exchange error:', e);
            VXUI.toastError(this.t('sponsor_exchange_error', '兑换失败'));
        } finally {
            this.isSponsorExchangeProcessing = false;
        }
    },

    // ==================== 点数管理 ====================

    /**
     * 加载点数变动历史
     */
    async loadPointLog(page = 0) {
        const container = document.getElementById('vx-point-log-list');
        if (!container) return;

        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
        if (!token) {
            container.innerHTML = `<div class="vx-orders-empty">${this.t('vx_need_login', '请先登录')}</div>`;
            return;
        }

        container.innerHTML = `
            <div class="vx-orders-loading">
                <div class="vx-spinner"></div>
                <span>${this.t('vx_loading', '加载中...')}</span>
            </div>
        `;

        try {
            const apiUrl = (typeof TL !== 'undefined' && TL.api_pay) ? TL.api_pay : '/api_v2/pay';
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `action=point_log&token=${encodeURIComponent(token)}&page=${page}`
            });
            const rsp = await response.json();

            if (rsp.status === 101 || !rsp.data || !Array.isArray(rsp.data)) {
                container.innerHTML = `
                    <div class="vx-orders-empty">
                        <iconpark-icon name="folder-open" style="font-size:48px;color:var(--vx-text-muted);"></iconpark-icon>
                        <p>${this.t('vx_no_point_log', '暂无点数变动记录')}</p>
                    </div>
                `;
                return;
            }

            const actionLabels = {
                'charge': this.t('vx_point_charge', '充値'),
                'buy': this.t('vx_point_buy', '购买商品'),
                'transfer_out': this.t('vx_point_transfer_out', '转出'),
                'transfer_in': this.t('vx_point_transfer_in', '转入'),
                'file_purchase': this.t('vx_point_file_purchase', '购买文件'),
                'file_sale': this.t('vx_point_file_sale', '文件售出收入')
            };

            let html = '';
            for (const record of rsp.data) {
                const changeClass = record.change >= 0 ? 'vx-point-income' : 'vx-point-expense';
                const changeText = record.change >= 0 ? `+${record.change}` : `${record.change}`;
                const actionLabel = actionLabels[record.action] || record.action;
                html += `
                    <div class="vx-point-log-item">
                        <div class="vx-point-log-icon">
                            <iconpark-icon name="${record.change >= 0 ? 'income-one' : 'expenses-one'}"></iconpark-icon>
                        </div>
                        <div class="vx-point-log-info">
                            <div class="vx-point-log-action">${this.escapeHtml(actionLabel)}</div>
                            <div class="vx-point-log-content" title="${this.escapeHtml(record.content || '')}">
                                ${this.escapeHtml(record.content || '')}
                            </div>
                            <div class="vx-point-log-time">${record.ctime || ''}</div>
                        </div>
                        <div class="vx-point-log-amount">
                            <span class="${changeClass}">${changeText}</span>
                            <div class="vx-point-log-balance">${this.t('vx_point_after', '余额')}: ${record.now}</div>
                        </div>
                    </div>
                `;
            }

            // 分页按钮
            const paginationHtml = `
                <div class="vx-point-pagination">
                    ${page > 0 ? `<button class="vx-btn vx-btn-secondary" onclick="VX_SHOP.loadPointLog(${page - 1})">上一页</button>` : ''}
                    <span>${this.t('vx_page', '第')} ${page + 1} ${this.t('vx_page_suffix', '页')}</span>
                    ${rsp.data.length >= 20 ? `<button class="vx-btn vx-btn-secondary" onclick="VX_SHOP.loadPointLog(${page + 1})">下一页</button>` : ''}
                </div>
            `;

            container.innerHTML = html + paginationHtml;

        } catch (e) {
            console.error('[VX_SHOP] loadPointLog error:', e);
            container.innerHTML = `
                <div class="vx-orders-empty">
                    <iconpark-icon name="circle-exclamation" style="font-size:48px;color:var(--vx-danger);"></iconpark-icon>
                    <p>${this.t('vx_load_failed', '加载失败')}</p>
                </div>
            `;
        }
    },

    /**
     * 打开点数转账弹窗
     */
    openPointTransfer() {
        this.trackUI('vui_shop[point_transfer]');
        const modalTitle = document.getElementById('vx-modal-title');
        const modalBody = document.getElementById('vx-modal-body');
        if (!modalTitle || !modalBody) return;

        modalTitle.innerHTML = `<iconpark-icon name="expenses"></iconpark-icon> ${this.t('vx_point_transfer_title', '点数转账')}`;
        modalBody.innerHTML = `
            <p class="vx-modal-desc">${this.t('vx_transfer_desc', '将您账户内的点数转给其他用户。无手续费，收入方全额到账。最少 100 点。')}</p>
            <div class="vx-form-group" style="margin-bottom:16px;">
                <label style="font-size:14px;font-weight:500;color:var(--vx-text);display:block;margin-bottom:6px;">
                    ${this.t('vx_to_uid', '收款用户 UID')}
                </label>
                <input type="number" id="vx-transfer-uid" class="vx-input" min="1"
                    placeholder="${this.t('vx_enter_uid', '请输入对方 UID')}" style="width:100%;">
            </div>
            <div class="vx-form-group">
                <label style="font-size:14px;font-weight:500;color:var(--vx-text);display:block;margin-bottom:6px;">
                    ${this.t('vx_transfer_amount', '转账点数')}
                </label>
                <input type="number" id="vx-transfer-amount" class="vx-input" min="100"
                    placeholder="${this.t('vx_min_100_points', '最少 100 点')}" style="width:100%;">
            </div>
        `;

        const modalFooter = document.querySelector('#vx-shop-modal .vx-modal-footer');
        this._originalFooter = modalFooter ? modalFooter.innerHTML : null;
        if (modalFooter) {
            modalFooter.innerHTML = `
                <div></div>
                <div class="vx-modal-actions">
                    <button class="vx-btn vx-btn-secondary" onclick="VX_SHOP.closeModal(); VX_SHOP.restoreModalFooter()">${this.t('btn_cancel', '取消')}</button>
                    <button class="vx-btn vx-btn-primary" id="vx-transfer-submit-btn" onclick="VX_SHOP.submitPointTransfer()">${this.t('vx_transfer_submit', '确认转账')}</button>
                </div>
            `;
        }

        this.showModal();
        setTimeout(() => {
            const el = document.getElementById('vx-transfer-uid');
            if (el) el.focus();
        }, 100);
    },

    /**
     * 提交点数转账
     */
    async submitPointTransfer() {
        const toUid = parseInt(document.getElementById('vx-transfer-uid')?.value || '0', 10);
        const amount = parseInt(document.getElementById('vx-transfer-amount')?.value || '0', 10);

        if (!toUid || toUid <= 0) {
            VXUI.toastWarning(this.t('vx_enter_valid_uid', '请输入有效的 UID'));
            return;
        }
        if (!amount || amount < 100) {
            VXUI.toastWarning(this.t('vx_min_transfer', '转账最少 100 点'));
            return;
        }

        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
        if (!token) {
            VXUI.toastWarning(this.t('vx_need_login', '请先登录'));
            return;
        }

        const btn = document.getElementById('vx-transfer-submit-btn');
        if (btn) btn.disabled = true;

        this.trackUI('vui_shop[submit_transfer]');

        try {
            const apiUrl = (typeof TL !== 'undefined' && TL.api_pay) ? TL.api_pay : '/api_v2/pay';
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    action: 'point_transfer',
                    token,
                    to_uid: toUid,
                    amount
                }).toString()
            });
            const result = await response.json();

            if (result.status === 1) {
                VXUI.toastSuccess(this.t('vx_transfer_success', '转账成功'));
                this.closeModal();
                this.restoreModalFooter();
                // 刷新点数日志
                this.loadPointLog(0);
            } else {
                const debugErrorMap = {
                    'amount_too_low':        this.t('vx_transfer_err_amount_too_low', '转账金额未达最低限额（100 点）'),
                    'transfer_to_self':      this.t('vx_transfer_err_to_self', '不能向自己转账'),
                    'target_user_not_found': this.t('vx_transfer_err_user_not_found', '目标用户不存在'),
                    'insufficient_points':   this.t('vx_transfer_err_insufficient', '点数不足'),
                    'transfer_out_failed':   this.t('vx_transfer_err_system', '系统出错，请联系管理员'),
                    'transfer_in_failed':    this.t('vx_transfer_err_system', '系统出错，请联系管理员'),
                };
                const debugKey = Array.isArray(result.debug) ? result.debug[0] : null;
                const msg = (debugKey && debugErrorMap[debugKey])
                    || (result.data && result.data.message)
                    || this.t('vx_transfer_failed', '转账失败');
                VXUI.toastError(msg);
                if (btn) btn.disabled = false;
            }
        } catch (e) {
            console.error('[VX_SHOP] submitPointTransfer error:', e);
            VXUI.toastError(this.t('error_network', '网络错误'));
            if (btn) btn.disabled = false;
        }
    },

    /**
     * 打开点数充值中心
     */
    openPointRecharge() {
        this.trackUI('vui_shop[point_recharge]');
        const isCN = this.isCN();
        const rate = isCN ? 100 : 600;
        const minAmount = isCN ? 1 : 10;
        const maxAmount = 500;
        const currency = isCN ? '¥' : '$';

        const modalTitle = document.getElementById('vx-modal-title');
        const modalBody = document.getElementById('vx-modal-body');
        if (!modalTitle || !modalBody) return;

        modalTitle.innerHTML = `<iconpark-icon name="paper-money-two"></iconpark-icon> ${this.t('vx_recharge_title', '点数充值')}`;

        const presets = isCN
            ? [10, 30, 60, 100]
            : [10, 20, 50, 100];

        const presetsHtml = presets.map(p => `
            <div class="vx-recharge-preset" onclick="VX_SHOP._selectRechargePreset(${p})">
                ${currency}${p}
                <span class="vx-recharge-preset-points">= ${p * rate} ${this.t('vx_points', '点数')}</span>
            </div>
        `).join('');

        modalBody.innerHTML = `
            <p class="vx-modal-desc">${isCN
                ? this.t('vx_recharge_rate_cny', '1 元 = 100 点。')
                : this.t('vx_recharge_rate_usd', '1 USD = 600 点。')}</p>
            <div class="vx-recharge-presets">${presetsHtml}</div>
            <div class="vx-recharge-custom">
                <label class="vx-recharge-custom-label">${this.t('vx_custom_amount', '自定义金额')}</label>
                <div class="vx-recharge-input-row">
                    <span class="vx-recharge-currency">${currency}</span>
                    <input type="number" id="vx-recharge-amount" class="vx-input"
                        min="${minAmount}" max="${maxAmount}" step="1" value="${presets[0]}"
                        placeholder="${currency}${minAmount} - ${currency}${maxAmount}"
                        style="flex:1;"
                        oninput="VX_SHOP._updateRechargePreview()">
                </div>
                <div id="vx-recharge-preview" class="vx-recharge-preview">
                    = ${presets[0] * rate} ${this.t('vx_points', '点数')}
                </div>
            </div>
        `;

        // store state for submit
        this._rechargeIsCN = isCN;
        this._rechargeRate = rate;
        this._rechargeMinAmount = minAmount;
        this._rechargeMaxAmount = maxAmount;

        const modalFooter = document.querySelector('#vx-shop-modal .vx-modal-footer');
        this._originalFooter = modalFooter ? modalFooter.innerHTML : null;
        if (modalFooter) {
            modalFooter.innerHTML = `
                <div></div>
                <div class="vx-modal-actions">
                    <button class="vx-btn vx-btn-secondary" onclick="VX_SHOP.closeModal(); VX_SHOP.restoreModalFooter()">${this.t('btn_cancel', '取消')}</button>
                    <button class="vx-btn vx-btn-primary" onclick="VX_SHOP.submitRecharge()">
                        <iconpark-icon name="paper-money-two"></iconpark-icon>
                        ${this.t('btn_recharge_now', '立即充值')}
                    </button>
                </div>
            `;
        }

        this.showModal();
    },

    /**
     * 快速选定充值预设金额
     */
    _selectRechargePreset(amount) {
        const input = document.getElementById('vx-recharge-amount');
        if (input) {
            input.value = amount;
            this._updateRechargePreview();
        }
        // 高亮选中的预设
        document.querySelectorAll('.vx-recharge-preset').forEach(el => {
            el.classList.toggle('vx-recharge-preset-active',
                parseInt(el.textContent) === amount || el.textContent.trim().startsWith(
                    (this._rechargeIsCN ? '¥' : '$') + amount
                ));
        });
    },

    /**
     * 实时更新点数预览
     */
    _updateRechargePreview() {
        const input = document.getElementById('vx-recharge-amount');
        const preview = document.getElementById('vx-recharge-preview');
        if (!input || !preview) return;
        const val = parseFloat(input.value) || 0;
        const points = Math.floor(val * (this._rechargeRate || 100));
        const currency = this._rechargeIsCN ? '¥' : '$';
        const min = this._rechargeMinAmount || 1;
        const max = this._rechargeMaxAmount || 500;
        if (val < min) {
            preview.textContent = this.fmt('vx_amount_too_low', { currency, min }, `最少 ${currency}${min}`);
            preview.style.color = 'var(--vx-danger)';
        } else if (val > max) {
            preview.textContent = this.fmt('vx_amount_too_high', { currency, max }, `单次最多 ${currency}${max}`);
            preview.style.color = 'var(--vx-danger)';
        } else {
            preview.textContent = `= ${points} ${this.t('vx_points', '点数')}`;
            preview.style.color = 'var(--vx-primary)';
        }
    },

    /**
     * 提交充值，跳转至支付页面
     */
    submitRecharge() {
        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
        const input = document.getElementById('vx-recharge-amount');
        if (!input) return;
        const amount = parseFloat(input.value) || 0;
        const min = this._rechargeMinAmount || 1;
        const max = this._rechargeMaxAmount || 500;
        const currency = this._rechargeIsCN ? '¥' : '$';
        if (amount < min) {
            VXUI.toastWarning(this.fmt('vx_amount_too_low_recharge', { currency, min }, `最少充值 ${currency}${min}`));
            input.focus();
            return;
        }
        if (amount > max) {
            VXUI.toastWarning(this.fmt('vx_amount_too_high_recharge', { currency, max }, `单次最多充值 ${currency}${max}`));
            input.focus();
            return;
        }
        const payUrl = this._rechargeIsCN
            ? `https://pay.vezii.com/id4/pay_v2?price=${amount}&token=${token}&prepare_type=POINT&prepare_code=POINT_CUSTOM`
            : `https://s12.tmp.link/payment/paypal/checkout_v2?price=${amount}&token=${token}&prepare_type=POINT&prepare_code=POINT_CUSTOM`;
        window.open(payUrl, '_blank');
    },

    /**
     * Helper to escape HTML
     */
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }
};

// Register module
VXUI.registerModule('shop', {
    template: '/tpl/vxui/shop.html',
    init: (params) => VX_SHOP.init(params)
});
