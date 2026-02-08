class dir {
    parent_op = null
    room = {}
    subroom_data = {}
    file_list = []

    init(parent_op) {
        this.parent_op = parent_op;
    }


    viewByList(data, page) {
        let url_params = get_url_params();
        const subRooms = Array.isArray(this.subroom_data) ? this.subroom_data : [];
        const listData = Array.isArray(data) ? data : [];
        this.btnActiveReset();
        $('#room_btn_file_list').addClass('text-blue');
        if (page == 0 || page == 'all') {
            $('#dir_list').html('');
            if (subRooms.length !== 0) {
                $('#dir_list').append(app.tpl('dir_list_tpl', subRooms));
            }
            if (listData.length === 0 && subRooms.length === 0 && String(url_params.mrid) !== '0') {
                $('.no_files').show();
            }
            if (listData.length === 0 && subRooms.length === 0 && String(url_params.mrid) === '0') {
                $('.no_dir').show();
            }
        }
        if (listData.length !== 0) {
            $('#dir_list').append(app.tpl('dir_filelist_tpl', listData));
        }
        $('.lefttime-remainder').each((i, e) => {
            let id = $(e).attr('id');
            let time = $(e).attr('data-tmplink-lefttime');
            countDown(id, time,this.parent_op.currentLanguage);
        });
        this.parent_op.btn_copy_bind();
        app.linkRebind();
    }

    viewByPhoto(data, page) {
        const subRooms = Array.isArray(this.subroom_data) ? this.subroom_data : [];
        const listData = Array.isArray(data) ? data : [];
        this.btnActiveReset();
        $('#room_btn_file_photo').addClass('text-blue');
        if (page == 0 || page == 'all') {
            $('#dir_list').html('');
            if (subRooms.length !== 0) {
                $('#dir_list').append(app.tpl('dir_list_tpl', subRooms));
            }
            if (listData.length === 0 && subRooms.length === 0) {
                $('.no_photos').show();
            }
        }
        if (listData.length !== 0) {
            $('#dir_list').append(app.tpl('dir_photolist_tpl', listData));
        }
        this.parent_op.btn_copy_bind();
        app.linkRebind();
        this.parent_op.lazyload('.lazyload');
    }

    deleteFile(ukey) {
        // Room is the new entry for the old workspace view.
        // Use workspace deletion flow to avoid calling meetingroom file_del.
        return this.parent_op.workspace_del(ukey, false);
    }

    showCreateFolderModal() {
        // 确保模态框中的字段使用当前目录信息
        const mr_id = this.room.mr_id === undefined ? 0 : this.room.mr_id;
        const parent = this.room.parent === undefined ? 0 : this.room.parent;
        const top = this.room.top === undefined ? 0 : this.room.top;
        
        // 处理特殊情况 - 当 top=99 时，它表示桌面文件夹
        let parent_id = parent;
        if (top == 99) {
            // 确保桌面文件夹有正确的父ID
            parent_id = 0; // 桌面顶级文件夹应使用0作为父级
        }
        
        $('#mr_id').val(mr_id);
        $('#mr_parent_id').val(parent_id);
        $('#mr_top_id').val(top);
        $('#mrCreaterModal').modal('show');
        console.log(`Setting values - mr_id: ${mr_id}, parent: ${parent_id} (original parent: ${parent}), top: ${top}`);
    }

    create() {
        var name = $('#modal_meetingroom_create_name').val();
        var model = $('#modal_meetingroom_create_type').val();
        var mr_id = $('#mr_id').val();
        var parent = $('#mr_parent_id').val();
        var top = $('#mr_top_id').val();
        
        if (model == '' && name == '') {
            $('#notice_meetingroom_create').html(app.languageData.notice_meetingroom_status_mrcreat_fail);
            return false;
        }
        
        // 在 top=99 (桌面) 的情况下确保 parent=0
        if (top == 99) {
            parent = 0;
        }
        
        // 子文件夹的 model 应该是 0
        if (parent > 0) {
            model = 0;
        }
        
        $('#modal_meetingroom_create_btn').attr('disabled', true);
        $('#notice_meetingroom_create').html(app.languageData.notice_meetingroom_status_proccessing);
        console.log(`Creating folder - name: ${name}, mr_id: ${mr_id}, parent: ${parent}, top: ${top}, model: ${model}`);
        
        this.parent_op.recaptcha_do('mr_add', (recaptcha) => {
            $.post(this.parent_op.api_mr, {
                action: 'create',
                token: this.parent_op.api_token,
                //captcha: recaptcha,
                name: name,
                mr_id: mr_id,
                parent: parent,
                top: top,
                model: model
            }, (rsp) => {
                if (rsp.status == 1) {
                    $('#notice_meetingroom_create').html(app.languageData.notice_meetingroom_status_mrcreated);
                    this.open();
                    $('#mrCreaterModal').modal('hide');
                    //更新文件夹树形图
                    this.treeGet();
                } else {
                    $('#notice_meetingroom_create').html(app.languageData.notice_meetingroom_status_mrcreat_fail);
                }
                setTimeout(() => {
                    $('#modal_meetingroom_create_btn').removeAttr('disabled');
                }, 2000);
            });
        });
    }

    delete(mrid, group_delete = false) {
        if (this.parent_op.profile_confirm_delete_get() && group_delete === false) {
            if (!confirm(app.languageData.confirm_delete)) {
                return false;
            }
        }

        //if mrid is array, then delete all
        if (group_delete) {
            for (let i in mrid) {
                $('#meetingroom_id_' + mrid[i]).fadeOut();
            }
        } else {
            $('#meetingroom_id_' + mrid).fadeOut();
        }

        $.post(this.parent_op.api_mr, {
            action: 'delete',
            token: this.parent_op.api_token,
            mr_id: mrid
        }, () => {
            this.open();
        });
    }

    reName(mrid) {
        var newname = prompt(app.languageData.modal_meetingroom_newname, "");
        if (newname === null) {
            return false;
        }
        $.post(this.parent_op.api_mr, {
            action: 'rename',
            token: this.parent_op.api_token,
            name: newname,
            mr_id: mrid
        }, (rsp) => {
            this.open();
        });
    }

    setViewModel(type) {
        // View model switching has been removed
        // Always use list view
        debug('dir.setViewModel() is deprecated and no longer supported');
        return;
    }

    setModel(type) {
        if (type === 'photo' || type === 'list') {
            debug('dir.setModel() legacy view call detected, please use dir.setViewModel()', type);
            this.setViewModel(type);
            return;
        }

        if (type === 'private' || type === 'public') {
            const model = type === 'private' ? 'private' : 'public';

            $.post(this.parent_op.api_mr, {
                action: 'set_model',
                token: this.parent_op.api_token,
                mr_id: this.room.mr_id,
                model: model
            }, () => {
                if (model === 'private') {
                    $('.room_protection_unlock').hide();
                    $('.room_protection_lock').show();
                } else {
                    $('.room_protection_unlock').show();
                    $('.room_protection_lock').hide();
                }
            });
            return;
        }

        debug('dir.setModel() received unsupported type', type);
    }

    listModel(data, page, room_id) {
        let room_key = 'app_room_view_' + room_id;
        switch (localStorage.getItem(room_key)) {
            case 'photo':
                this.viewByPhoto(data, page);
                break;
            case 'list':
                this.viewByList(data, page);
                break;
            default:
                this.viewByList(data, page);
        }
        this.parent_op.is_file_ok_check(data);
    }

    report() {
        var mr_id = this.room.mr_id;
        var reason = $('#room_report_model').val();
        $('#room_reportbtn').attr('disabled', true);
        $('#room_reportbtn').html(`<span class="text-red">${app.languageData.form_btn_processed}</span>`);
        $.post(this.api_mr, {
            'action': 'report',
            'token': this.api_token,
            'reason': reason,
            'mr_id': mr_id
        }, (rsp) => {
            $('#room_reportbtn').html(app.languageData.form_btn_processed);
        }, 'json');
    }

    total(mrid) {
        $('.room_subinfo').hide();
        $('#room_total').html('');
        if (mrid == 0) {
            return false;
        }
        $.post(this.parent_op.api_mr, {
            action: 'total', mr_id: mrid, token: this.parent_op.api_token
        }, (rsp) => {
            if (rsp.data.nums > 0) {
                $('.room_subinfo').show();
                let total_size_text = bytetoconver(rsp.data.size, true);
                $('#room_total').html(`${rsp.data.nums} ${app.languageData.total_units_of_file} , ${total_size_text}`);
                this.mobileTopabrFix(mr_id);
            }
        }, 'json');
    }

    open() {
        // 显示加载图标
        this.parent_op.loading_box_on();
        
        var params = get_url_params();
        const currentPath = location.pathname + location.search;

        $('#room_userlist').hide();
        $('.permission-room-file').hide();
        $('.permission-room-user').hide();
        $('.data_loading').show();
        //初始化选择器
        this.parent_op.Selecter.pageInit();
        //清理数据
        $('#dir_list').html('');
        $('#room_direct_model').hide();
        $('.room_subinfo').hide();
        $('.fav-enabled').hide();
        //this.loadingON();
        //获取基本信息
        $.post(this.parent_op.api_mr, {
            action: 'details',
            //captcha: recaptcha,
            token: this.parent_op.api_token,
            mr_id: params.mrid
        }, (rsp) => {
            this.room_data = rsp.data;
            $('.data_loading').hide();
            this.loadingOFF();
            if (rsp.status === 0) {
                //会议室不存在了
                this.room.parent = 0;
                this.room.top = 0;
                this.room.ownner = 0;
                this.room.mr_id = 0;
                app.open('/404');
                this.parent_op.ga('Dir-Unavailable', currentPath);
                return false;
            }
            //会议室不可用
            if (rsp.data.status == 'reported' && rsp.data.owner == 0) {
                this.room.parent = 0;
                this.room.top = 0;
                this.room.ownner = 0;
                this.room.mr_id = 0;
                app.open('/404');
                this.parent_op.ga('Dir-Reported', currentPath);
                return false;
            }

            //room need to login
            if (rsp.status === 3) {
                //设定登录后跳转的页面
                localStorage.setItem('return_page', getCurrentURL());
                app.open('/login');
                return false;
            }
            this.parent_op.ga('Dir-' + rsp.data.name, currentPath);
            //更新统计信息
            this.total(rsp.data.mr_id);
            this.room.parent = rsp.data.parent;
            this.room.top = rsp.data.top;
            this.room.owner = rsp.data.owner;
            // 如果URL参数mrid是0，则强制设置mr_id为0（根目录）
            this.room.mr_id = (params.mrid == 0) ? 0 : rsp.data.mr_id;
            this.room.display = rsp.data.display;
            this.room.sort_by = rsp.data.sort_by;
            this.room.sort_type = rsp.data.sort_type;
            this.room.status = rsp.data.status;
            this.room.img_link = rsp.data.img_link;
            this.room.model = rsp.data.model;
            this.room.ui_avatar_id = rsp.data.ui_avatar_id;
            this.room.ui_publish = rsp.data.ui_publish;
            this.room.ui_publish_status = rsp.data.ui_publish_status;
            this.room.ui_nickname = rsp.data.ui_nickname;
            this.room.ui_intro = rsp.data.ui_intro;
            this.room.ui_pro = rsp.data.ui_pro;
            this.room.publish = rsp.data.publish;

            this.performanceInit(this.room.display, this.room.sort_by, this.room.sort_type);

            //如果 room id 是0，则显示特定的顶部
            if (params.mrid == 0) {
                $('#title_of_root').show();
                $('#title_of_sub').hide();
            } else {
                $('#title_of_root').hide();
                $('#title_of_sub').show();
            }

            //如果用户是拥有者，显示直链相关的信息，并初始化
            //但根目录（top == 99）时不显示直链功能
            // console.log('Dir Room owner:' + this.room.owner);
            if (this.room.owner == 1) {
                $('#downloadAlert').hide();
                if (this.room.top != 99) {
                    this.parent_op.direct.dirRoomInit();
                    $('.room_direct_model').show();
                } else {
                    $('.room_direct_model').hide();
                }
            } else {
                $('.room_direct_model').hide();
                $('#downloadAlert').show();
            }

            //如果用户是拥有者，并且文件夹是公开的，则显示公开类型的图标
            $('.room_protection_lock').hide();
            $('.room_protection_unlock').hide();
            if (this.room.owner == 1 && this.room.parent !== 0) {
                $('.room_protection').show();
                console.log('Publish:',this.room.model);
                if (this.room.model === 'public') {
                    $('.room_protection_unlock').show();
                } else {
                    $('.room_protection_lock').show();
                }
            }else{
                $('.room_protection').hide();
            }

            //如果用户不是文件夹的拥有者，则显示出加入收藏夹的按钮
            if (this.room.owner == 0) {
                $('#room_btn_favorate').on('click', () => {
                    this.favoriteAdd(rsp.data.mr_id);
                });
                $('#room_btn_favorate').show();
            }

            //如果用户不是文件夹的拥有者，则显示举报按钮
            if (this.room.owner == 0) {
                $('#room_btn_report').show();
            }

            //如果这个文件夹有人收藏，则显示出收藏数量
            if (rsp.data.favorites > 0) {
                $('.fav-enabled').show();
                $('#favorite_count').html(rsp.data.favorites);
            }

            //如果文件夹不是用户的，则隐藏偏好设定
            if (this.room.owner == 0) {
                $('.room_btn_performance').hide();
            }else{
                $('.room_btn_performance').show();
            }

            //如果文件夹有设置图片
            if (this.room.img_link != '0') {
                //设置占位图
                $('.room_img').attr('src', '/img/loading.svg');
                //先请求图片，就绪后再显示
                let img = new Image();
                img.src = this.room.img_link;
                img.onload = () => {
                    $('.room_img').attr('src', this.room.img_link);
                }
                $('.room_img').show();
                //调整 UI
                $('#dir_title').attr('class','col-8');
                $('#dir_img').show();
            } else {
                $('.room_img').hide();
                //调整 UI
                $('#dir_title').attr('class','col-12');
                $('#dir_img').hide();
            }

            //如果是私有文件夹
            const isDesktopRoot = String(this.room.mr_id) === '0';
            if (this.room.model == 'private' && !isDesktopRoot) {
                $('.in-private-dir').hide();
                this.setDirIcon('private');
            } else {
                $('.in-private-dir').show();
                if (this.room.model !== 'private') {
                    this.setDirIcon('public');
                }
            }

            //如果是公开文件夹，启用搜索
            if (this.room.publish === 'yes') {
                $('#pf_publish').prop('checked', true);
                this.setDirIcon('publish');
            } else {
                $('#pf_publish').prop('checked', false);
                this.setDirIcon('public');
            }

            //如果有设定个性化设置
            if (this.room.ui_publish === 'yes' && this.room.ui_publish_status === 'ok') {
                if (this.room.ui_pro === 'yes') {
                    $('.userinfo_pro').show();
                } else {
                    $('.userinfo_sd').show();
                }
                $('.userinfo').show();
                $('.userinfo_nickname').html(`${this.room.ui_nickname}`);
            }else{
                $('.userinfo').hide();
            }

            $('#mr_copy').attr('data-clipboard-text', 'https://' + this.parent_op.site_domain + '/room/' + rsp.data.mr_id);
            $('.room_title').html(rsp.data.name);
            $('#dir_list').show();

            if (rsp.data.sub_rooms !== 0) {
                this.subroom_data = Array.isArray(rsp.data.sub_rooms) ? rsp.data.sub_rooms : [];
            } else {
                this.subroom_data = [];
            }

            this.parent_op.btn_copy_bind();
            this.filelist(0);

            //根目录时显示桌面专用按钮，隐藏子目录按钮
            //直链功能的显示已在上面处理（owner==1 && top!=99）
            if (this.room.top == 99) {
                $('.btn_for_desktop').show();
                $('.btn_for_sub').hide();
            } else {
                $('.btn_for_desktop').hide();
                $('.btn_for_sub').show();
            }

            //如果不是拥有者
            if (this.room.owner === 0) {
                $('.not_owner').hide();
            }

            if (isMobileScreen()) {
                this.mobilePrepare();
            } else {
                $('#room_back_btn').html(app.tpl('room_back_btn_tpl', {}));
            }

            //如果是赞助者，激活特定按钮的颜色
            if (this.parent_op.sponsor) {
                this.parent_op.isSponsor = true;
                this.parent_op.setBtnForSponsor();
            }

            $('#room_loading').hide();
            $('#room_loaded').show();

            //重新设定网页标题
            document.title = rsp.data.name;
            app.linkRebind();
        });
    }

    setDirIcon(status){
        //默认
        $('#dir_status').attr('name', 'folder-open-e1ad2j7l');
        if(status==='publish'){
            $('#dir_status').attr('name', 'folder-conversion-one');
        }
        if(status==='private'){
            $('#dir_status').attr('name', 'folder-lock-one');
        }
    }

    getIcons(room){
        let re = {icon:'',color:''};
        if(room.model === 'private'){
            re.icon = 'folder-lock-one';
            re.color = 'text-success';
            return re;
        }
        if(room.publish === 'yes'){
            re.icon = 'folder-conversion-one';
            re.color = 'text-yellow';
            return re;
        }
        if(room.fav !== 0){
            re.icon = 'folder-focus-one';
            re.color = 'text-pink';
            return re;
        }
        re.icon = 'folder-open-e1ad2j7l';
        re.color = 'text-yellow';
        return re;
    }

    mobilePrepare() {
        let mrid = this.room.mr_id === undefined ? 0 : this.room.mr_id;
        // 根目录时不显示返回按钮，因为没有上级目录
        if (this.room.top != 99) {
            let back_btn = `<a href="/app&listview=room&mrid=${this.room.parent}" tmpui-action="TL.dir.open()" class="text-azure mt-1 btn_for_sub"><iconpark-icon name="left-c" class="fa-fw fa-2x"></iconpark-icon></a>`;
            $('#room_back').html(back_btn);
        } else {
            $('#room_back').html('');
        }

        $('.btn_upload').attr('onclick', `TL.uploader.open('${mrid}')`);

        $('#mr_id').val(mrid);
        $('#mr_parent_id').val(this.room.parent);
        $('#mr_top_id').val(this.room.top);

        app.linkRebind();
        this.mobileTopabrFix(mrid);
    }
    
    // 更新导航栏下方的 padding
    updateNavPadding() {
        const navHeight = $('nav.fixed-top').outerHeight() || 0;
        const paddingTop = navHeight + 10;
        $('.mobile-head-padding-large').css('padding-top', paddingTop + 'px');
    }

    mobileTopabrFix(mrid) {
        // 将 mrid 转换为数字进行比较
        const mridNum = parseInt(mrid);
        
        // 动态计算顶部导航栏的实际高度并设置 padding
        this.updateNavPadding();
        
        // 统一显示按钮，不再对 mrid = 0 做特殊处理
        $('.btn_mobile_top').show();
        $('.btn_mobile_sub').hide();
    }

    favoriteAdd(mr_id) {
        if (!this.parent_op.isLogin()) {
            app.open('/login');
            return false;
        }
        alert(app.languageData.favorite_add_success);
        $.post(this.parent_op.api_mr, {
            action: 'favorite_add',
            token: this.parent_op.api_token,
            mr_id: mr_id,
        });
    }

    favoriteDel(mr_id) {
        $('#meetingroom_id_' + mr_id).hide();
        $.post(this.parent_op.api_mr, {
            action: 'favorite_del',
            token: this.parent_op.api_token,
            mr_id: mr_id,
        });
    }

    fileAdd(ukey) {
        var params = get_url_params();
        $('#btn-mraddlist-' + ukey).fadeOut(300);
        this.parent_op.recaptcha_do('mr_add', (recaptcha) => {
            $.post(this.parent_op.api_mr, {
                action: 'file_add',
                token: this.parent_op.api_token,
                //captcha: recaptcha,
                mr_id: params.mrid,
                ukey: ukey
            }, (rsp) => {
                $('#mraddlist-' + ukey).fadeOut(500);
            });
        });
    }

    filelist(page) {
        $('.no_files').fadeOut();
        $('.no_dir').fadeOut();
        $('.no_photos').fadeOut();

        $('#dir_list').html('');
        this.parent_op.list_data = [];

        //清空数据
        //$('#dir_list').html('');

        //if search
        let search = $('#room_search').val();

        $('#dir_list_box').show();
        $('.mr_filelist_refresh_icon').addClass('fa-spin');
        $('.mr_filelist_refresh_icon').attr('disabled', true);
        this.loadingON();
        
        var params = get_url_params();


        //获取文件夹关于排序的设定
        let key = getSortKeys();
        let room_sort_by = localStorage.getItem(key.sort_by);
        let room_sort_type = localStorage.getItem(key.sort_type);
        let room_display = localStorage.getItem(key.display);

        this.parent_op.recaptcha_do('mr_list', (recaptcha) => {
            let photo = 0;
            if (params.listview == 'photo') {
                photo = 1;
            }
            $.post(this.parent_op.api_mr, {
                action: 'file_list_page',
                token: this.parent_op.api_token,
                //captcha: recaptcha,
                page: 0,
                photo: photo,
                mr_id: params.mrid,
                sort_by: room_sort_by,
                sort_type: room_sort_type,
                search: search
            }, (rsp) => {
                //重要，装填用于提供下载的数据
                this.parent_op.list_data = listDataPrepare(rsp.data);
                $('.data_loading').hide();
                $('.mr_filelist_refresh_icon').removeClass('fa-spin');
                $('.mr_filelist_refresh_icon').removeAttr('disabled');
                this.listModel(rsp.data, page, params.mrid);
                this.file_list = rsp.data;
                this.loadingOFF();
                
                // 在文件列表加载完成后，重新调整移动端导航栏偏移并显示按钮
                if (isMobileScreen()) {
                    this.mobileTopabrFix(params.mrid);
                }
            });
        });
    }

    performanceInit(display,sort_by,sort_type) {
        //先检查这个文件夹是否已经有排序设定
        let keys = getSortKeys();

        let r_display = localStorage.getItem(keys.display);
        let r_sort_by = localStorage.getItem(keys.sort_by);
        let r_sort_type = localStorage.getItem(keys.sort_type);

        //初始化远端设定的选定值
        $('#pf_display').val(display);
        $('#pf_sort_by').val(sort_by);
        $('#pf_sort_type').val(sort_type);

        //如果本地没有存储，则使用文件夹的远端设定
        if (r_display === null) {
            localStorage.setItem(keys.display, display);
        }
        if (r_sort_by === null) {
            localStorage.setItem(keys.sort_by, sort_by);
            r_sort_by = sort_by;
        }
        if (r_sort_type === null) {
            localStorage.setItem(keys.sort_type, sort_type);
            r_sort_type = sort_type;
        }

        //初始化本地存储的选定值
        $('#sort_by').val(r_sort_by);
        $('#sort_type').val(r_sort_type);
    }

    performanceOpen() {
        $('#performanceModal').modal('show');
    }

    /**
     * 保存用户的设定   
     */
    performancePost() {
        let pf_sort_by = $('#pf_sort_by').val();
        let pf_sort_type = $('#pf_sort_type').val();
        let pf_publish   = $('#pf_publish').is(':checked') ? 'yes' : 'no';
        let mrid = this.room.mr_id;
        $.post(this.parent_op.api_mr, {
            action: 'pf_set',
            token: this.parent_op.api_token,
            sort_by: pf_sort_by,
            sort_type: pf_sort_type,
            pf_publish: pf_publish,
            mr_id: mrid
        });
    }

    btnActiveReset() {
        $('#room_btn_file_list').removeClass('text-blue');
        $('#room_btn_file_grid').removeClass('text-blue');
        $('#room_btn_file_photo').removeClass('text-blue');
    }

    treeGet() {
        $.post(this.parent_op.api_mr, {
            action: 'get_dir_tree',
            token: this.parent_op.api_token
        }, (rsp) => {
            if (rsp.status === 1) {
                this.dir_tree = rsp.data;
            } else {
                $('#mv_box_0').html(app.languageData.status_error_14);
            }
        });
    }

    // 设置需要排除的文件夹ID列表（避免将文件夹移动到自身）
    setExcludeFolderIds(ids) {
        this.excludeFolderIds = ids || [];
    }

    treeShow(parent) {
        for (let i in this.dir_tree) {
            // 排除被选中的文件夹，避免将文件夹移动到自身
            if (this.excludeFolderIds && this.excludeFolderIds.includes(String(this.dir_tree[i].id))) {
                continue;
            }
            if (this.treeHaveChildren(this.dir_tree[i].id)) {
                this.dir_tree[i].children = true;
            } else {
                this.dir_tree[i].children = false;
            }
            if (this.dir_tree[i].parent == parent) {
                $('#mv_box_' + parent).append(app.tpl('mv_box_tpl', this.dir_tree[i]));
                $('#mv_box_' + parent).slideDown();
                $('#mv_select_box_' + parent).removeAttr('onclick');
            }
        }
    }

    treeHaveChildren(parent) {
        for (let i in this.dir_tree) {
            if (this.dir_tree[i].parent == parent) {
                return true;
            }
        }
        return false;
    }

    moveTo(data, place) {
        let target = $('.folder-item.selected').data('id');
        if (target === undefined) {
            alert(app.languageData.status_error_13 || '请选择目标文件夹');
            return false;
        }
        $.post(this.parent_op.api_mr, {
            action: 'move_to_dir2',
            token: this.parent_op.api_token,
            data: data,
            mr_id: target
        }, (rsp) => {
            $('#movefileModal').modal('hide');
            this.open();
        });
    }

    // 新增函数：处理文件夹点击事件
    folderClick(id) {
        const $folderItem = $(`#dir_item_${id}`);
        const $folderContent = $(`#mv_box_${id}`);
        const isExpanded = $folderItem.attr('data-expanded') === 'true';
        
        // 处理选中状态
        $('.folder-item').removeClass('selected');
        $folderItem.addClass('selected');
        
        // 检查是否有子文件夹
        if (this.treeHaveChildren(id)) {
            const $icon = $(`#folder_icon_${id}`);
            
            if (isExpanded) {
                // 收起
                $folderContent.slideUp();
                $folderItem.attr('data-expanded', 'false');
                $icon.attr('name', 'folder-plus');
            } else {
                // 展开
                if ($folderContent.children().length === 0) {
                    this.treeShowNew(id);
                }
                $folderContent.slideDown();
                $folderItem.attr('data-expanded', 'true');
                $icon.attr('name', 'folder-open');
            }
        }
    }

// 新增函数：显示子文件夹（替代原来的 treeShow 函数）
treeShowNew(parent) {
    for (let i in this.dir_tree) {
        // 排除被选中的文件夹，避免将文件夹移动到自身
        if (this.excludeFolderIds && this.excludeFolderIds.includes(String(this.dir_tree[i].id))) {
            continue;
        }
        if (this.dir_tree[i].parent == parent) {
            if (this.treeHaveChildren(this.dir_tree[i].id)) {
                this.dir_tree[i].children = true;
            } else {
                this.dir_tree[i].children = false;
            }
            $('#mv_box_' + parent).append(app.tpl('mv_box_tpl', this.dir_tree[i]));
        }
    }
}

    // 搜索文件夹功能
    searchFolder(keyword) {
        keyword = keyword.trim().toLowerCase();
        
        if (keyword === '') {
            this.clearSearch();
            return;
        }
        
        // 显示清除按钮
        $('#mv_search_clear').show();
        
        // 搜索匹配的文件夹
        const results = [];
        for (let i in this.dir_tree) {
            const folder = this.dir_tree[i];
            // 排除被选中要移动的文件夹
            if (this.excludeFolderIds && this.excludeFolderIds.includes(folder.id)) {
                continue;
            }
            if (folder.name.toLowerCase().includes(keyword)) {
                // 构建文件夹路径
                const path = this.buildFolderPath(folder.id);
                results.push({
                    id: folder.id,
                    name: folder.name,
                    path: path
                });
            }
        }
        
        // 显示搜索结果
        this.showSearchResults(results, keyword);
    }
    
    // 构建文件夹路径
    buildFolderPath(folderId) {
        const pathParts = [];
        let currentId = folderId;
        
        // 向上遍历构建路径
        while (currentId != 0) {
            const folder = this.dir_tree.find(f => f.id == currentId);
            if (!folder) break;
            pathParts.unshift(folder.name);
            currentId = folder.parent;
        }
        
        return '/' + pathParts.join('/');
    }
    
    // 显示搜索结果
    showSearchResults(results, keyword) {
        const $searchResults = $('#mv_search_results');
        const $treeWrapper = $('#mv_tree_wrapper');
        
        // 隐藏树形结构，显示搜索结果
        $treeWrapper.hide();
        $searchResults.show();
        
        if (results.length === 0) {
            const noResultText = app.languageData.move_folder_no_result || '未找到匹配的文件夹';
            $searchResults.html(`<div class="mv-no-results">${noResultText}</div>`);
            return;
        }
        
        // 渲染搜索结果
        let html = '';
        for (let result of results) {
            html += app.tpl('mv_search_result_tpl', result);
        }
        $searchResults.html(html);
    }
    
    // 清除搜索
    clearSearch() {
        $('#mv_search_input').val('');
        $('#mv_search_clear').hide();
        $('#mv_search_results').hide().empty();
        $('#mv_tree_wrapper').show();
        
        // 清除搜索结果中的选中状态，但保留树形结构中的选中状态
        $('.search-result-item').removeClass('selected');
    }
    
    // 搜索结果点击事件
    searchResultClick(id) {
        // 清除所有选中状态
        $('.folder-item').removeClass('selected');
        // 选中当前项
        $(`#search_item_${id}`).addClass('selected');
    }


    loadingON() {
        $('#loading_box').show();
    }

    loadingOFF() {
        $('#loading_box').fadeOut();
    }
}
