class oauth {
    parent_op = null

    init(parent_op) {
        this.parent_op = parent_op;
    }

    init_details() {
        if (this.parent_op.isLogin === false) {
            return;
        }
        //初始化google登录状态
        this.google_connect_status();
    }

    google_login_click() {
        //禁用按钮
        $('#google_login').addClass('disabled');
        this.google_login_callback();
    }

    google_login_btn_reset(){
        $('#google_login').addClass('disabled');
        $('#google_login').removeAttr('onclick');
        $('#google_login').removeAttr('href');
        $('#google_login').removeAttr('target');
    }

    google_login() {
        //禁用按钮
        this.google_login_btn_reset();
        //发送请求获取google登录的url
        $.post(this.parent_op.api_user, {
            'action': 'oauth_google_login',
            'type': 'login', //登录google
            'lang': this.parent_op.currentLanguage, //语言
            'token': this.parent_op.api_token,
        }, (rsp) => {
            if (rsp.status == 1) {
                $('#google_login').attr('href', rsp.data);
                $('#google_login').attr('target', '_blank');
                $('#google_login').attr('onclick', 'TL.oauth.google_login_click()');
                $('#google_login').removeClass('disabled');
            }
        }, 'json');
    }

    google_login_callback() {
        //显示正在登录
        $('#google_login_msg').html(app.languageData.oauth_btn_processing);
        //发送请求获取google登录的状态
        $.post(this.parent_op.api_user, {
            'action': 'oauth_google_status',
            'token': this.parent_op.api_token,
        }, (rsp) => {
            //登录成功
            if (rsp.data == 'GOOGLE_LOGIN_SUCCESS' || rsp.data == 'GOOGLE_LOGIN_FAIL1') {
                //如果请求成功，进入主页
                $('#google_login_msg').html(app.languageData.oauth_btn_complete);
                //转化
                // gtag('event', 'conversion', {
                //     'send_to': 'AW-977119233/7Pa-CNH4qbkBEIHQ9tED',
                // });
                setTimeout(() => {
                    dynamicView.room();
                }, 1000);
                return false;
            }

            //登录失败
            if (rsp.data == 'GOOGLE_LOGIN_FAIL2' || rsp.data == 'GOOGLE_LOGIN_FAIL3' || rsp.data == 'GOOGLE_LOGIN_FAIL4') {
                $('#google_login_msg').html(app.languageData.status_error_0);
                //启用按钮
                setTimeout(() => {
                    $('#google_login_msg').html(app.languageData.oauth_google_btn_login);
                    $('#google_login').attr('disabled', false);
                }, 1000);
                return false;
            }

            //登录中，重新监听
            if (rsp.data == 'GOOGLE_LOGIN_START') {
                //显示正在登录
                $('#google_login_msg').html(app.languageData.oauth_btn_processing);
                setTimeout(() => {
                    this.google_login_callback();
                }, 1000);
                return false;
            }

            //如果没有返回信息，继续监听
            setTimeout(() => {
                this.google_login_callback();
            }, 1000);
        }, 'json');
    }

    google_connect_status() {
        $('#google_disconnect').hide();
        //发送请求获取google登录的状态
        $.post(this.parent_op.api_user, {
            'action': 'oauth_google_is_connected',
            'token': this.parent_op.api_token,
        }, (rsp) => {
            //成功
            if (rsp.status == 1) {
                //绑定完成，设定界面状态
                $('#google_connect_msg').html(app.languageData.oauth_btn_google_connected);
                //禁用按钮
                this.google_connect_btn_reset();
                $('#google_disconnect').attr('disabled', false);
                //显示解除绑定的连接
                $('#google_disconnect').show();
            } else {
                //失败，设定界面状态
                $('#google_connect_msg').html(app.languageData.oauth_btn_google_connect);
                $('#google_disconnect').attr('disabled', true);
                this.google_connect();
            }
        }, 'json');
    }

    google_connect_click() {
        //禁用按钮
        $('#google_connect').addClass('disabled');
        this.google_connect_callback();
    }

    google_connect_btn_reset(){
        $('#google_connect').addClass('disabled');
        $('#google_connect').removeAttr('onclick');
        $('#google_connect').removeAttr('href');
        $('#google_connect').removeAttr('target');
    }

    google_connect() {
        this.google_connect_btn_reset();
        //发送请求获取google登录的url
        $.post(this.parent_op.api_user, {
            'action': 'oauth_google_login',
            'type': 'connect', //连接google
            'token': this.parent_op.api_token,
            'lang': this.parent_op.currentLanguage, //语言
        }, (rsp) => {
            if (rsp.status == 1) {
                //如果请求成功，通过另外的小窗口打开google登录的url，然后启动监听进程
                $('#google_connect').attr('onclick', 'TL.oauth.google_connect_click()');
                $('#google_connect').attr('href', rsp.data);
                $('#google_connect').attr('target', '_blank');
                $('#google_connect').removeClass('disabled');
            }
        }, 'json');
    }

    google_connect_callback() {
        //显示正在进行
        $('#google_connect_msg').html(app.languageData.form_btn_processing);
        //发送请求获取google登录的状态
        $.post(this.parent_op.api_user, {
            'action': 'oauth_google_status',
            'token': this.parent_op.api_token,
        }, (rsp) => {
            //成功
            if (rsp.data == 'GOOGLE_BIND_SUCCESS') {
                //绑定完成
                $('#google_connect_msg').html(app.languageData.oauth_btn_complete);
                setTimeout(() => {
                    this.google_connect_status();
                }, 2000);
            }

            //失败
            if (rsp.data == 'GOOGLE_BIND_FAILED') {
                $('#google_connect_msg').html(app.languageData.status_error_0);
                //启用按钮
                setTimeout(() => {
                    $('#google_connect_msg').html(app.languageData.oauth_btn_google_connect);
                    $('#google_connect').removeClass('disabled');
                }, 3000);
            }

            //进行中，重新监听
            if (rsp.data == 'GOOGLE_BIND_START') {
                //显示正在进行
                $('#google_connect_msg').html(app.languageData.oauth_btn_processing);
                setTimeout(() => {
                    this.google_connect_callback();
                }, 2000);
            }
        }, 'json');
    }

    google_disconnect() {
        //禁用按钮
        $('#google_disconnect').attr('disabled', true);
        //发送请求获取google登录的url
        $.post(this.parent_op.api_user, {
            'action': 'oauth_google_disconnect',
            'token': this.parent_op.api_token,
        }, (rsp) => {
            this.google_connect_status();
        }, 'json');
    }
}
