class buy {
    parent_op = null;

    selected_times = 1
    selected_payment = 'point'
    selected_type = 'addon'
    selected_code = 'HS'
    selected_price = 0
    selected_dom_code = null
    selected_dom_time = null
    selected_dom_payment = null
    payment_price = 0

    init(op) {
        this.parent_op = op;
    }

    setAvaliablePayment() {
        this.selectPayment('point');
        $('.buy_payment_cny, .buy_payment_usd').hide();
    }

    openQuato() {
        this.selected_times = 1;
        this.selected_type = 'direct';
        this.setAvaliablePayment();
        this.selectNums();
        this.selectCode('#buy_direct_quota_1', 'D20', 6);
        $('#shopModal').modal('hide');
        setTimeout(() => {
            $('#directQuotaModal').modal('show');
        }, 100);
    }

    openStorage() {
        this.selectTime('a');
        this.setAvaliablePayment();
        this.selected_type = 'addon';
        this.selectCode('#buy_storage_256', '256GB', 6);
        $('#shopModal').modal('hide');
        $('#uploadModal').modal('hide');
        $('#myModal').modal('hide');
        setTimeout(() => {
            $('#storageModal').modal('show');
        }, 100);
    }

    openSponsor() {
        this.selected_type = 'addon';
        this.selected_price = 6;
        this.selectTime('a');
        this.setAvaliablePayment();
        this.selected_code = 'HS';
        $('#shopModal').modal('hide');
        $('#myModal').modal('hide');
        setTimeout(() => {
            $('#sponsorModal').modal('show');
        }, 100);
    }

    /**
     * 当shopModal隐藏时，也要确保红色提示点保持正确状态
     */
    onShopModalHide() {
        // Modal隐藏时不需要特别处理，保持当前状态即可
    }

    openBlackFriday() {
        this.selected_type = 'addon';
        this.selected_price = 36;
        this.selectTime('a');
        this.setAvaliablePayment();
        this.selected_code = 'BF';
        $('#blackfridayModal').modal('show');
    }

    selectCode(dom, code, price) {
        this.selected_code = code;
        this.selected_price = price;
        if (this.selected_dom_code !== null) {
            document.querySelector(this.selected_dom_code).classList.remove('card-selected');
        }
        this.selected_dom_code = dom;
        document.querySelector(this.selected_dom_code).classList.add('card-selected');
        this.computePrice();
    }

    selectTime(time) {
        this.selected_times = time == 'a' ? 1 : 10;
        if (time === 'a') {
            document.querySelectorAll('.pay_times_a').forEach((item) => {
                item.classList.add('card-selected');
            });
            document.querySelectorAll('.pay_times_b').forEach((item) => {
                item.classList.remove('card-selected');
            });
        } else {
            document.querySelectorAll('.pay_times_a').forEach((item) => {
                item.classList.remove('card-selected');
            });
            document.querySelectorAll('.pay_times_b').forEach((item) => {
                item.classList.add('card-selected');
            });
        }
        this.computePrice();
    }

    selectNums() {
        let nums = document.querySelector('#buy_direct_quota_nums').value;
        nums = parseInt(nums);
        if (nums > 0) {
            this.selected_times = nums;
            this.computePrice();
        } else {
            this.selected_times = 1;
            this.computePrice();
        }
    }

    selectPayment(payment) {
        this.selected_payment = 'point';
        const cnyCards = document.querySelectorAll('.buy_payment_cny > .card');
        const usdCards = document.querySelectorAll('.buy_payment_usd > .card'); // 假设 USD 也应该选择 .card
        cnyCards.forEach(card => card.classList.remove('card-selected'));
        usdCards.forEach(card => card.classList.remove('card-selected'));
        this.computePrice();
    }

    computePrice() {
        let price = this.selected_price * this.selected_times * 100;
        this.payment_price = price;
        $('.payment_units').html('');
        $('.payment_total').html(price);
        $('.payment_total').next('.payment-point-unit').remove();
        $('.payment_total').after(`<span class="payment-point-unit"> ${app.languageData.vx_points || '点数'}</span>`);
    }

    makeOrder() {
        this.buyWithPoints(this.selected_type, this.selected_code, this.selected_times);
    }

    buyWithPoints(type, code, times) {
        const productType = type === 'direct' ? 'DIRECT' : 'ADDON';
        $.post(this.parent_op.api_pay, {
            action: 'point_buy',
            token: this.parent_op.api_token,
            product_type: productType,
            product_id: code,
            product_times: times
        }, (rsp) => {
            if (rsp.status === 1) {
                alert(app.languageData.vx_purchase_success || '购买成功！');
                window.location.reload();
                return;
            }
            if (rsp.status === 1001) {
                alert(app.languageData.vx_point_recharge_first || '请先充值点数后再购买');
                window.location.href = '/?tmpui_page=/vx&module=points';
                return;
            }
            if (rsp.status === 1002) {
                alert(app.languageData.vx_product_already_bought || '该商品不能重复购买');
                return;
            }
            alert((rsp.data && rsp.data.message) || rsp.debug || app.languageData.vx_purchase_failed || '购买失败');
        }, 'json');
    }

}