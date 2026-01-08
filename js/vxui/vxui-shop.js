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
    
    // Product definitions
    products: {
        sponsor: {
            type: 'addon',
            code: 'HS',
            name: '赞助者',
            monthlyPrice: 6,
            prices: {
                '1': 72,   // 1 year (6*12)
                '10': 720  // 10 years
            }
        },
        storage: {
            type: 'addon',
            items: {
                '256GB': { code: '256GB', name: '256GB', monthlyPrice: 6, prices: { '1': 72, '10': 720 } },
                '1TB': { code: '1TB', name: '1TB', monthlyPrice: 18, prices: { '1': 216, '10': 2160 } },
                '3TB': { code: '3TB', name: '3TB', monthlyPrice: 66, prices: { '1': 792, '10': 7920 } },
                '5TB': { code: '5TB', name: '5TB', monthlyPrice: 120, prices: { '1': 1440, '10': 14400 } }
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
     * Initialize the shop module
     */
    init() {
        console.log('[VX_SHOP] Initializing shop module...');
        
        // Check login
        if (typeof TL !== 'undefined' && !TL.isLogin()) {
            VXUI.toastWarning('请先登录');
            setTimeout(() => {
                window.location.href = '/login';
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
        
        // Update tab buttons
        document.querySelectorAll('.vx-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`tab-${tab}`).classList.add('active');
        
        // Update sidebar nav (only module dynamic area)
        document.querySelectorAll('#vx-sidebar-dynamic .vx-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        const navItem = document.getElementById(`nav-shop-${tab}`);
        if (navItem) navItem.classList.add('active');
        
        // Show/hide content
        document.getElementById('vx-shop-products').style.display = tab === 'products' ? 'block' : 'none';
        document.getElementById('vx-shop-purchased').style.display = tab === 'purchased' ? 'block' : 'none';
        
        // Load user status if switching to purchased tab
        if (tab === 'purchased') {
            this.loadUserStatus();
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
     * Load user status for purchased tab
     */
    async loadUserStatus() {
        try {
            // Check if TL data is available
            if (typeof TL === 'undefined') {
                console.warn('[VX_SHOP] TL not available');
                return;
            }
            
            // Update avatar
            const avatarEl = document.getElementById('vx-user-avatar');
            if (avatarEl) {
                avatarEl.src = TL.avatar || '/img/avatar/default.png';
            }
            
            // Update username
            const nameEl = document.getElementById('vx-user-name');
            if (nameEl) {
                nameEl.textContent = TL.uname || '--';
            }
            
            // Get rank text
            const rankEl = document.getElementById('vx-user-rank');
            if (rankEl) {
                const isSponsor = TL.sponsor;
                rankEl.textContent = isSponsor ? '赞助者' : '普通用户';
            }
            
            // Update status items
            const formatDate = (timestamp) => {
                if (!timestamp) return '--';
                const date = new Date(timestamp * 1000);
                return date.toLocaleDateString('zh-CN');
            };
            
            const formatExpiry = (timestamp) => {
                if (!timestamp) return '未开通';
                if (timestamp === -1) return '永久';
                const now = Date.now() / 1000;
                if (timestamp < now) return '已过期';
                return formatDate(timestamp);
            };
            
            const group = TL.user_group || {};
            
            // Highspeed
            const highspeedEl = document.getElementById('vx-user-highspeed');
            if (highspeedEl) {
                highspeedEl.textContent = group.highspeed ? formatExpiry(group.highspeed) : '未开通';
            }
            
            // Blue verification
            const blueEl = document.getElementById('vx-user-blue');
            if (blueEl) {
                blueEl.textContent = group.blue ? formatExpiry(group.blue) : '未开通';
            }
            
            // DVD/Media
            const dvdEl = document.getElementById('vx-user-dvd');
            if (dvdEl) {
                dvdEl.textContent = group.dvd ? formatExpiry(group.dvd) : '未开通';
            }
            
            // Sponsor status
            const sponsorEl = document.getElementById('vx-user-sponsor');
            if (sponsorEl) {
                sponsorEl.textContent = TL.sponsor_time ? formatExpiry(TL.sponsor_time) : '未开通';
            }
            
            // Storage
            const storageEl = document.getElementById('vx-user-storage');
            if (storageEl) {
                const used = TL.storage_used || 0;
                const total = TL.storage || 0;
                storageEl.textContent = `${this.formatBytes(used)} / ${this.formatBytes(total)}`;
            }
            
            // Direct quota  
            const quotaEl = document.getElementById('vx-user-quota');
            if (quotaEl) {
                const acvDq = TL.user_acv_dq || TL.acv_dq;
                quotaEl.textContent = acvDq ? acvDq : '--';
            }
            
            // Account value (ACV)
            const acvEl = document.getElementById('vx-user-acv');
            if (acvEl) {
                acvEl.textContent = TL.user_acv !== undefined ? `¥${TL.user_acv}` : '--';
            }
            
            // Join date
            const joinEl = document.getElementById('vx-user-join');
            if (joinEl) {
                joinEl.textContent = TL.user_join ? formatDate(TL.user_join) : '--';
            }
                
        } catch (e) {
            console.error('[VX_SHOP] Failed to load user status:', e);
        }
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
            
            <h4 class="vx-section-title">${this.t('payment_duration', '选择时长')}</h4>
            <div class="vx-purchase-options">
                <div class="vx-purchase-option selected" onclick="VX_SHOP.selectTime(1)">
                    <h4>1 ${this.t('payment_year', '年')}</h4>
                    <div class="vx-option-price">¥72 / $12</div>
                </div>
                <div class="vx-purchase-option" onclick="VX_SHOP.selectTime(10)">
                    <h4>10 ${this.t('payment_year', '年')}</h4>
                    <div class="vx-option-price">¥720 / $120</div>
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
                <div class="vx-purchase-option selected" onclick="VX_SHOP.selectTime(1)">
                    <h4>1 ${this.t('payment_year', '年')}</h4>
                </div>
                <div class="vx-purchase-option" onclick="VX_SHOP.selectTime(10)">
                    <h4>10 ${this.t('payment_year', '年')}</h4>
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
        document.querySelectorAll('.vx-purchase-option').forEach(opt => {
            const h4 = opt.querySelector('h4');
            if (h4 && (h4.textContent.includes('年') || h4.textContent.includes('year'))) {
                opt.classList.remove('selected');
                if (h4.textContent.startsWith(time.toString())) {
                    opt.classList.add('selected');
                }
            }
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
        modalTitle.innerHTML = '<iconpark-icon name="gift"></iconpark-icon> 兑换礼品卡';
        
        const modalBody = document.getElementById('vx-modal-body');
        modalBody.innerHTML = `
            <p class="vx-modal-desc">输入您的礼品卡兑换码</p>
            
            <div class="vx-form-group">
                <input type="text" class="vx-input" id="vx-giftcard-code" 
                    placeholder="请输入兑换码" style="text-transform: uppercase;">
            </div>
        `;
        
        // Update modal footer for gift card
        const modalFooter = document.querySelector('#vx-shop-modal .vx-modal-footer');
        const originalFooter = modalFooter.innerHTML;
        
        modalFooter.innerHTML = `
            <div></div>
            <div class="vx-modal-actions">
                <button class="vx-btn vx-btn-secondary" onclick="VX_SHOP.closeModal(); VX_SHOP.restoreModalFooter()">取消</button>
                <button class="vx-btn vx-btn-primary" onclick="VX_SHOP.submitGiftCard()">兑换</button>
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
        VXUI.toastInfo('已刷新');
    }
};

// Register module
VXUI.registerModule('shop', {
    template: '/tpl/vxui/shop.html',
    init: () => VX_SHOP.init()
});
