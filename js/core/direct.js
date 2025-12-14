class direct {

    isInit = false
    parent_op = null
    domain = 0
    total_transfer = 0
    total_downloads = 0
    protocol = 'http://'
    quota = 0
    allow_ext = ['mp4', 'm4v', 'webm', 'mov', 'ogg', 'mp3']
    set = false
    ssl = false
    ssl_auto = false
    traffic_chart = null
    key = 0

    sort_by = 0
    sort_type = 0
    hp_time = 0

    page_number = 0
    list_Data = []
    autoLoader = null

    // 更新导航栏下方的 padding
    updateNavPadding() {
        const navHeight = $('nav.fixed-top').outerHeight() || 0;
        const paddingTop = navHeight - 35;
        $('.mobile-head-padding-large').css('padding-top', paddingTop + 'px');
    }

    init(parent_op) {
        this.parent_op = parent_op;
        this.sortSettingsInit();
        
        // 初始化自动加载器
        this.autoLoader = new AutoLoader({
            loadFunction: (page) => this.loadData(page),
            minItemsForDisable: 50
        });
    }

    init_details(cb) {

        if (this.parent_op.isLogin() === false) {
            cb();
            return false;
        }

        //启动监听
        this.parent_op.Selecter.initEventListeners();

        //获取当前
        let url = get_url_params('tmpui_page');
        let page = url.tmpui_page;
        let listview = url.listview;
        if (page !== '/app' && (listview === 'direct' || listview === 'room')) {
            cb();
            return false;
        }

        if (page === '/app' && listview === 'direct') {
            //如果是移动设备
            if (isMobileScreen()) {
                // 动态计算顶部导航栏的实际高度并设置 padding
                this.updateNavPadding();
            } else {
                //更新下载统计图
                this.refreshUsage(2, '24H');
            }
        }

        this.getDetails((rsp) => {

            if (this.ssl) {
                $('#direct_bind_ssl').html(app.languageData.direct_ssl_enbaled);
                $('#box_disable_ssl').show();
                this.protocol = 'https://';
            } else {
                $('#box_disable_ssl').hide();
                $('#direct_bind_ssl').html(app.languageData.direct_ssl_disabled);
            }

            //如果尚未初始化，隐藏 ready_to_buy_quato
            if (this.domain == 0) {
                $('.ready_to_buy_quato').hide();
            }

            //如果 ssl_acme 是 true，标记为自动申请证书
            if (this.ssl_acme) {
                this.protocol = 'https://';
                $('#direct_bind_ssl').html(app.languageData.direct_ssl_enbaled);
            } else {
                $('#direct_bind_ssl').html(app.languageData.direct_ssl_disabled);
            }

            //如果 API key 是 0，说明没有设置 API key，显示提示
            if (this.key == 0) {
                $('#api_key').html(app.languageData.direct_api_key_not_set);
            } else {
                $('#api_key').html(this.key);
            }

            //如果有设定限制单个 IP 的日流量
            if (this.traffic_limit > 0) {
                $('#direct_traffic_limit').val(this.traffic_limit);
                $('#direct_set_traffic_limit_title').html(app.languageData.direct_traffic_limit);
            } else {
                $('#direct_set_traffic_limit_title').html(app.languageData.direct_traffic_unlimit);
            }

            //如果有设定品牌
            if (rsp.data.brand_logo_id !== '0') {
                let img_size = '64px';
                if (isMobileScreen()) {
                    img_size = '32px';
                }
                $('#brand_saved_logo').html(`<img src="https://tmp-static.vx-cdn.com/static/logo?id=${rsp.data.brand_logo_id}" style="width:48px;border-radius: 8px;" />`);
                $('#direct_branded_logo').html(`<img src="https://tmp-static.vx-cdn.com/static/logo?id=${rsp.data.brand_logo_id}" style="width:${img_size};border-radius: 12px;" />`);
            }

            if (rsp.data.brand_title !== '0') {
                $('#brand_saved_title').html(rsp.data.brand_title);
            }
            if (rsp.data.brand_content !== '0') {
                $('#brand_saved_content').html(rsp.data.brand_content);
            }
            this.brandStatus(rsp.data.brand_status);

            if (page === '/app' && listview === 'direct') {
                this.ininOnDirectPage();
            }

            if (typeof cb == 'function') {
                cb();
            }
        });
    }

    getDetails(cb) {
        $.post(this.parent_op.api_direct, {
            'action': 'details',
            'token': this.parent_op.api_token
        }, (rsp) => {
            
            this.isInit = true;
            this.key = rsp.data.key;
            this.domain = rsp.data.domain;
            this.quota = rsp.data.quota;
            this.quota_free = rsp.data.quota_free;
            this.total_downloads = rsp.data.total_downloads;
            this.total_transfer = rsp.data.total_transfer;
            this.hp_time = parseInt(rsp.data.hp_time);
            this.set = 1;
            this.ssl_auto = rsp.data.ssl_auto === 'yes' ? true : false;
            this.traffic_limit = rsp.data.traffic_limit;
            this.ssl = rsp.data.ssl_status === 'yes' ? true : false;
            this.ssl_acme = rsp.data.ssl_acme === 'disable' ? false : true;

            cb(rsp);
        }, 'json');
    }

    isReady() {
        this.hp_time--;
        if (this.hp_time < 1) {
            //已完成部署
            $('#direct_ready').show();
            $('#direct_progress').hide();
        } else {
            //尚未完成部署，计算进度条，进度计算方式，300 秒为 100% 进度， hp_time 是剩余的秒数
            let percent = 100;
            if (this.hp_time > 1) {
                percent = 100 - (this.hp_time / 300 * 100);
            }
            $('#direct_progress').show();
            $('#direct_progress_bar').css('width', percent + '%');
            $('#direct_ready').hide();
            //一秒后再次检查
            setTimeout(() => {
                this.isReady();
            }, 1000);
        }
    }

    resetAPIKey() {
        $('#direct_api_key_reset_btn').attr('disabled', true);
        $.post(this.parent_op.api_direct, {
            'action': 'generate_key',
            'token': this.parent_op.api_token,
        }, () => {
            $('#direct_api_key_reset_btn').removeAttr('disabled');
            this.init_details();
        });
    }

    async copyAPIKey() {
        await this.parent_op.directCopy('#direct_api_key_copy_btn', this.key, false);
    }

    setTrafficLimit() {
        $('#box_set_traffic_limit').show();
        let val = $('#direct_traffic_limit').val();
        $.post(this.parent_op.api_direct, {
            'action': 'set_traffic_limit',
            'token': this.parent_op.api_token,
            'val': val
        }, () => {
            if (val > 0) {
                $('#direct_set_traffic_limit_title').html(app.languageData.direct_traffic_limit);
            } else {
                $('#direct_set_traffic_limit_title').html(app.languageData.direct_traffic_unlimit);
            }
            setTimeout(() => {
                $('#box_set_traffic_limit').hide();
            }, 1000);
        });
    }

    ininOnDirectPage() {
        //检查域名是否正确指向到 dicrect.tmp.link
        $.post(this.parent_op.api_direct, {
            'action': 'check_domain',
            'token': this.parent_op.api_token
        }, (rsp) => {
            if (rsp.status == 0) {
                $('#direct_notice_cname').show();
            }
        }, 'json');

        //检查剩余的流量配额是否少于 5GB
        if (this.quota < (1024 * 1024 * 1024 * 5) && this.quota_free < (1024 * 1024 * 1024 * 5)) {
            $('#direct_notice_usage').show();
        }
    }

    openDomainEditor() {
        $('#direct_domain_set_title').text(app.languageData.direct_btn_bind_domain);
        $('#direct_domain_set').fadeIn();
        $('#filelist').hide();
    }

    is_allow_play(filename) {
        let ext = filename.split('.').pop();
        //if file can be paly and domain not be 5t-cdn.com
        // if (this.allow_ext.indexOf(ext) == -1 || this.domain.indexOf('.5t-cdn.com') != -1) {
        if (this.allow_ext.indexOf(ext) == -1) {
            return false;
        }
        return true;
    }

    /**
     * 初始化模块信息
     */
    prepare() {
        if (this.set === false) {
            setTimeout(() => {
                this.prepare();
            }, 1000);
        }
        let quota = bytetoconver(this.quota, true);
        let quota_free = bytetoconver(this.quota_free, true);
        let total_transfer = bytetoconver(this.total_transfer, true);

        //根据
        this.isReady();


        if (this.domain != 0) {
            $('#filelist').show();
            $('#direct_bind_domain_box').show();
            $('#direct_bind_domain').html(this.domain);
            $('#direct_bind_domain').attr('href', this.protocol + this.domain);
            //如果启用了 SSL，则更换图标
            if (this.ssl) {
                $('#direct_bind_domain_icon').attr('name', 'lock-solid');
            }
        } else {
            $('#filelist').hide();
            $('#direct_domain_set').fadeIn();
            $('#direct_bind_domain_box').hide();
            $('.no_direct_domains').fadeIn();
            $('#direct_domain_set_title').text(app.languageData.direct_intro_modal_body_title);
            setTimeout(() => {
                //3 秒后 淡出
                $('#direct_domain_set_title').addClass('fade-out');
                setTimeout(() => {
                    //淡入
                    $('#direct_domain_set_title').addClass('fade-in');
                    $('#direct_domain_set_title').removeClass('fade-out');
                    $('#direct_domain_set_title').text(app.languageData.direct_btn_bind_domain);
                    setTimeout(() => {
                        $('#direct_domain_set_title').removeClass('fade-in');
                    }, 2000);
                }, 1000);
            }, 3000);
        }

        $('#direct_quota').html(quota);
        $('.direct_quota_free').html(quota_free);
        $('#direct_total_transfer').html(total_transfer);
        $('#direct_total_downloads').html(this.total_downloads);
    }

    is_allow() {
        if (this.domain == 0) {
            return false;
        }
        return true;
    }

    genLinkDirect(dkey, filename) {
        // let filename2 = encodeURI(filename);
        let filename2 = filename;
        return {
            download: `${this.protocol}${this.domain}/files/${dkey}/${filename2}`,
            res: `${this.protocol}${this.domain}/res/${dkey}/${filename2}`,
            play: `${this.protocol}${this.domain}/stream-${dkey}`
        };
    }

    async addLink(ukey) {
        $.post(this.parent_op.api_direct, {
            'action': 'add_link',
            'ukey': ukey,
            'token': this.parent_op.api_token
        }, async (rsp) => {
            if (rsp.status == 1) {
                //提示添加成功，并复制到剪贴板
                let files = rsp.data;
                $.notifi(app.languageData.direct_add_link_success, "success");
                await this.parent_op.bulkCopy(null, this.genLinkDirect(files[0].dkey, files[0].name).download, false);
            } else {
                $.notifi(app.languageData.status_error_0, "success");
            }
        }, 'json');
    }

    addLinks(ukeys) {
        $.post(this.parent_op.api_direct, {
            'action': 'add_link',
            'ukey': ukeys,
            'token': this.parent_op.api_token
        }, async (rsp) => {
            if (rsp.status == 1) {
                //提示添加成功，并复制到剪贴板
                let files = rsp.data;
                $.notifi(app.languageData.direct_add_link_success, "success");
                for (let i in files) {
                    await this.parent_op.bulkCopy(null, this.genLinkDirect(files[i].dkey, files[i].name).download, false);
                }
            } else {
                $.notifi(app.languageData.status_error_0, "success");
            }
        }, 'json');
    }

    delLink(direct_key) {
        $(`.file_unit_${direct_key}`).remove();
        $.post(this.parent_op.api_direct, {
            'action': 'del_link',
            'direct_key': direct_key,
            'token': this.parent_op.api_token
        });
    }

    delLinks(direct_key) {
        if (direct_key.length === 0) {
            return false;
        }
        for (let i = 0; i < direct_key.length; i++) {
            $(`.file_unit_${direct_key[i]}`).remove();
        }
        $.post(this.parent_op.api_direct, {
            'action': 'del_link',
            'direct_key': direct_key,
            'token': this.parent_op.api_token
        });
    }

    delRoom(key) {
        $(`.room_unit_${key}`).remove();
        $.post(this.parent_op.api_direct, {
            'action': 'room_del',
            'direct_key': key,
            'token': this.parent_op.api_token
        });
    }

    /**
     * 初始化页面
     */
    filelist(page) {
        // 使用AutoLoader加载数据
        this.autoLoader.load(page);
    }
    
    /**
     * 实际加载数据的函数，供AutoLoader调用
     */
    loadData(page) {
        //初始化选择器
        this.parent_op.Selecter.pageInit();

        if (this.parent_op.logined != 1) {
            app.open('/app&listview=login');
            return false;
        }

        if (this.domain == 0) {
            return false;
        }

        $('.no_files').fadeOut();
        $('.no_dir').fadeOut();
        $('.no_photos').fadeOut();
        //when page is 0,page will be init
        if (page == 0) {
            this.page_number = 0;
            $('#direct_filelist').html('');
            this.list_data = [];
        } else {
            this.page_number++;
        }
        if (localStorage.getItem('app_login') != 1) {
            this.logout();
            return false;
        }
        //if search
        let search = $('#direct_search').val();
        let total_size_text = bytetoconver(this.total_size);


        //获取排序
        let key = this.keyGet();
        let sort_by = localStorage.getItem(key.sort_by);
        let sort_type = localStorage.getItem(key.sort_type);

        $('#filelist_refresh_icon').addClass('fa-spin');
        $('#filelist_refresh_icon').attr('disabled', true);
        this.parent_op.loading_box_on();
        let photo = 0;
        if (localStorage.getItem('app_direct_view') == 'photo') {
            photo = 1;
        }
        $.post(this.parent_op.api_direct, {
            action: 'filelist_page',
            page: this.page_number,
            token: this.parent_op.api_token,
            sort_type: sort_type,
            sort_by: sort_by,
            search: search
        }, (rsp) => {
            $('#filelist_refresh_icon').removeClass('fa-spin');
            $('#filelist_refresh_icon').removeAttr('disabled');
            if (rsp.status === 0) {
                if (page == 0) {
                    $('#direct_filelist').html('<div class="text-center"><iconpark-icon name="folder-open" class="fa-fw fa-4x"></iconpark-icon></div>');
                }
            } else {
                this.direct_view(rsp.data, page);
                for (let i in rsp.data) {
                    this.list_data[rsp.data[i].ukey] = rsp.data[i];
                }
            }
            this.loading_box_off();
            
            // 让AutoLoader处理响应
            this.autoLoader.handleResponse(rsp);
        });
    }

    open() {
        if (this.parent_op.logined != 1) {
            app.open('/app&listview=login');
        }

        if (this.domain == 0) {
            return false;
        }

        $('.no_files').fadeOut();
        $('.no_dir').fadeOut();
        $('.no_photos').fadeOut();
        //when page is 0,page will be init
        this.page_number = 0;
        $('#direct_filelist').html('');
        this.list_data = [];

        if (localStorage.getItem('app_login') != 1) {
            this.logout();
            return false;
        }

        $.post(this.parent_op.api_direct, {
            action: 'room_list',
            token: this.parent_op.api_token,
        }, (rsp) => {
            if (rsp.status === 0) {
                $('.no_direct_room').fadeIn();
            } else {
                $('#direct_room_list').append(app.tpl('direct_room_list_tpl', rsp.data));
                //重写绑定
                app.linkRebind();
            }
        });
    }

    dirRoomInit() {
        if (this.parent_op.isLogin() === false) {
            console.log('Not login');
            return false;
        }

        if(this.isInit === false){
            this.init_details(() => {
                this.dirRoomInit();
            });
            return false;
        }

        // console.log('dirRoomInit: ' + this.domain);
        if (this.domain == 0) {
            $('#pf_allow_direct').attr('disabled', true);
            $('#pf_allow_direct_notice').show();
            return false;
        } else {
            $('#pf_allow_direct_notice').hide();
        }

        let mrid = get_page_mrid();
        $.post(this.parent_op.api_direct, {
            'action': 'dir_details',
            'mrid': mrid,
            'token': this.parent_op.api_token
        }, (rsp) => {
            if (rsp.status == 1) {
                this.dir_btn_status = true;
                this.dir_link = `${this.protocol}${this.domain}/share/${rsp.data}/`;
                this.dir_key = rsp.data;
                //操作按钮
                this.dirRoomPfBtnUpdate();
            } else {
                this.dir_btn_status = false;
                this.dirRoomPfBtnUpdate();
            }
            //更新文件夹界面
            this.dirRoomUpdate();
        }, 'json');
    }

    async genLinkDirectForRoom(direct_id, file_name) {
        let link = `${this.protocol}${this.domain}/dir-download/${this.dir_key}/${direct_id}/${file_name}`;
        //添加到剪贴板
        await this.parent_op.bulkCopy(null, link, false);
    }

    async genLinkDirectForRoomV2(file_name) {
        let link = `${this.protocol}${this.domain}/share/${this.dir_key}/${file_name}`;
        //添加到剪贴板
        await this.parent_op.bulkCopy(null, link, false);
    }

    dirToggle() {
        let status = $('#pf_allow_direct').is(':checked') ? true : false;
        let post_params = {};

        if (status) {
            post_params.action = 'add_dir';
            post_params.mrid = get_page_mrid();
        } else {
            //询问是否确认
            if (!confirm(app.languageData.direct_dir_disable)) {
                return false;
            }
            post_params.action = 'del_dir';
            post_params.direct_key = this.dir_key;
        }
        post_params.token = this.parent_op.api_token;

        $.post(this.parent_op.api_direct, post_params, (rsp) => {
            if (rsp.status == 1) {
                if (post_params.action === 'del_dir') {
                    this.dir_btn_status = false;
                } else {
                    this.dir_btn_status = true;
                    this.dir_key = rsp.data;
                    this.dir_link = `${this.protocol}${this.domain}/share/${rsp.data}/`;
                }
                //操作按钮
                this.dirRoomPfBtnUpdate();
                //更新文件夹界面
                this.dirRoomUpdate();
                //刷新列表
                this.parent_op.dir.open();
            }
        }, 'json');
    }

    dirRoomUpdate() {
        if (this.dir_btn_status) {
            $('#room_link').html(this.dir_link);
            $('#room_link').attr('href', this.dir_link);
            $('#room_direct_model').show();
        } else {
            $('#room_direct_model').hide();
        }
    }

    dirRoomPfBtnUpdate() {
        if (this.dir_btn_status) {
            $('#pf_allow_direct').attr('checked', 'checked');
        } else {
            $('#pf_allow_direct').removeAttr('checked');
        }

        //控制是否显示文件夹内的文件链接复制按钮
        if (this.dir_btn_status) {
            $('.btn_for_copy_in_dir').show();
            $('.btn_for_gen_link').hide();
        } else {
            $('.btn_for_copy_in_dir').hide();
            $('.btn_for_gen_link').show();
        }

    }

    direct_filelist_model(type) {
        switch (type) {
            case 'photo':
                localStorage.setItem('app_direct_view', 'photo');
                break;
            case 'list':
                localStorage.setItem('app_direct_view', 'list');
                break;
            default:
                localStorage.setItem('app_direct_view', 'list');
        }
        this.filelist(0);
    }

    direct_view(data, page) {
        switch (localStorage.getItem('app_direct_view')) {
            case 'photo':
                this.direct_filelist_by_photo(data, page);
                break;
            case 'list':
                this.direct_filelist_by_list(data, page);
                break;
            default:
                this.direct_filelist_by_list(data, page);
        }
    }

    direct_filelist_by_list(data, page) {
        $('#ws_btn_file_list').addClass('bg-dark');
        if (page == 0 && data == false) {
            $('.no_files').show();
        }

        //为 data 增加直链单元
        for (let i in data) {
            let filename = encodeURIComponent(data[i].fname);
            data[i].direct_link = this.genLinkDirect(data[i].direct_key, filename).download;
            data[i].play_link = this.genLinkDirect(data[i].direct_key, filename).play;
        }

        $('#direct_filelist').append(app.tpl('direct_filelist_list_tpl', data));
        $('.lefttime-remainder').each((i, e) => {
            let id = $(e).attr('id');
            let time = $(e).attr('data-tmplink-lefttime');
            countDown(id, time,this.parent_op.currentLanguage);
        });
        this.parent_op.btn_copy_bind();
        app.linkRebind();
    }

    sortSettingsInit() {
        let key = this.keyGet();

        let storage_sort_by = localStorage.getItem(key.sort_by);
        let sort_by = storage_sort_by === null ? this.sort_by : storage_sort_by;
        localStorage.setItem(key.sort_by, sort_by);
        $("#direct_sort_by option[value='" + sort_by + "']").attr("selected", "selected");

        let storage_sort_type = localStorage.getItem(key.sort_type);
        let sort_type = storage_sort_type === null ? this.sort_type : storage_sort_type;
        localStorage.setItem(key.sort_type, sort_type);
        $("#direct_sort_type option[value='" + sort_type + "']").attr("selected", "selected");
    }

    sortSettings() {
        let key = this.keyGet();
        this.sort_by = $('#direct_sort_by').val();
        this.sort_type = $('#direct_sort_type').val();
        localStorage.setItem(key.sort_by, this.sort_by);
        localStorage.setItem(key.sort_type, this.sort_type);

        this.filelist(0);
        $('#directSortModal').modal('hide');
    }

    sortModal() {
        $('#directSortModal').modal('show');
    }

    keyGet() {
        return {
            view: 'app_direct_view',
            sort_by: 'app_direct_view_sort_by',
            sort_type: 'app_direct_view_sort_type',
        }

    }

    list_autoload_enabled() {
        // 使用AutoLoader模块替代原有实现
        this.autoLoader.enable();
    }

    list_autoload_disabled() {
        // 使用AutoLoader模块替代原有实现
        this.autoLoader.disable();
    }

    /**
     * 设置域名
     */
    enableSSL() {
        this.loading_box_on();

        // var ssl_cert = $('#set_ssl_cert').val() + "\n" + $('#set_ssl_cert_ca').val() + "\n" + $('#set_ssl_cert_chain').val();
        var ssl_cert = $('#set_ssl_cert').val();
        var ssl_key = $('#set_ssl_key').val();

        $.post(this.parent_op.api_direct, {
            'action': 'direct_set_ssl',
            'ssl_cert': ssl_cert, 'ssl_key': ssl_key,
            'token': this.parent_op.api_token
        }, (rsp) => {
            if (rsp.status == 1) {
                alert(app.languageData.direct_msg_complete);
                this.init_details(() => {
                    $('#directSSLModal').modal('hide');
                });
            } else {
                alert(app.languageData.direct_msg_ssl_invalid);
            }
            this.loading_box_off();
        }), 'json';
    }

    disableSSL() {

        if (!confirm(app.languageData.direct_msg_ssl_disable)) {
            return false;
        }

        this.loading_box_on();

        $.post(this.parent_op.api_direct, {
            'action': 'direct_disable_ssl',
            'token': this.parent_op.api_token
        }, (rsp) => {
            alert(app.languageData.direct_msg_complete);
            window.location.reload();
        }), 'json';
    }

    // 停用服务
    disableService() {
        if (!confirm(app.languageData.direct_stop)) {
            return false;
        }
        this.loading_box_on();
        $.post(this.parent_op.api_direct, {
            'action': 'set_off',
            'token': this.parent_op.api_token
        }, () => {
            window.location.reload();
        }), 'json';
    }

    /**
     * 设置域名
     */
    setDomain() {
        this.loading_box_on();

        let domain = $('#direct-domain').val();
        let enable_ssl = $('input[name="enable_ssl"]:checked').val();

        //检查输入的是否是正确的域名
        if (domain == null) {
            return false;
        }
        $.post(this.parent_op.api_direct, {
            'action': 'direct_set_domain',
            'domain': domain,
            'ssl_enable': enable_ssl,
            'token': this.parent_op.api_token
        }, (rsp) => {
            let msg = this.selectBingDomainText(rsp.status);
            $('#direct_modal_msg').show();
            $('#direct_modal_msg_text').html(msg);
            if (rsp.status == 1) {
                alert(app.languageData.direct_btn_bind_prompt_ok);
                $('#direct_bind_domain_box').show();
                $('#direct_bind_domain').html(domain);
                $('#direct_bind_domain').attr('href', this.protocol + domain);
                $('#diredirect_bind_notice').html('');
                window.location.reload();
            }
            this.loading_box_off();
        }), 'json';
    }

    selectBingDomainText(number) {
        let msg = '未知错误';
        switch (number) {
            case 1:
                msg = app.languageData.direct_intro_modal_msg_1;
                break;
            case 2:
                msg = app.languageData.direct_intro_modal_msg_2;
                break;
            case 4:
                msg = app.languageData.direct_intro_modal_msg_3;
                break;
            case 3:
                msg = app.languageData.direct_intro_modal_msg_4;
                break;
            case 5:
                msg = app.languageData.direct_ssl_check_input_msg_cname;
                break;
            case 6:
                msg = app.languageData.direct_ssl_check_input_msg_acme;
                break;
            case 7:
                msg = app.languageData.direct_ssl_check_input_msg_txt;
                break;
        }
        return msg;
    }

    /**
     * 设置域名
     */
    getFreeQuotaOfSponsor() {
        this.loading_box_on();
        $.post(this.parent_op.api_pay, {
            'action': 'free_dq_get',
            'token': this.parent_op.api_token
        }, (rsp) => {
            switch (rsp.status) {
                case 1:
                    alert(app.languageData.direct_sponsor_freee_quota_msg_1);
                    break;
                case 2:
                    alert(app.languageData.direct_sponsor_freee_quota_msg_2);
                    break;
                case 3:
                    alert(app.languageData.direct_sponsor_freee_quota_msg_3);
                    break;
                default:
                    alert(app.languageData.status_error_0);
            }
            this.loading_box_off();
        }), 'json';
    }

    /**
     * 上传 Logo
     */
    brandLogoSet(logo) {
        $('.brand_logo_postmsg').html(app.languageData.direct_brand_logo_set_process);
        $('#brand_set_upload_status').html('<iconpark-icon name="spinner" class="fa-fw fa-spin text-green"></iconpark-icon>');
        let xhr = new XMLHttpRequest();
        let formData = new FormData();
        formData.append('action', 'brand_set_logo');
        formData.append('token', this.parent_op.api_token);
        formData.append('file', logo.files[0]);
        xhr.open('POST', this.parent_op.api_direct, true);
        xhr.onload = (e) => {
            if (xhr.status == 200) {
                let rsp = JSON.parse(xhr.responseText);
                if (rsp.status == 1) {
                    $('.brand_logo_postmsg').html(app.languageData.direct_brand_logo_set_complete);
                }
                if (rsp.status == 0) {
                    $('.brand_logo_postmsg').html(app.languageData.direct_brand_logo_set_invalid);
                }
                if (rsp.status == 2) {
                    $('.brand_logo_postmsg').html(app.languageData.direct_brand_logo_set_size);
                }
            } else {
                $('.brand_logo_postmsg').html(app.languageData.status_error_0);
            }
            $('#brand_set_upload_status').html('<iconpark-icon name="check" class="fa-fw text-green"></iconpark-icon>');
            this.init_details();
        }
        xhr.send(formData);
    }

    /**
     * 设置品牌名称和描述
     */
    brandSet() {
        let brandTitle = $('#brand_name_input').val();
        let brandContent = $('#brand_content_input').val();
        if (brandTitle == '' || brandContent == '') {
            alert(app.languageData.direct_brand_name_empty);
            return false;
        }
        $.post(this.parent_op.api_direct, {
            'action': 'brand_set',
            'token': this.parent_op.api_token,
            'brand_title': brandTitle,
            'brand_content': brandContent
        }, (rsp) => {
            if (rsp.status == 1) {
                $('.brand_setting_status').html('<iconpark-icon name="check" class="fa-fw text-green"></iconpark-icon>');
                this.init_details();
            } else {
                $('.brand_setting_status').html('<iconpark-icon name="times" class="fa-fw text-red"></iconpark-icon>');
            }
        }, 'json');
    }

    brandReview() {
        $.post(this.parent_op.api_direct, {
            'action': 'brand_review',
            'token': this.parent_op.api_token
        }, (rsp) => {
            if (rsp.status == 1) {
                alert(app.languageData.brand_review_status_1);
                this.init_details();
            } else {
                alert(app.languageData.brand_review_status_0);
            }
        }, 'json');
    }

    brandStatus(status) {
        switch (status) {
            case 'ok':
                $('#brand_status').html('<iconpark-icon name="circle-check" class="fa-fw text-green mr-1"></iconpark-icon>' + app.languageData.brand_status_ok);
                break;
            case 'reject':
                $('#brand_status').html('<iconpark-icon name="times" class="fa-fw text-red mr-1"></iconpark-icon>' + app.languageData.brand_status_reject);
                break;
            case 'wait':
                $('#brand_status').html('<iconpark-icon name="timer" class="fa-fw text-blue mr-1"></iconpark-icon>' + app.languageData.brand_status_wait);
                break;
            case 'review':
                $('#brand_status').html('<iconpark-icon name="loader" class="fa-fw text-blue mr-1"></iconpark-icon>' + app.languageData.brand_status_review);
                break;
        }
    }

    refreshUsage(rt) {
        var post = {
            token: this.parent_op.api_token,
            rt: rt,
            action: 'chart_get_usage'
        };

        $.post(this.parent_op.api_direct, post, (rsp) => {
            var options = {
                series: [{
                    name: app.languageData.direct_total_transfer,
                    data: rsp.data.traffic
                }],
                chart: {
                    height: 200,
                    type: 'bar',
                },
                plotOptions: {
                    bar: {
                        borderRadius: 10,
                        dataLabels: {
                            position: 'top', // top, center, bottom
                        },
                    }
                },
                tooltip: {
                    enabled: false // 全局禁用 tooltip
                },
                dataLabels: {
                    enabled: true,
                    formatter: function (val) {
                        return bytetoconver(val, true);
                    },
                    offsetY: -20,
                    style: {
                        fontSize: '12px',
                        colors: ["#304758"]
                    }
                },

                xaxis: {
                    categories: rsp.data.time,
                    position: 'top',
                    axisBorder: {
                        show: false
                    },
                    axisTicks: {
                        show: false
                    },
                    crosshairs: {
                        fill: {
                            type: 'gradient',
                            gradient: {
                                colorFrom: '#D8E3F0',
                                colorTo: '#BED1E6',
                                stops: [0, 100],
                                opacityFrom: 0.4,
                                opacityTo: 0.5,
                            }
                        }
                    },
                    tooltip: {
                        enabled: false,
                    }
                },
                yaxis: {
                    axisBorder: {
                        show: false
                    },
                    axisTicks: {
                        show: false,
                    },
                    labels: {
                        show: false,
                    }

                },
                title: {
                    floating: true,
                    offsetY: 330,
                    align: 'center',
                    style: {
                        color: '#444'
                    }
                }
            };

            options = getChartThemeOptions(options);

            if (this.traffic_chart !== null) {
                this.traffic_chart.destroy();
            }
            this.traffic_chart = new ApexCharts(document.querySelector("#x2_chart_usage"), options);
            this.traffic_chart.render();
        }, 'json');
    }

    checkInput() {
        let domain = $('#direct-domain').val();

        //如果域名是 *.5t-cdn.com 作为子域名(但不是三级域名，比如 app.app.5t-cdn.com) ，则不执行任何检查
        if (domain.indexOf('.5t-cdn.com') != -1) {
            //不能是三级域名
            if (domain.split('.').length > 3) {
                $('#domainHelp').hide();
                $('#domainHelpError').show();
                return false;
            }
            $('#domainHelp').hide();
            $('#domainHelpError').hide();
            $('#domainHelpCNAME').hide();
            $('#enable_ssl_box').hide();
            return true;
        }

        let enable_ssl = $('input[name="enable_ssl"]:checked').val();
        let reg = /^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?$/;
        $('.req_new_acme_domain').text(`_acme-challenge.` + domain + ' -> ');
        $('.req_new_cname_domain').text(domain + ' -> ');
        $('#enable_ssl_box').show();

        //如果有设定启用 SSL，显示对应的提示
        if (enable_ssl == 'yes') {
            $('#direct_ssl_notice').show();
            $('#domainHelp').show();
        } else {
            $('#direct_ssl_notice').hide();
            $('#domainHelp').hide();
        }

        // 通过正则检查输入的域名是否符合规范
        if (!reg.test(domain)) {
            $('#domainHelp').hide();
            $('#domainHelpError').show();
            return false;
        }

        //没有问题，显示提示
        $('#domainHelpError').hide();
        $('#domainHelpCNAME').show();
    }

    loading_box_on() {
        $('#loading_box').show();
    }

    loading_box_off() {
        $('#loading_box').fadeOut();
    }

}
