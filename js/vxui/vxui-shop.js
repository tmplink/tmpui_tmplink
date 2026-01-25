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
                app.open('/app&listview=login');
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
                currentParams.tab = 'purchased';
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
            subtitleEl.textContent = tab === 'purchased' ? ' - ' + this.t('navbar_hr_shop', '已购') : '';
        }
        
        // Show/hide content
        document.getElementById('vx-shop-products').style.display = tab === 'products' ? 'block' : 'none';
        document.getElementById('vx-shop-purchased').style.display = tab === 'purchased' ? 'block' : 'none';
        
        // Load orders if switching to purchased tab
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
                (method === 'paypal' && text.includes('paypal'))) {
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
        
        // Convert to USD if PayPal
        let displayPrice = priceCNY;
        let unit = '¥';
        
        if (this.selectedPayment === 'paypal') {
            displayPrice = Math.ceil(priceCNY / 6);
            unit = '$';
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
     * Make order and redirect to payment
     */
    async makeOrder() {
        this.trackUI('vui_shop[make_order]');
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
        if (subtitleEl && this.currentTab === 'purchased') {
            subtitleEl.textContent = ' - ' + this.t('navbar_hr_shop', '已购');
        }
        
        // Reload orders if on purchased tab to refresh translated content
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
                    app.open('/app&listview=login');
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
                VXUI.toastWarning(this.t('sponsor_exchange_insufficient', '分享值不足 100'));
            } else if (result.status === 1002) {
                VXUI.toastWarning(this.t('sponsor_exchange_already', '本月已兑换'));
            } else if (result.status === 0) {
                VXUI.toastError(this.t('sponsor_exchange_auth_fail', '登录已失效，请重新登录'));
                setTimeout(() => {
                    if (typeof app !== 'undefined' && typeof app.open === 'function') {
                        app.open('/app&listview=login');
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
    }
};

// Register module
VXUI.registerModule('shop', {
    template: '/tpl/vxui/shop.html',
    init: (params) => VX_SHOP.init(params)
});
