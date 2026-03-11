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

        // Restore tab from URL (deep-link)
        const nextTab = (params && params.tab) ? String(params.tab) : 'products';
        if (nextTab === 'purchased' || nextTab === 'products') {
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

        // Sync URL so products/purchased can be directly opened
        if (typeof VXUI !== 'undefined' && VXUI && typeof VXUI.updateUrl === 'function') {
            const currentParams = (typeof VXUI.getUrlParams === 'function') ? (VXUI.getUrlParams() || {}) : {};
            delete currentParams.module;

            if (tab === 'purchased') {
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
            } else {
                subtitleEl.textContent = '';
            }
        }
        
        // Show/hide content
        document.getElementById('vx-shop-products').style.display = tab === 'products' ? 'block' : 'none';
        document.getElementById('vx-shop-purchased').style.display = tab === 'purchased' ? 'block' : 'none';
        
        // Load content for the tab
        if (tab === 'purchased') {
            this.loadOrders();
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
                etime: item.etime
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
     */
    openStorage() {
        this.trackUI('vui_shop[storage]');
        this.purchaseType = 'addon';
        this.selectedProduct = 'storage';
        this.selectedCode = '256GB';
        this.selectedTime = 1;
        
        const modalTitle = document.getElementById('vx-modal-title');
        const modalBody = document.getElementById('vx-modal-body');

        if (!modalTitle || !modalBody) {
            console.error('[VX_SHOP] Modal elements not found!');
            return;
        }
        
        modalTitle.innerHTML = '<iconpark-icon name="album-circle-plus"></iconpark-icon> ' + 
            this.t('model_title_buy_storage', '私有空间');
        
        const items = this.products.storage.items;
        
        modalBody.innerHTML = `
            <p class="vx-modal-desc">${this.t('storage_content', '扩展您的私有存储空间')}</p>
            
            <h4 class="vx-section-title">${this.t('payment_capacity', '选择容量')}</h4>
            <div class="vx-purchase-options">
                <div class="vx-purchase-option selected" onclick="VX_SHOP.selectCode('256GB')">
                    <h4>256GB</h4>
                    <div class="vx-option-price">¥${items['256GB'].monthlyPrice}/月</div>
                </div>
                <div class="vx-purchase-option" onclick="VX_SHOP.selectCode('1TB')">
                    <h4>1TB</h4>
                    <div class="vx-option-price">¥${items['1TB'].monthlyPrice}/月</div>
                </div>
                <div class="vx-purchase-option" onclick="VX_SHOP.selectCode('3TB')">
                    <h4>3TB</h4>
                    <div class="vx-option-price">¥${items['3TB'].monthlyPrice}/月</div>
                </div>
                <div class="vx-purchase-option" onclick="VX_SHOP.selectCode('5TB')">
                    <h4>5TB</h4>
                    <div class="vx-option-price">¥${items['5TB'].monthlyPrice}/月</div>
                </div>
            </div>
            
            <h4 class="vx-section-title">${this.t('payment_duration', '选择时长')}</h4>
            <div class="vx-purchase-options">
                <div class="vx-purchase-option selected" data-type="time" data-time="1" onclick="VX_SHOP.selectTime(1)">
                    <h4>1 月</h4>
                </div>
                <div class="vx-purchase-option" data-type="time" data-time="12" onclick="VX_SHOP.selectTime(12)">
                    <h4>1 ${this.t('payment_year', '年')}</h4>
                </div>
            </div>
            
            ${this.renderPaymentMethods()}
        `;
        
        this.updateModalPrice();
        this.showModal();
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
        
        // Update UI
        document.querySelectorAll('.vx-purchase-options').forEach((group, index) => {
            if (index === 0) { // First group is capacity selection
                group.querySelectorAll('.vx-purchase-option').forEach(opt => {
                    opt.classList.remove('selected');
                    if (opt.querySelector('h4').textContent === code) {
                        opt.classList.add('selected');
                    }
                });
            }
        });
        
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
            } else {
                subtitleEl.textContent = '';
            }
        }
        
        // Reload content if on purchased tab
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
