class profile {

    parent_op = null
    nickname = ''
    intro = ''
    avatar_id = ''
    avatar_url = '/img/ico/logo-256x256.png'
    publish = 'no'
    publish_status = false
    init_status = false

    init(parent_op) {
        this.parent_op = parent_op;
    }

    openModal(){
        if(this.init_status===false){
            this.init_details();
        }
        $('#userModal').modal('show');
    }

    init_details(cb) {
        //获取当前
        let url = get_url_params('tmpui_page');
        let page = url.tmpui_page;
        let listview = url.listview;
        if (page !== '/app'&&(listview!=='login'||listview!=='reg')) {
            return false;
        }

        $.post(this.parent_op.api_user, {
            'action': 'pf_userinfo_get',
            'token': this.parent_op.api_token
        }, (rsp) => {
            if (rsp.status == 1) {
                this.publish = rsp.data.publish;
                this.publish_status = rsp.data.publish_status;
                this.nickname = rsp.data.nickname;
                this.intro = rsp.data.intro;
                this.avatar_id = rsp.data.avatar_id;
            }
            this.init_status = true;

            //如果是赞助者，激活特定按钮的颜色
            if(typeof cb === 'function'){
                cb();
            }

            this.refresh();
        }, 'json');
    }

    generateAvatar(){
        //根据用户邮箱，生成一个指定数字范围内的ID，然后根据ID，从头像库中抽取一个头像
        let str = this.parent_op.uid;
        let seed = 0;
        let max = 16;
        for (let i = 0; i < str.length; i++) {
          seed += str.charCodeAt(i);
        }
        let avatar_id = (seed % max) + 1;

        //格式化为两位数整数
        if(avatar_id<10){
            avatar_id = avatar_id;
        }
        this.avatar_url = '/img/avatar/2-'+avatar_id+'.svg';
    }
      

    refresh() {
        
        if(this.nickname==='0'){
            $('.user_saved_nickname').html(app.languageData.user_saved_title);
            $('.no_profile').show();
        }else{
            $('.user_saved_nickname').html(this.nickname);
        }
        if(this.intro==='0'){
            $('.user_saved_intro').html(app.languageData.user_saved_content);
        }else{
            $('.user_saved_intro').html(this.intro);
        }

        //如果是已发布的状态，并且用户是赞助者或者分享值大于150，则显示已认证的图标
        if(this.publish_status==='ok' && (this.parent_op.sponsor||this.parent_op.share>150)){
            $('.show_for_verified').show();
        }

        let avatarUrl = '';
        if(this.avatar_id){
            avatarUrl = `https://tmp-static.vx-cdn.com/static/avatar?id=${this.avatar_id}`;
        }else{
            this.generateAvatar();
            avatarUrl = this.avatar_url;
        }
        //load avatar
        let avatar = new Image();
        avatar.src = avatarUrl;
        avatar.onload = () => {
            $('.user_saved_logo > img').attr('src', avatarUrl);
        }

        if (this.publish == 'yes') {
            $("#userinfo_set_publish").attr('checked', 'checked');
            $('.userinfo_set_publish_submit').show();
            
            // Show different notices based on sponsor status during initialization
            if(this.parent_op.sponsor) {
                $('.user_review_notice_regular').hide();
                $('.user_review_notice_vip').show();
            } else {
                $('.user_review_notice_regular').show();
                $('.user_review_notice_vip').hide();
            }
        } else {
            $("#userinfo_set_publish").removeAttr('checked');
            $('.userinfo_set_publish_submit').hide();
        }
        this.userinfoStatus(this.publish_status);

        //更新 myModal 中的内容
        //设定徽章
        if(this.parent_op.user_group.level===undefined){
            this.parent_op.user_group.level = 1;
        }
        // let badge = '/img/level/'+this.parent_op.user_group.level+'.svg';
        // $('.user_badge').attr('src',badge);
        // $('.user_level_icon').attr('src',badge);
        
        //设定其它信息
        if(this.parent_op.user_group.storage === undefined){
            this.parent_op.user_group.storage = 0;
        }
        $('.user_group_storage').html(this.parent_op.user_group.storage+' GB');

        if(this.parent_op.user_group_blue){
            $('.user_group_blue').html(app.languageData.opt_enable);
            $('.user_group_blue').addClass('text-green');
        }else{
            $('.user_group_blue').html(app.languageData.opt_disable);
            $('.user_group_blue').addClass('text-red');
        }
        if(this.parent_op.sponsor){
            $('.user_group_dvd').html(app.languageData.opt_enable);
            $('.user_group_dvd').addClass('text-green');
        }else{
            $('.user_group_dvd').html(app.languageData.opt_disable);
            $('.user_group_dvd').addClass('text-red');
        }

        //如果是赞助者，需要标记已启用蓝标
        if(this.parent_op.sponsor){
            $('.user_group_blue').html(app.languageData.opt_enable);
            $('.user_group_blue').addClass('text-green');
        }
    }

