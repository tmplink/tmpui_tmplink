/**
 * VXUI Shop Module
 * 商店模块 - 购买赞助、存储空间、直链配额
 */

const VX_SHOP = {
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
            prices: {
                '1': 72,   // 1 year
                '10': 720  // 10 years
            }
        },
        storage: {
            type: 'addon',
            items: {
                '256GB': { code: '256GB', name: '256GB', prices: { '1': 72, '10': 720 } },
                '1TB': { code: '1TB', name: '1TB', prices: { '1': 144, '10': 1440 } },
                '3TB': { code: '3TB', name: '3TB', prices: { '1': 288, '10': 2880 } },
                '5TB': { code: '5TB', name: '5TB', prices: { '1': 432, '10': 4320 } }
            }
        },
        direct: {
            type: 'direct',
            code: 'D20',
            name: '直链配额',
            pricePerUnit: 6 // CNY per unit
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
        const sidebarTpl = document.getElementById('vx-shop-sidebar-tpl');
        const sidebarContent = document.querySelector('.vx-sidebar-content');
        
        if (sidebarTpl && sidebarContent) {
            sidebarContent.innerHTML = sidebarTpl.innerHTML;
            
            // Update active state
            document.querySelectorAll('.vx-nav-item[data-module]').forEach(item => {
                item.classList.remove('active');
            });
            
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
        
        // Update sidebar nav
        document.querySelectorAll('.vx-nav-item').forEach(item => {
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
        try {
            const result = await this.apiRequest('checkFirstTimeSponsor');
            if (result.status === 'ok' && result.data) {
                document.getElementById('vx-shop-special').style.display = 'block';
                
                // Update price based on currency
                const priceEl = document.getElementById('vx-first-sponsor-price');
                const isCN = typeof TL !== 'undefined' && TL.lang === 'cn';
                if (isCN) {
                    priceEl.textContent = '36';
                    priceEl.nextElementSibling.textContent = '元';
                } else {
                    priceEl.textContent = '6';
                    priceEl.nextElementSibling.textContent = 'USD';
                }
            }
        } catch (e) {
            console.warn('[VX_SHOP] First time sponsor check failed:', e);
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
            // Get user info from TL
            const user = (typeof TL !== 'undefined' && TL.user) ? TL.user : {};
            
            // Update avatar
            document.getElementById('vx-user-avatar').src = user.avatar || '/img/avatar/default.png';
            document.getElementById('vx-user-name').textContent = user.uname || '--';
            
            // Get rank text
            const rankTexts = {
                'admin': '管理员',
                'vip': '赞助者',
                'user': '普通用户'
            };
            document.getElementById('vx-user-rank').textContent = rankTexts[user.rank] || '普通用户';
            
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
            
            // Highspeed
            document.getElementById('vx-user-highspeed').textContent = 
                user.group?.highspeed ? formatExpiry(user.group.highspeed) : '未开通';
            
            // Blue verification
            document.getElementById('vx-user-blue').textContent = 
                user.group?.blue ? formatExpiry(user.group.blue) : '未开通';
            
            // DVD/Media
            document.getElementById('vx-user-dvd').textContent = 
                user.group?.dvd ? formatExpiry(user.group.dvd) : '未开通';
            
            // Sponsor status
            document.getElementById('vx-user-sponsor').textContent = 
                user.group?.sponsor ? formatExpiry(user.group.sponsor) : '未开通';
            
            // Storage
            const storageText = user.storage ? 
                `${this.formatBytes(user.storage.used)} / ${this.formatBytes(user.storage.total)}` : '--';
            document.getElementById('vx-user-storage').textContent = storageText;
            
            // Direct quota
            document.getElementById('vx-user-quota').textContent = 
                user.direct?.quota !== undefined ? `${user.direct.quota} GB` : '--';
            
            // Account value (ACV)
            document.getElementById('vx-user-acv').textContent = 
                user.acv !== undefined ? `¥${user.acv}` : '--';
            
            // Join date
            document.getElementById('vx-user-join').textContent = 
                user.join ? formatDate(user.join) : '--';
                
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
        modalTitle.innerHTML = '<iconpark-icon name="heart-circle-plus"></iconpark-icon> ' + 
            this.t('model_title_sponsor', '成为赞助者');
        
        const modalBody = document.getElementById('vx-modal-body');
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
        modalTitle.innerHTML = '<iconpark-icon name="album-circle-plus"></iconpark-icon> ' + 
            this.t('model_title_buy_storage', '私有空间');
        
        const modalBody = document.getElementById('vx-modal-body');
        modalBody.innerHTML = `
            <p class="vx-modal-desc">${this.t('storage_content', '扩展您的私有存储空间')}</p>
            
            <h4 class="vx-section-title">${this.t('payment_capacity', '选择容量')}</h4>
            <div class="vx-purchase-options">
                <div class="vx-purchase-option selected" onclick="VX_SHOP.selectCode('256GB')">
                    <h4>256GB</h4>
                    <div class="vx-option-price">¥72/年</div>
                </div>
                <div class="vx-purchase-option" onclick="VX_SHOP.selectCode('1TB')">
                    <h4>1TB</h4>
                    <div class="vx-option-price">¥144/年</div>
                </div>
                <div class="vx-purchase-option" onclick="VX_SHOP.selectCode('3TB')">
                    <h4>3TB</h4>
                    <div class="vx-option-price">¥288/年</div>
                </div>
                <div class="vx-purchase-option" onclick="VX_SHOP.selectCode('5TB')">
                    <h4>5TB</h4>
                    <div class="vx-option-price">¥432/年</div>
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
        modalTitle.innerHTML = '<iconpark-icon name="share-nodes"></iconpark-icon> ' + 
            this.t('model_title_buy_direct_quota', '优先配额（直链）');
        
        const modalBody = document.getElementById('vx-modal-body');
        modalBody.innerHTML = `
            <p class="vx-modal-desc">${this.t('direct_quota_content', '获得更多直链配额')}</p>
            
            <div class="vx-quantity-input">
                <label>${this.t('payment_quantity', '数量')}:</label>
                <input type="number" value="1" min="1" max="100" onchange="VX_SHOP.setQuantity(this.value)">
                <span>× 20GB</span>
            </div>
            
            <p style="color: var(--vx-text-secondary); font-size: 13px;">
                ${this.t('direct_quota_tip', '每份配额包含 20GB 直链流量')}
            </p>
            
            ${this.renderPaymentMethods()}
        `;
        
        this.updateModalPrice();
        this.showModal();
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
        
        // Update UI
        const timeText = time + ' ' + (TL.tpl.payment_year || '年');
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
            priceCNY = this.products.direct.pricePerUnit * this.quantity;
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
        document.getElementById('vx-shop-modal').classList.add('show');
        document.body.style.overflow = 'hidden';
    },
    
    /**
     * Close modal
     */
    closeModal() {
        document.getElementById('vx-shop-modal').classList.remove('show');
        document.body.style.overflow = '';
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
            priceCNY = this.products.direct.pricePerUnit * this.quantity;
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
            const result = await this.apiRequest('giftcard', { code });
            
            if (result.status === 'ok') {
                VXUI.toastSuccess(this.t('giftcard_success', '兑换成功！'));
                this.closeModal();
                this.restoreModalFooter();
                this.loadUserStatus();
            } else {
                VXUI.toastError(result.message || this.t('giftcard_error', '兑换失败'));
            }
        } catch (e) {
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