    openGroup(){
        $('#myModal').modal('hide');
        setTimeout(() => {
            $('#userGroupsModal').modal('show');
        }
        , 100);
    }

    avatarSet(logo) {
        $('.user_logo_postmsg').html(app.languageData.direct_user_logo_set_process);
        $('#user_set_upload_status').html('<iconpark-icon name="spinner" class="fa-fw fa-spin text-green"></iconpark-icon>');
        let xhr = new XMLHttpRequest();
        let formData = new FormData();
        formData.append('action', 'pf_avatar_set');
        formData.append('token', this.parent_op.api_token);
        formData.append('file', logo.files[0]);
        xhr.open('POST', this.parent_op.api_user, true);
        xhr.onload = (e) => {
            if (xhr.status == 200) {
                let rsp = JSON.parse(xhr.responseText);
                if (rsp.status == 1) {
                    $('.user_logo_postmsg').html(app.languageData.direct_user_logo_set_complete);
                }
                if (rsp.status == 0) {
                    $('.user_logo_postmsg').html(app.languageData.direct_user_logo_set_invalid);
                }
                if (rsp.status == 2) {
                    $('.user_logo_postmsg').html(app.languageData.direct_user_logo_set_size);
                }
            } else {
                $('.user_logo_postmsg').html(app.languageData.status_error_0);
            }
            $('#user_set_upload_status').html('<iconpark-icon name="check" class="fa-fw text-green"></iconpark-icon>');
            this.init_details();
        }
        xhr.send(formData);
    }

    userinfoSet() {
        let userTitle = $('#userinfo_name_input').val();
        let userIntro = $('#userinfo_intro_input').val();
        if (userTitle == '' || userIntro == '') {
            alert(app.languageData.direct_brand_name_empty);
            return false;
        }
        $.post(this.parent_op.api_user, {
            'action': 'pf_userinfo_set',
            'token': this.parent_op.api_token,
            'nickname': userTitle,
            'intro': userIntro
        }, (rsp) => {
            if (rsp.status == 1) {
                $('.user_setting_status').html('<iconpark-icon name="check" class="fa-fw text-green"></iconpark-icon>');
                // this.init_details();
            } else {
                $('.user_setting_status').html('<iconpark-icon name="times" class="fa-fw text-red"></iconpark-icon>');
            }
            this.init_details();
        }, 'json');
    }

    userinfoReview() {
        $.post(this.parent_op.api_user, {
            'action': 'pf_userinfo_review',
            'token': this.parent_op.api_token
        }, (rsp) => {
            if (rsp.status == 1) {
                alert(app.languageData.user_review_status_1);
            }
            if (rsp.status == 2) {
                alert(app.languageData.user_review_status_2);
            }
            if (rsp.status == 0) {
                alert(app.languageData.user_review_status_0);
            }
            this.init_details();
        }, 'json');
    }

    setPublish() {
        let publish = ($('#userinfo_set_publish').is(':checked')) ? 'yes' : 'no';

        if(publish=='yes'){
            $('.userinfo_set_publish_submit').show();
            
            // Show different notices based on sponsor status
            if(this.parent_op.sponsor) {
                $('.user_review_notice_regular').hide();
                $('.user_review_notice_vip').show();
            } else {
                $('.user_review_notice_regular').show();
                $('.user_review_notice_vip').hide();
            }
        }else{
            $('.userinfo_set_publish_submit').hide();
        }

        $.post(this.parent_op.api_user, {
            'action': 'pf_userinfo_publish_set',
            'token': this.parent_op.api_token,
            'status': publish
        });

    }

    userinfoStatus(status) {
        switch (status) {
            case 'ok':
                $('#user_status').html('<iconpark-icon name="circle-check" class="fa-fw text-green mr-1"></iconpark-icon>'+app.languageData.brand_status_ok);
                break;
            case 'reject':
                $('#user_status').html('<iconpark-icon name="times" class="fa-fw text-red mr-1"></iconpark-icon>'+app.languageData.brand_status_reject);
                break;
            case 'wait':
                $('#user_status').html('<iconpark-icon name="timer" class="fa-fw text-blue mr-1"></iconpark-icon>'+app.languageData.brand_status_wait);
                break;
            case 'review':
                $('#user_status').html('<iconpark-icon name="loader" class="fa-fw text-blue mr-1"></iconpark-icon>'+app.languageData.brand_status_review);
                break;
        }
    }
}
