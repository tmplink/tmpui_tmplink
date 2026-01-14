class tmplink {

    // api_url = 'https://tmp-api.vx-cdn.com/api_v2'
    api_url = 'https://tmplink-sec.vxtrans.com/api_v2'
    api_url_sec = 'https://tmplink-sec.vxtrans.com/api_v2'
    api_url_upload = null
    api_file = null
    api_pay = null
    api_user = null
    api_direct = null
    api_media = null
    api_mr = null
    api_notes = null
    api_toks = null
    api_tokx = null
    api_token = null
    current_file_details = null // 当前文件详情
    current_file_download_url = null // 当前文件下载链接
    current_file_curl_command = null // 当前文件 curl 命令
    current_file_wget_command = null // 当前文件 wget 命令
    site_domain = null
    isSponsor = false

    pageReady = false
    readyFunction = []
    bgLoaded = false

    logined = 0
    user_group = {}
    area_cn = false
    uid = 0
    email = null
    api_language = null
    currentLanguage = 'cn'
    mr_data = []
    room = []
    room_data = []
    list_data = []
    dir_tree = {}
    subroom_data = []
    download_index = 0
    get_details_do = false
    countDownID = [];

    storage = 0
    storage_used = 0
    high_speed_channel = false

    page_number = 1
    sort_by = 0
    sort_type = 0
    Selecter = null
    upload_model_selected_val = 0
    recaptcha_op = false  // reCAPTCHA temporarily disabled
    recaptcha = '6LfqxcsUAAAAABAABxf4sIs8CnHLWZO4XDvRJyN5'
    recaptchaToken = '0'

    //下面这段代码不适用
    recaptcha_actions = [
        "download_req", "stream_req",
    ]

    bulkCopyStatus = false
    bulkCopyTmp = ''
    bulkCopyTimer = 0
    clipboardInstance = null
    mybg_light = 0
    mybg_dark = 0
    mybg_light_key = 0
    mybg_dark_key = 0
    system_background = {
        'light': ['/img/bg/new-bg-light.svg'],
        'dark': ['/img/bg/new-bg-dark.svg']
    }

    //GA title
    ga_title = 'Init'
    ga_keeper = null
    ga_processing = false

    constructor() {
        this.init_api();
        this.setArea();
        this.setDomain();
        // this.api_init();
        this.bg_init();
        this.setThemeColor();

        //初始化管理器
        this.Selecter = new BoxSelecter;
        this.media = new media;
        this.navbar = new navbar;
        this.uploader = new uploader;
        this.giftcard = new giftcard;
        this.direct = new direct;
        this.stream = new stream;
        this.profile = new profile;
        this.buy = new buy;
        this.notes = new notes;
        this.oauth = new oauth;
        this.dir = new dir;
        this.chart = new chart;
        this.download = new download;
        this.notification = new notification;
        this.file = new file;
        this.ai = new ai;

        this.stream.init(this);
        this.giftcard.init(this);
        this.Selecter.init(this);
        this.media.init(this);
        this.direct.init(this);
        this.uploader.init(this);
        this.profile.init(this);
        this.buy.init(this);
        this.notes.init(this);
        this.oauth.init(this);
        this.dir.init(this);
        this.chart.init(this);
        this.download.init(this);
        this.notification.init(this);
        this.file.init(this);
        this.ai.init(this);

        //
        $('.workspace-navbar').hide();
        $('.workspace-nologin').hide();

        //初始化 return_page
        let return_page = localStorage.getItem('return_page');
        if (return_page === null) {
            localStorage.setItem('return_page', '0');
        }

        // this.navbar.init(this); //此函数需要等待语言包加载完毕才可执行

        this.upload_model_selected_val = localStorage.getItem('app_upload_model') === null ? 0 : localStorage.getItem('app_upload_model');

        // ---- VXUI / legacy i18n compatibility ----
        // VXUI 代码中存在对 TL.lang / TL.tpl / TL.tpl_lang 的依赖（旧版兼容接口）。
        // 旧版实际语言数据来源于 app.languageData（tmpUI 语言包）。
        try {
            if (!Object.getOwnPropertyDescriptor(this, 'lang')) {
                Object.defineProperty(this, 'lang', {
                    configurable: true,
                    enumerable: true,
                    get: () => this.currentLanguage,
                    set: (v) => {
                        if (typeof v === 'string' && v && v !== this.currentLanguage) {
                            this.language(v);
                        }
                    }
                });
            }
            if (!Object.getOwnPropertyDescriptor(this, 'tpl')) {
                Object.defineProperty(this, 'tpl', {
                    configurable: true,
                    enumerable: true,
                    get: () => (typeof app !== 'undefined' ? app.languageData : null)
                });
            }
        } catch (e) {
            // ignore (older browsers / sealed objects)
        }

        // 在开始网络请求前显示加载图标
        this.loading_box_on();

        let token = localStorage.getItem('app_token');
        $.post(this.api_tokx, {
            action: 'token_check',
            token: token
        }, (rsp) => {

            if (rsp.status == 3) {
                let html = app.tpl('initFail', {});
                $('#tmpui_body').html(html);
                app.languageBuild();
                return false;
            }

            if (rsp.status != 1) {
                this.recaptcha_do('token', (captcha) => {
                    $.post(this.api_tokx, {
                        action: 'token',
                        captcha: captcha,
                        token: token
                    }, (rsp) => {
                        this.api_token = rsp.data;
                        localStorage.setItem('app_token', rsp.data);
                        this.details_init();
                    });
                });
            } else {
                this.api_token = token;
                this.details_init();
            }
        });

        $(document).on({
            dragleave: function (e) {
                e.preventDefault();
            },
            drop: function (e) {
                e.preventDefault();
            },
            dragenter: function (e) {
                e.preventDefault();
            },
            dragover: function (e) {
                e.preventDefault();
            }
        });
    }

    init_api(){
        let hostname = window.location.hostname;
        if (hostname === 'www.ttttt.link' || hostname === '127.0.0.1') {
            this.api_url = 'https://connect.cntmp.link/api_v2'
        }
        
        // 更新所有依赖的 API 地址
        this.api_url_upload = this.api_url + '/file'
        this.api_file = this.api_url + '/file'
        this.api_pay = this.api_url + '/pay'
        this.api_user = this.api_url + '/user'
        this.api_direct = this.api_url + '/direct'
        this.api_media = this.api_url + '/media'
        this.api_mr = this.api_url + '/meetingroom'
        this.api_notes = this.api_url + '/notes'
        this.api_toks = this.api_url_sec + '/token'
        this.api_tokx = this.api_url + '/token'
    }

    matchNightModel() {
        let media = window.matchMedia('(prefers-color-scheme: dark)');
        return media.matches;
    }

    matchNightModelListener(cb) {
        let media = window.matchMedia('(prefers-color-scheme: dark)');
        let callback = (e) => {
            let prefersDarkMode = e.matches;
            this.setThemeColor();
            cb(prefersDarkMode);
        };
        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', callback);
        }
    }

    // 如果是夜间模式，修改主题色为黑色
    setThemeColor() {
        if (this.matchNightModel()) {
            $('meta[name="theme-color"]').attr('content', '#000');
        } else {
            $('meta[name="theme-color"]').attr('content', '#fff');
        }
    }

    ga(title) {
        if (this.api_token == null) {
            setTimeout(() => {
                this.ga(title);
            }, 3000);
            return false;
        }
        this.ga_processing = true;
        this.ga_title = title;
        $.post(this.api_user, {
            action: 'event_ui',
            token: this.api_token,
            title: title,
            path: location.pathname + location.search,
        }, (rsp) => {
            this.ga_processing = false;
        });
    }

    keep_alive() {
        if(this.ga_keeper === null) {
            this.ga_keeper = setInterval(() => {
                if (this.ga_processing === false) {
                    this.ga(this.ga_title);
                }
            }, 60000);
        }
    }

    setDomain() {
        //获取当前域名
        this.site_domain = window.location.hostname == 'www.ttttt.link' ? 'ttttt.link' : 'tmp.link';
        if (this.site_domain === 'tmp.link') {
            $('.logo').attr('src', '/img/logo/2.png');
            $('#head_logo').html('tmp.link');
        } else {
            $('.logo').attr('src', '/img/logo/logo2.svg');
            $('#head_logo').html('ttttt.link');
        }
    }

    setBtnForSponsor() {
        $('.btn-upload').removeClass('btn-primary');
        $('.btn-upload').addClass('btn-red');
        $('.not-vip').hide();
    }

    setArea(cb) {
        $.post(this.api_tokx, {
            action: 'set_area',
        }, (rsp) => {
            if (rsp.data === 1) {
                this.area_cn = true;
                //当为中国大陆地区时，检查主域名是否为www.ttttt.link，如果不是则跳转到ttttt.link
                if (window.location.hostname !== 'www.ttttt.link' && window.location.hostname !== '127.0.0.1') {
                    //如果有参数
                    let params = '';
                    if (window.location.search !== '') {
                        params = window.location.search;
                    }
                    window.location.href = 'https://www.ttttt.link' + params;
                }
                // $('.btn_play').hide();
            } else {
                this.area_cn = false;
            }
            if (cb !== undefined && typeof cb === 'function') {
                cb();
            }
        });
    }

    ready(cb) {
        if (this.pageReady) {
            cb();
        } else {
            this.readyFunction.push(cb);
        }
        this.notification.loadConfirmations();
        this.notification.showUnconfirmed();
    }

    readyExec() {
        this.pageReady = true;
        if (this.readyFunction.length !== 0) {
            for (let x in this.readyFunction) {
                this.readyFunction[x]();
            }
            this.readyFunction = [];
        }
    }

    bg_init() {
        //如果是移动设备，不执行背景载入
        if (isMobileScreen()) {
            return false;
        }
        if (document.querySelector('#background_wrap') == null) {
            $('body').append('<div id="background_wrap" style="z-index: -2;position: fixed;top: 0;left: 0;height: 100%;width: 100%;"></div>');
            $('body').append(`<div id="background_wrap_img" style="z-index: -1;position: fixed;top: 0;left: 0;height: 100%;display:none;width: 100%;"></div>`);
        }
    }

    bg_remove() {
        $('#background_wrap').remove();
        $('#background_wrap_img').remove();
    }

    bg_load() {
        if (this.bgLoaded === false) {
            let night = this.matchNightModel();
            this.bgLoadImg1(night);
            this.matchNightModelListener((night) => {
                this.bgLoadImg1(night);
            });
        }
        this.bgLoaded = true;
    }

    bgLoadImg1(night) {

        let imgSource = this.system_background;
        //随机选择一张图片
        let img_light = imgSource['light'][Math.floor(Math.random() * imgSource['light'].length)];
        let img_dark = imgSource['dark'][Math.floor(Math.random() * imgSource['dark'].length)];
        let imgSrc = '';
        let imgSrcLight = '';
        let imgSrcDark = '';

        if (night) {
            $('#background_wrap').css('background-color', '#6a6868');
        } else {
            $('#background_wrap').css('background-color', '#ffffff');
        }

        if (this.mybg_dark !== 0) {
            imgSrcDark = this.mybg_dark;
            $('.pf_bg_dark_set').show();
        } else {
            imgSrcDark = img_dark;
            $('.pf_bg_dark_set').hide();
        }

        if (this.mybg_light !== 0) {
            imgSrcLight = this.mybg_light;
            $('.pf_bg_light_set').show();
        } else {
            imgSrcLight = img_light;
            $('.pf_bg_light_set').hide();
        }

        if (night) {
            imgSrc = imgSrcDark;
        } else {
            imgSrc = imgSrcLight;
        }

        $('.pf_bg_light').attr('src', imgSrcLight);
        $('.pf_bg_dark').attr('src', imgSrcDark);

        $('.pf_bg_dark').attr('src', this.system_background.dark[0]);
        $('#background_wrap_img').removeClass('anime-fadein');
        $('#background_wrap_img').css('display', 'none');
        $.get(imgSrc, () => {
            $('#background_wrap_img').css('background', `url("${imgSrc}") no-repeat center`);
            $('#background_wrap_img').css('background-size', 'cover');
            $('#background_wrap_img').addClass('anime-fadein');
            $('#background_wrap_img').css('display', '');
        });
    }

    bgLoadCSS(night) {
        // $('#background_wrap_img').hide();
        $('#background_wrap_img').css('background-size', 'cover');
        $('#background_wrap_img').css('background-image', `url("/img/bg/cool-background.svg")`);
        // if (night) {
        //     $('#background_wrap_img').css('background',``);
        // } else {
        //     $('#background_wrap_img').css('background',``);
        // }
        $('#background_wrap_img').show();
    }

    bgLoadVideo(night) {
        let videoSrc = '';
        if (night) {
            videoSrc = '/video/bg_night.mp4';
        } else {
            videoSrc = '/video/bg.mp4';
        }

        //如果在首页，载入视频
        let url = get_url_params('tmpui_page');
        let page = url.tmpui_page;
        if (page === '/' || page === undefined || isMobileScreen() === false) {
            let video = `<video muted id="bg_Video" style="height:auto;width:auto;min-height:100%;min-width:100%"><source src="${videoSrc}" type="video/mp4"></video>`;
            $('body').append(`<div id="background_wrap_video" style="z-index: -1;position: fixed;top: 0;left: 0;height: 100%;display:none;width: 100%;">${video}</div>`);
            $('#background_wrap').hide();
            let v = document.getElementById('bg_Video');
            v.addEventListener('canplay', () => {
                $('#background_wrap_video').fadeIn();
                v.play();
            });
        } else {
            $('#background_wrap_video').remove();
            $('#background_wrap').show();
        }
    }

    bgVideoChange(night) {
        let videoSrc = '';
        if (night) {
            videoSrc = '/video/bg_night.mp4';
        } else {
            videoSrc = '/video/bg.mp4';
        }

        //如果在首页，载入视频
        let url = get_url_params('tmpui_page');
        let page = url.tmpui_page;
        if (page === '/' || page === undefined || isMobileScreen() === false) {
            $('#background_wrap_video').fadeOut();
            $('#bg_Video').attr('src', videoSrc);
            let v = document.getElementById('bg_Video');
            v.addEventListener('canplay', () => {
                $('#background_wrap_video').fadeIn();
                v.play();
            });
        } else {
            $('#background_wrap_video').remove();
            $('#background_wrap').show();
        }
    }

    lazyload(dom) {
        $(dom).each((i, e) => {
            let img = new Image();
            let url = $(e).attr('data-src');
            if (url !== undefined) {
                img.src = url;
                img.onload = () => {
                    $(e).attr('src', img.src);
                }
            }
        });
    }

    details_init() {
        var login = localStorage.getItem('app_login');
        if (login != null && login != 0) {
            this.logined = 1;
        } else {
            this.logined = 0;
        }
        this.get_details(() => {
            this.get_details_do = true;
            this.storage_status_update();
            this.head_set();

            // VXUI 页面不需要应用背景（壁纸背景/背景图层）
            const page = (typeof get_url_params === 'function' ? (get_url_params('tmpui_page') || {}).tmpui_page : undefined);
            if (page === '/vx') {
                this.bg_remove();
            } else {
                this.bg_load();
            }
            //初始化直链
            this.direct.init_details(() => {
                this.readyExec();
            });
            //初始化用户个性化信息
            this.profile.init_details();
            //初始化账号互联状态
            this.oauth.init_details();
            //初始换回话保持
            this.keep_alive();
        });
    }

    head_set_refresh() {
        if (this.get_details_do) {
            this.head_set();
        }
    }

    isLogin() {
        if (localStorage.getItem('app_login') == 1) {
            return true;
        } else {
            return false;
        }
    }

    get_file(code) {
        if (code.length !== 13) {
            this.alert(app.languageData.status_error_15);
            return false;
        }
        window.location.href = 'https://' + this.site_domain + '/f/' + code;
    }

    loading_box_on() {
        $('#loading_box').show();
    }

    loading_box_off() {
        $('#loading_box').fadeOut();
    }

    recaptcha_do(type, cb) {
        if (this.recaptcha_op && this.recaptchaCheckAction(type)) {
            grecaptcha.ready(() => {
                grecaptcha.execute(this.recaptcha, {
                    action: type
                }).then((token) => {
                    cb(token);
                });
            });
        } else {
            // cb(true);
            $.post(this.api_tokx, {
                action: 'challenge',
            }, (rsp) => {
                cb(rsp.data);
            });
        }
    }

    async recaptcha_do_async(type) {
        return new Promise((resolve, reject) => {
            if (this.recaptcha_op && this.recaptchaCheckAction(type)) {
                // Google reCAPTCHA 路径
                grecaptcha.ready(async () => {
                    try {
                        const token = await grecaptcha.execute(this.recaptcha, {
                            action: type
                        });
                        resolve(token);
                    } catch (error) {
                        reject(error);
                    }
                });
            } else {
                // 后备方案路径
                $.post(this.api_tokx, {
                    action: 'challenge',
                })
                    .then(rsp => resolve(rsp.data))
                    .fail(error => reject(error));
            }
        });
    }

    recaptchaCheckAction(action) {
        for (let i in this.recaptcha_actions) {
            if (this.recaptcha_actions[i] == action) {
                return true;
            }
        }
        return false
    }

    sort_show() {
        // $("#sort_by option[value='" + this.sort_by + "']").attr("selected", "selected");
        // $("#sort_type option[value='" + this.sort_type + "']").attr("selected", "selected");
        $('#sortModal').modal('show');
    }

    sort_confirm() {
        this.sort_by = $('#sort_by').val();
        this.sort_type = $('#sort_type').val();

        let key = getSortKeys();
        localStorage.setItem(key.display, this.display);
        localStorage.setItem(key.sort_by, this.sort_by);
        localStorage.setItem(key.sort_type, this.sort_type);

        //统一使用 dir 模块刷新文件列表
        this.dir.filelist(0);
        $('#sortModal').modal('hide');
    }

    head_set() {
        var login = localStorage.getItem('app_login');
        if (login != null && login != 0) {
            this.logined = 1;
            $('.workspace-navbar').show();
            $('.workspace-nologin').hide();
            $('#index_manager').fadeIn();
        } else {
            $('.workspace-navbar').hide();
            $('.workspace-nologin').show();
            $('#index_prepare').fadeIn();
        }

        $('#index_lang').fadeIn();
        $('.navbar_ready').show();

        if (this.sponsor) {
            $('.show_for_sponsor').show();
        } else {
            $('.show_for_sponsor').hide();
            $('.to_be_sponsor').show();
        }

        //如果语言不是中文，隐藏中文按钮
        if (app.languageSetting !== 'cn') {
            $('.lang-not-cn').hide();
        }

        //如果是赞助者，激活特定按钮的颜色
        if (this.sponsor) {
            this.isSponsor = true;
            this.setBtnForSponsor();
        }

        //更新上传器的设定
        this.uploader.init_upload_pf();

        //set process bar to 100%
        // setTimeout(() => {
        //     $('#index_userinfo_loading').fadeOut();
        // },1000);
        if (this.isMacOS() && !this.isMenubarX()) {
            $('.showOpenInMenubarX').show();
        }
    }

    open_manager() {
        $('#index_prepare').fadeOut();
        $('#index_manager').fadeIn();
    }

    get_details(cb) {
        //获取当前
        let url = get_url_params('tmpui_page');
        let page = url.tmpui_page;

        $.post(this.api_user, {
            action: 'get_detail',
            token: this.api_token
        }, (rsp) => {

            if (rsp.status === 1) {
                localStorage.setItem('app_login', 1);
                this.logined = 1;
                this.uid = rsp.data.uid;
                this.storage_used = rsp.data.storage_used;
                this.storage = rsp.data.storage;
                this.private_storage_used = rsp.data.private_storage_used;
                this.high_speed_channel = rsp.data.highspeed;
                this.sponsor = rsp.data.sponsor;
                this.sponsor_time = rsp.data.sponsor_time;
                this.user_acv = rsp.data.acv;
                this.user_group = rsp.data.group;

                this.user_join = rsp.data.join;
                this.user_total_files = rsp.data.total_files;
                this.user_total_filesize = bytetoconver(rsp.data.total_filesize, true);
                this.user_total_upload = bytetoconver(rsp.data.total_upload, true);
                this.user_acv_dq = bytetoconver(rsp.data.acv_dq * 1024 * 1024, true);
                this.user_acv_storage = bytetoconver(this.user_acv * 16 * 1024 * 1024, true);


                localStorage.setItem('app_lang', rsp.data.lang);

                this.mybg_light = rsp.data.pf_mybg_light;
                this.mybg_dark = rsp.data.pf_mybg_dark;
                this.mybg_light_key = rsp.data.pf_mybg_light_key;
                this.mybg_dark_key = rsp.data.pf_mybg_dark_key;

                app.languageSet(rsp.data.lang);
                //文件下载页，不执行这个操作
                if (page != '/file') {
                    this.profile_confirm_delete_set(rsp.data.pf_confirm_delete);
                    this.profile_bulk_copy_set(rsp.data.pf_bulk_copy);
                    this.dir.treeGet();
                    //更新到 myModal
                    $('.user_rank').html(this.uid);
                    $('.user_storage').html(bytetoconver(this.storage_used) + '/' + bytetoconver(this.storage));
                    $('.user_acv').html(this.user_acv);
                    $('.user_acv_dq').html(this.user_acv_dq);
                    $('.user_acv_storage').html(this.user_acv_storage);
                    $('.user_join').html(this.user_join);
                    $('.user_total_files').html(this.user_total_files);
                    $('.user_total_filesize').html(this.user_total_filesize);
                    $('.user_total_upload').html(this.user_total_upload);
                    if (this.sponsor) {
                        $('.user_sponsor_time').html(this.sponsor_time);
                    }
                }

                // 检查初次赞助特典
                this.buy.checkFirstTimeSponsor();

                // 为shopModal添加show事件监听器
                $('#shopModal').on('show.bs.modal', () => {
                    this.buy.onShopModalShow();
                });

            } else {
                $('.user-unlogin').show();
                localStorage.setItem('app_login', 0);
                this.logined = 0;
            }
            cb();
        });
    }

    myBgPfReset() {
        this.loading_box_on();
        $.post(this.api_user, {
            action: 'pf_mybg_reset',
            token: this.api_token
        }, (rsp) => {
            if (rsp.status === 1) {
                this.mybg_light = 0;
                this.mybg_dark = 0;
                this.mybg_light_key = 0;
                this.mybg_dark_key = 0;
                this.bgLoadImg1();
            } else {
                alert(app.languageData.status_error_0);
            }
            this.loading_box_off();
        });
    }

    password_reset_confim() {
        var password = $('#modal_password_reset').val();
        var rpassword = $('#modal_password_reset_re').val();
        if (password !== rpassword) {
            $("#notice_resetpassword").html(app.languageData.model_resetpassword_error_no_match);
            return false;
        }
        $("#notice_resetpassword").html(app.languageData.model_resetpassword_msg_processing);
        $("#modal_password_reset_btn").attr('disabled', true);
        $.post(this.api_user, {
            action: 'passwordreset',
            password: password,
            rpassword: rpassword,
            token: this.api_token
        }, (rsp) => {
            if (rsp.status === 1) {
                $("#notice_resetpassword").html(app.languageData.model_resetpassword_msg_processed);
                $("#modal_password_reset_btn").html(app.languageData.model_resetpassword_msg_processed);
            } else {
                $("#notice_resetpassword").html(app.languageData.model_resetpassword_error_fail);
                $("#modal_password_reset_btn").removeAttr('disabled');
            }
        });
    }

    email_change_confim() {
        var email = $('#email_new').val();
        var code = $('#checkcode').val();
        $("#notice_emailchange").html(app.languageData.model_email_change_msg_processing);
        $("#email_change_confim_btn").attr('disabled', true);
        $.post(this.api_user, {
            action: 'email_change',
            email: email,
            code: code,
            token: this.api_token
        }, (rsp) => {
            if (rsp.status === 1) {
                $("#notice_emailchange").html(app.languageData.model_email_change_msg_processed);
                $("#email_change_confim_btn").html(app.languageData.model_email_change_msg_processed);
            } else {
                $("#notice_emailchange").html(rsp.data);
                $("#email_change_confim_btn").removeAttr('disabled');
            }
        });
    }

    /**
     * Open photo album for current folder
     */
    openPhotoAlbum() {
        let mrid = this.dir.room.mr_id || 0;
        app.open('/app&listview=photo&mrid=' + mrid);
    }

    previewModel(ukey, name, id, sid, sha1, ftype) {
        if (!sid || !sha1) {
            this.alert('图片信息缺失（sid/sha1），无法预览');
            return false;
        }

        const ext = (ftype ? String(ftype) : 'jpg').toLowerCase();
        const url = `https://img-${sid}.5t-cdn.com:998/thumb/0x0/${sha1}.${ext}`;

        $('#preview_img_loader').show();
        $('#preview_img').hide();

        const img = new Image();
        img.onload = () => {
            $('#preview_img_loader').hide();
            $('#preview_img').attr('src', url);
            $('#preview_img').show();
        };
        img.onerror = () => {
            $('#preview_img_loader').hide();
        };
        img.src = url;
        let lastukey = $('#btn_preview_download').attr('data-ukey');
        $('#preview_title').html(name);
        $('#btn_preview_download').removeClass('btn_download_' + lastukey);
        $('#preview_download_1').removeClass('download_progress_bar_' + lastukey);
        $('#preview_download_2').removeClass('download_progress_bar_set_' + lastukey);
        $('#btn_preview_download').addClass('btn_download_' + ukey);
        $('#preview_download_1').addClass('download_progress_bar_' + ukey);
        $('#preview_download_2').addClass('download_progress_bar_set_' + ukey);
        $('#btn_preview_download').attr('data-ukey', ukey);

        $('#btn_preview_download').removeAttr('disabled');
        $('#btn_preview_download').html(app.languageData.on_select_download);
        $('#btn_preview_download').attr('onclick', 'TL.download_direct(\'' + ukey + '\')');
        $('#btn_preview_remove').attr('onclick', "TL.workspace_del('" + ukey + "')");
        $('#previewModal').modal('show');
    }

    password_found() {
        this.recaptcha_do('passwordfound', (captcha) => {
            var email = $('#email_new').val();
            if (email === '') {
                return false;
            }
            $('#submit').attr('disabled', true);
            $('#msg_notice').show();
            $('#msg_notice').html(app.languageData.form_btn_processing);
            $.post(this.api_user, {
                action: 'passwordfound',
                token: this.api_token,
                email: email,
                captcha: captcha
            }, (rsp) => {
                if (rsp.status == 1) {
                    $('#msg_notice').fadeOut();
                    $('#submit').html(app.languageData.form_btn_processed);
                } else {
                    switch (rsp.status) {
                        case 13:
                            $('#msg_notice').html(app.languageData.status_13);
                            break;
                        case 14:
                            $('#msg_notice').html(app.languageData.status_14);
                            break;
                        default:
                            $('#msg_notice').html(app.languageData.status_unknow);
                    }
                    $('#submit').removeAttr('disabled');
                }
            }, 'json');
        });
    }

    workspace_navbar() {
        if (localStorage.getItem('app_login') == 1) {
            $('.workspace-navbar').show();
        }
    }

    workspace_add(id, ukey, animated) {
        $(id).attr('disabled', true);
        $.post(this.api_file, {
            action: 'add_to_workspace',
            token: this.api_token,
            ukey: ukey
        }, (rsp) => {
            if (animated === false) {
                return false;
            }
        }, 'json');
    }

    workspace_del(ukey, group_delete) {
        //如果是批量删除
        if (group_delete === true) {
            for (let i in ukey) {
                $('.file_unit_' + ukey[i]).hide();
            }
        } else {
            if (this.profile_confirm_delete_get()) {
                if (!confirm(app.languageData.confirm_delete)) {
                    return false;
                }
            }
            $('.file_unit_' + ukey).hide();
        }
        $.post(this.api_file, {
            action: 'remove_from_workspace',
            token: this.api_token,
            ukey: ukey
        }, 'json');
    }

    is_file_ok(ukey) {
        setTimeout(() => {
            $.post(this.api_file, {
                action: 'is_file_ok',
                token: this.api_token,
                ukey: ukey
            }, (rsp) => {
                if (rsp.status == 1) {
                    $(`.file_ok_${ukey}`).removeAttr('style');
                    $(`.file_relay_${ukey}`).attr('style', 'display: none !important;');
                } else {
                    this.is_file_ok(ukey);
                }
            }, 'json');
        }, 5000);
    }

    is_file_ok_check(data) {
        //prepare file is ok
        for (let i in data) {
            if (data[i].sync === 0) {
                $(`.file_relay_${data[i].ukey}`).attr('style', 'display: none !important;');
            } else {
                $(`.file_ok_${data[i].ukey}`).attr('style', 'display: none !important;');
                this.is_file_ok(data[i].ukey);
            }
        }
    }

    file_model_change(ukey, model) {
        this.loading_box_on();
        $.post(this.api_file, {
            action: 'change_model',
            ukey: ukey,
            //captcha: recaptcha,
            token: this.api_token,
            model: model
        }, (rsp) => {
            if (rsp.status === 1) {

                return true;
            }
            this.loading_box_off();
        }, 'json');
    }

    ui_hs_change(status) {
        let st = $('.hs-model-title').html();
        switch (status) {
            case 'ready':
                if (st !== app.languageData.hs_ready) {
                    $('.hs-model').fadeOut(() => {
                        $('.hs-model-title').html(app.languageData.hs_ready);
                        $('.hs-model').fadeIn();
                        $('.hs-model').addClass('text-blue');
                    });
                }
                break;
            case 'enhanced':
                if (st !== app.languageData.hs_enhanced) {
                    $('.hs-model').fadeOut(() => {
                        if (st === app.languageData.hs_ready) {
                            $('.hs-model').removeClass('text-blue');
                        }
                        $('.hs-model-title').html(app.languageData.hs_enhanced);
                        $('.hs-model').fadeIn();
                        $('.hs-model').addClass('text-green');
                    });
                }
                break;
        }
    }

    file_details() {
        // Ensure the home logo is available on the file download page (especially on mobile)
        // so users can always navigate back to the homepage.
        $('#top_loggo').attr('src', '/img/ico/logo-new.svg').show();

        // Mobile loading state: hide download actions until details are ready.
        $('#file_loading_box').show();
        $('#file_box').hide();
        $('.mobile-footer').hide();

        if (this.isWeixin()) {
            $('#file_messenger_icon').html('<iconpark-icon name="cloud-arrow-down" class="fa-fw fa-4x"></iconpark-icon>');
            $('#file_messenger_msg').removeClass('display-4');
            $('#file_messenger > div').removeClass('shadow').removeClass('card');
            $('#file_messenger_msg').html('请复制链接后，在外部浏览器打开进行下载。');
            $('#file_messenger').show();
            $('#file_loading_box').hide();
            $('.mobile-footer').hide();
            this.ga('weixinUnavailable');
            return false;
            $('#wechat_notice').show();
        }

        // this.loading_box_on();

        // opacityShow('#download_msg');
        var params = get_url_params();
        var fileinfo = null;
        if (params.ukey !== undefined) {
            $.post(this.api_file, {
                action: 'details',
                ukey: params.ukey,
                token: this.api_token
            }, (rsp) => {

                // 更新 Logo（冗余保护：部分流程下可能先于 DOM 渲染）
                $('#top_loggo').attr('src', '/img/ico/logo-new.svg').show();

                // Response arrived: stop showing the loading placeholder.
                $('#file_loading_box').hide();

                if (rsp.status === 1) {
                    //隐藏信息提示窗口
                    $('#file_messenger').hide();
                    //
                    this.ga('D-' + rsp.data.name);
                    fileinfo = rsp.data;
                    // 保存文件详情信息便于其他组件使用
                    this.current_file_details = rsp.data;
                    $('#file_box').show();
                    $('.mobile-footer').show();
                    $('#filename').html(rsp.data.name);
                    $('#filesize').html(rsp.data.size);

                    // Mobile workspace button is handled by mobile-file.js with onclick attribute

                    //如果设置了个性化图标
                    if (rsp.data.ui_publish === 'yes' && rsp.data.ui_publish_status === 'ok' && rsp.data.ui_pro === 'yes') {
                        $('.userinfo_avatar').show();
                        // Only hide the logo if a dedicated header avatar slot exists.
                        // The mobile download template doesn't provide one, so keep the logo
                        // to allow users to return to the homepage.
                        if ($('.userinfo_avatar_img').length > 0) {
                            $('#top_loggo').hide();
                        }
                        let avatarURL = `https://tmp-static.vx-cdn.com/static/avatar?id=${rsp.data.ui_avatar_id}`;
                        let img = new Image();
                        img.src = avatarURL;
                        img.onload = () => {
                            $('.userinfo_avatar_img').attr('src', avatarURL);
                            // 确保卡片中的用户头像也一致
                            $('.userinfo_avatar_card_img').attr('src', avatarURL);
                        }
                    }
                    
                    // 如果API返回了用户介绍信息，保存它
                    if (rsp.data.ui_intro) {
                        this.current_file_details.ui_intro = rsp.data.ui_intro;
                    }

                    //如果包含了 NSFW 内容
                    if (rsp.data.nsfw === true) {
                        $('#nsfw_alert').show();
                    }

                    //设定分享者信息
                    if (rsp.data.ui_publish === 'yes' && rsp.data.ui_publish_status === 'ok') {
                        if (rsp.data.ui_pro === 'yes') {
                            $('.userinfo_pro').show();
                        } else {
                            $('.userinfo_sd').show();
                        }
                        $('.userinfo').show();
                        $('.userinfo_nickname').html(rsp.data.ui_nickname);
                    }

                    //更换图标
                    let icon = this.fileicon(rsp.data.type);
                    $('#file-icon').attr('name', icon);

                    //更新title
                    document.title = rsp.data.name;
                    let filename = rsp.data.name;

                    //更新喜欢
                    $('#likes').on('click', () => {
                        this.like_file(params.ukey);
                    });
                    $('#likes_count').html(rsp.data.like);

                    //如果这个文件很火
                    if (rsp.data.hot == 1) {
                        $('.hot-flag').show();
                    }

                    //剩余时间
                    if (rsp.data.model !== '99') {
                        $('#lefttime_show').show();
                        countDown('lefttime', rsp.data.lefttime_s, this.currentLanguage);
                    } else {
                        $('#lefttime_show').hide();
                    }
                    $('#report_ukey').html(params.ukey);
                    this.btn_copy_bind();

                    if (this.logined) {
                        $('.user-nologin').hide();
                        $('.user-login').show();
                    } else {
                        $('.user-nologin').show();
                        $('.user-login').hide();
                    }

                    // $('#download_msg').html('<iconpark-icon name="loader" class="fa-fw fa-spin"></iconpark-icon> ');

                    //修改按钮状态
                    this.ui_hs_change('ready');
                    $('#file_download_btn').addClass('btn-success');
                    $('#file_download_btn').html(app.languageData.file_btn_download);


                    //分享链接
                    let share_url = 'https://' + this.site_domain + '/f/' + params.ukey;

                    //QR Download
                    new QRCode(document.getElementById("qr_code_url"), share_url);
                    //让 qr_code_url 下的 img 居中
                    $('#qr_code_url img').css('margin', 'auto');
                    $('.btn_copy_fileurl').attr('data-clipboard-text', share_url);
                    $('.file_ukey').attr('data-clipboard-text', params.ukey);

                    //处理复制按钮
                    $('.btn_copy_downloadurl_for_wget').on('click', () => {
                        this.file_page_btn_copy(params.ukey, filename, 'wget');
                    });
                    $('.btn_copy_downloadurl_for_other').on('click', () => {
                        this.file_page_btn_copy(params.ukey, filename, 'other');
                    });
                    $('.btn_copy_downloadurl_for_curl').on('click', () => {
                        this.file_page_btn_copy(params.ukey, filename, 'curl');
                    });


                    //如果是用户本人的文件，隐藏 id="downloadAlert"
                    if (rsp.data.owner != this.uid) {
                        $('#downloadAlert').fadeIn();
                    }

                    //下载按钮绑定事件，触发下载
                    const downloadHandler = () => {
                        if (this.sponsor) {
                            this.ui_hs_change('enhanced');
                        }

                        const uiCallbacks = {
                            updateButtonText: (text) => {
                                const $fastBtn = $('#file_download_btn_fast');
                                // IMPORTANT: do NOT overwrite the whole button HTML,
                                // otherwise progress DOM (#progress_thread_1/#download_progress_container) is destroyed.
                                const $labelTarget = $fastBtn.find('.download-btn-label');
                                const $legacyTextTarget = $fastBtn.find('.download-btn-text');

                                if ($labelTarget.length) {
                                    $labelTarget.html(text);
                                } else if ($legacyTextTarget.length) {
                                    $legacyTextTarget.html(text);
                                }

                                if ((typeof text === 'string') && /<img/i.test(text)) {
                                    $fastBtn.addClass('is-loading');
                                } else {
                                    $fastBtn.removeClass('is-loading');
                                }
                            },
                            updateButtonState: (disabled) => $('#file_download_btn_fast').prop('disabled', !!disabled),
                            updateButtonClass: (removeClass, addClass) => {
                                $('#file_download_btn_fast').removeClass(removeClass).addClass(addClass);
                            },
                            showError: (message) => this.alert(message)
                        };

                        // 如果已经预加载了下载链接，直接使用
                        if (this.current_file_download_url) {
                            this.download.startDirectDownload({
                                url: this.current_file_download_url,
                                filename: fileinfo.name,
                                mode: 'fast'
                            }, uiCallbacks);
                        } else {
                            // 否则走正常流程，通过 API 获取链接
                            this.download.handleFileDownload({
                                ukey: params.ukey,
                                filename: fileinfo.name,
                                mode: 'fast'
                            }, uiCallbacks);
                        }
                    };

                    // Avoid duplicate bindings in SPA-like navigation.
                    $('#file_download_btn_fast').off('click').on('click', downloadHandler);
                    $('#file_download_btn_normal').off('click').on('click', downloadHandler);

                    //扫码下载按钮绑定
                    $('#file_download_by_qrcode').on('click', () => {
                        $('#qrModal').modal('show');
                        return true;
                    });

                    //如果可以，显示播放按钮
                    if (this.stream.allow(rsp.data.name, fileinfo.owner) || this.stream.checkForOpenOnApps(rsp.data.name, fileinfo.owner)) {
                        $('.btn_play').show();
                        if (this.stream.allow(rsp.data.name, fileinfo.owner)) {
                            $('.play_on_browser').attr('onclick', `TL.stream.request('${params.ukey}','web')`);
                            $('.play_on_browser').show();
                        }
                        if (this.stream.checkForOpenOnApps(rsp.data.name, fileinfo.owner)) {
                            $('.play_on_potplayer').attr('onclick', `TL.stream.request('${params.ukey}','potplayer')`);
                            $('.play_on_potplayer').show();
                            $('.play_on_iina').attr('onclick', `TL.stream.request('${params.ukey}','iina')`);
                            $('.play_on_iina').show();
                            $('.play_on_nplayer').attr('onclick', `TL.stream.request('${params.ukey}','nplayer')`);
                            $('.play_on_nplayer').show();
                            $('.play_copy_url').attr('onclick', `TL.stream.request('${params.ukey}','copy')`);
                            $('.play_copy_url').show();
                        }
                        //隐藏一个按钮，使排位保持平衡
                        $('#btn_highdownload').hide();
                    }

                    // 复制链接按钮绑定已移动到HTML的onclick属性，使用copyFileUrl方法

                    //复制提取码按钮绑定
                    $('#file_download_ukey_copy').on('click', () => {
                        // 使用简洁版复制函数，不显示通知横幅，不使用批量复制功能
                        this.simpleCopy($('#file_download_ukey_copy_icon')[0], params.ukey);
                    });

                    //添加到收藏按钮绑定
                    $('#btn_add_to_workspace').on('click', () => {
                        if (this.logined == 1) {
                            //更换图标为完成的标志
                            $('#btn_add_to_workspace_icon iconpark-icon').attr('name', 'circle-check').css('color', '#22c55e');
                            this.workspace_add('#btn_add_to_workspace', params.ukey, false);
                            //移除监听
                            $('#btn_add_to_workspace').off('click');
                        } else {
                            //设定登录后跳转的页面
                            localStorage.setItem('return_page', getCurrentURL());
                            app.open('/app&listview=login');
                        }
                    });

                    //下载提速按钮绑定
                    $('#btn_highdownload').on('click', () => {
                        $('#upupModal').modal('show');
                    });

                    //举报文件按钮绑定
                    $('#btn_report_file').on('click', () => {
                        $('#reportModal').modal('show');
                    });

                    // 预先获取下载链接，这样用户点击复制按钮时可以立即使用
                    this.preloadDownloadUrl(params.ukey, fileinfo.name);

                    $('#file_loading').fadeOut(100);
                    $('#file_op').fadeIn(300);
                    return true;
                }

                //file need to login
                if (rsp.status === 3) {
                    $('#file_messenger_icon').html('<iconpark-icon name="shield-keyhole" class="fa-fw fa-7x"></iconpark-icon>');
                    $('#file_messenger_msg').html(app.languageData.status_need_login);
                    $('#file_messenger_msg_login').show();
                    $('#file_messenger').show();
                    this.ga(`Any-[${params.ukey}]`);
                    //设定登录后跳转的页面
                    localStorage.setItem('return_page', getCurrentURL());
                    return false;
                }

                //file need to sync
                if (rsp.status === 2) {
                    $('#file_messenger_icon').html('<img src="/img/loading.svg" height="80"  />');
                    $('#file_messenger_msg').html(app.languageData.upload_sync_onprogress);
                    $('#file_messenger').show();
                    this.ga(`Sync-[${params.ukey}]`);
                    setTimeout(() => {
                        this.file_details();
                    }, 60000);
                    return false;
                }

                //file unavailable in china
                if (rsp.status === 4) {
                    $('#file_messenger_icon').html('<iconpark-icon name="earth-asia" class="fa-fw fa-7x"></iconpark-icon>');
                    $('#file_messenger_msg').html(app.languageData.status_area);
                    $('#file_messenger').show();
                    $('#file_box').hide();
                    $('.mobile-footer').hide();
                    this.ga(`Area-[${params.ukey}]`);
                    return false;
                }

                //file is private
                if (rsp.status === 5) {
                    $('#file_messenger_icon').html('<iconpark-icon name="lock" class="fa-fw fa-7x"></iconpark-icon>');
                    $('#file_messenger_msg').html(app.languageData.file_private);
                    $('#file_messenger').show();
                    $('#file_box').hide();
                    $('.mobile-footer').hide();
                    this.ga(`Private-[${params.ukey}]`);
                    return false;
                }

                //file unavailable
                $('#file_messenger_icon').html('<iconpark-icon name="folder-xmark" class="fa-fw fa-4x"></iconpark-icon>');
                $('#file_messenger_msg').html(app.languageData.file_unavailable);
                $('#file_messenger').show();
                $('#file_box').hide();
                $('.mobile-footer').hide();
                this.ga(`Unavailable-[${params.ukey}]`);

                // Keep the logo visible on mobile so users can go back home.

            }, 'json');
        } else {
            $('#file_unavailable').show();
        }
        this.loading_box_off();
    }

    // 预先获取下载链接，以便复制功能可以立即使用
    preloadDownloadUrl(ukey, filename) {
        // 如果已经有下载链接，不再重复获取
        if (this.current_file_download_url) {
            return;
        }
        
        // 预先获取下载链接
        this.recaptcha_do('download_req', (recaptcha) => {
            $.post(this.api_file, {
                action: 'download_req',
                captcha: recaptcha,
                token: this.api_token,
                ukey: ukey
            }, (rsp) => {
                if (rsp.status === 1) {
                    // 保存下载链接和命令以便后续使用
                    this.current_file_download_url = rsp.data;
                    this.current_file_curl_command = `curl -Lo "${filename}" ${rsp.data}`;
                    this.current_file_wget_command = `wget -O "${filename}" ${rsp.data}`;
                    console.log("Download URL preloaded successfully");
                }
            });
        });
    }
    
    file_page_btn_copy(ukey, filename, type) {
        //显示载入动画
        $('#file_btn_download_opt').html('<img src="/img/loading-outline.svg" class="fa-fw"/>');

        // 如果已经有预先获取的下载URL，直接使用而不再请求API
        if (this.current_file_download_url) {
            let content = '';
            switch (type) {
                case 'other':
                    content = this.current_file_download_url;
                    break;
                case 'curl':
                    content = this.current_file_curl_command || `curl -Lo "${filename}" ${this.current_file_download_url}`;
                    break;
                case 'wget':
                    content = this.current_file_wget_command || `wget -O "${filename}" ${this.current_file_download_url}`;
                    break;
            }
            
            // 使用简洁版复制函数，不显示通知横幅，不使用批量复制功能
            this.simpleCopy($('#file_btn_download_opt')[0], content);
            
            // 延时恢复原始文本
            setTimeout(() => {
                $('#file_btn_download_opt').html(app.languageData.file_btn_download_opt);
            }, 3000);
            
            return;
        }

        // 没有预先获取的下载URL时，请求API
        this.recaptcha_do('download_req', (recaptcha) => {
            $.post(this.api_file, {
                action: 'download_req',
                captcha: recaptcha,
                token: this.api_token,
                ukey: ukey
            }, (rsp) => {
                if (rsp.status === 1) {
                    // 保存下载链接和命令以便后续使用
                    this.current_file_download_url = rsp.data;
                    this.current_file_curl_command = `curl -Lo "${filename}" ${rsp.data}`;
                    this.current_file_wget_command = `wget -O "${filename}" ${rsp.data}`;
                    
                    let content = '';
                    switch (type) {
                        case 'other':
                            content = rsp.data;
                            break;
                        case 'curl':
                            content = this.current_file_curl_command;
                            break;
                        case 'wget':
                            content = this.current_file_wget_command;
                            break;
                    }
                    
                    // 使用简洁版复制函数，不显示通知横幅，不使用批量复制功能
                    this.simpleCopy($('#file_btn_download_opt')[0], content);
                    
                    // 延时恢复原始文本
                    setTimeout(() => {
                        $('#file_btn_download_opt').html(app.languageData.file_btn_download_opt);
                    }, 3000);
                } else {
                    // 发生未知错误，需要刷新页面
                    this.alert(app.languageData.status_file_2);
                }
            });
        });
    }

    like_file(ukey) {
        $.post(this.api_file, {
            action: 'like',
            ukey: ukey,
            token: this.api_token
        }, (rsp) => {
            let now = parseInt($('#likes_count').html());
            if (rsp.status == 1) {
                $('#likes_count').html(now + 1);
            } else {
                $('#likes_count').html(now - 1);
            }
        });
    }

    isWeixin() {
        var ua = navigator.userAgent.toLowerCase();
        return ua.match(/MicroMessenger/i) == "micromessenger";
    }

    isMenubarX() {
        var ua = navigator.userAgent.toLowerCase();
        return ua.match(/MicroMessenger/i) == "menubarx";
    }

    isMacOS() {
        var ua = navigator.userAgent.toLowerCase();
        return ua.match(/Macintosh/i) == "macintosh";
    }

    openInMenubarXofIndex() {
        this.openInMenubarX('https://' + this.site_domain + '/?s=mx');
    }

    openInMenubarXofFile() {
        let params = get_url_params();
        this.openInMenubarX(`https://${this.site_domain}/f/${params.ukey}`);
    }

    openInMenubarX(link) {
        let openlink = `https://menubarx.app/open/?xurl=${link}&xwidth=375&xheight=677&xbar=0`;
        window.location.href = openlink;
    }

    download_check() {
        // if (this.isWeixin()) {
        //     return false;
        // }
        // if (isMobileScreen()) {
        //     return false;
        // }
    }

    download_file() {
        this.loading_box_on();
        // $('#btn_download').addClass('disabled');
        // $('#btn_download').html(app.languageData.file_btn_download_status0);
        $.post(this.api_file, {
            action: 'download_check',
            token: this.api_token
        }, (rsp) => {
            if (rsp.status == 1) {
                // location.href = $('#btn_download').attr('x-href');
                // $('#btn_download').html(app.languageData.file_btn_download_status2);
                this.download.single_start($('.single_download_progress_bar').attr('data-href'), $('.single_download_progress_bar').attr('data-filename'));
            } else {
                $('#btn_download').html(app.languageData.file_btn_download_status1);
            }
            // setTimeout(() => {
            //     $('#btn_download').removeClass('disabled');
            //     $('#btn_download').html(app.languageData.file_btn_download);
            // }, 3000);
            this.loading_box_off();
        }, 'json');
    }

    download_direct(i) {
        let ukey = this.list_data[i].ukey;
        let title = this.list_data[i].fname;
        let size = this.list_data[i].fsize_formated;
        let type = this.list_data[i].ftype;
        this.ga('DL-' + title);

        this.recaptcha_do('download_req', (recaptcha) => {
            $.post(this.api_file, {
                action: 'download_req',
                ukey: ukey,
                token: this.api_token,
                captcha: recaptcha
            }, (req) => {
                if (req.status == 1) {
                    $.notifi(`${app.languageData.on_select_download} : ${title}`, "success");
                    window.location.href = req.data;
                    return true;
                }
                if (req.status == 3) {
                    this.alert(app.languageData.status_need_login);
                    return false;
                }
                this.alert(app.languageData.status_error_0);
            });
        });
    }

    download_file_url(i, cb) {
        let ukey = this.list_data[i].ukey;
        let title = this.list_data[i].fname;
        this.ga('DL-' + title);

        this.recaptcha_do('download_req', (recaptcha) => {
            $.post(this.api_file, {
                action: 'download_req',
                ukey: ukey,
                token: this.api_token,
                captcha: recaptcha
            }, (req) => {
                if (req.status == 1) {
                    cb(req.data);
                    return true;
                }
                this.alert(app.languageData.status_error_0);
            });
        });
    }

    async cli_uploader_generator() {
        if (this.logined === 0) {
            this.alert(app.languageData.status_need_login);
            return false;
        }

        let path = $('#cli_upload_path').val();
        if (!path) {
            path = '/root/test.zip';
        }

        let model = $('#cli_upload_model').val();
        if (model === undefined || model === null || model === '') {
            model = localStorage.getItem('app_upload_model') || 0;
        }

        let mrid = get_page_mrid();
        let text_mr = '';
        if (mrid !== undefined) {
            text_mr = `-F "mr_id=${mrid}"`;
        }

        const text_path = `-F "file=@${path}"`;
        const text_model = `-F "model=${model}"`;
        const text_token = `-F "token=${this.api_token}"`;
        const command = `curl -k ${text_path} ${text_token} ${text_model} ${text_mr} -X POST "https://tmp-cli.vx-cdn.com/app/upload_cli"`;

        $('#cliuploader').show();
        $('#cliuploader_show').text(command);

        await this.directCopy($('#cli_generate_btn')[0], command, false);
        return true;
    }

    media_buy_modal(type) {
        if (this.logined === 0) {
            this.alert(app.languageData.status_need_login);
            return false;
        }

        //隐藏不同类型币种的价格列表
        $('.media_price_list').hide();
        //显示当前币种的价格列表
        $('#media_price_of_' + type).show();

        $('#mediaModal').modal('show');
    }


    storage_buy_modal(type) {
        if (this.logined === 0) {
            this.alert(app.languageData.status_need_login);
            return false;
        }

        //隐藏不同类型币种的价格列表
        $('.storage_price_list').hide();
        //显示当前币种的价格列表
        $('#storage_price_of_' + type).show();

        $('#storageModal').modal('show');
    }

    buy_select_open(type) {
        if (this.logined === 0) {
            this.alert(app.languageData.status_need_login);
            return false;
        }
        this.buy_type = type;

        $('#shopModal').modal('hide');
        setTimeout(() => {
            $('#buySelectModal').modal('show');
        }, 100);

    }

    bug_select(type) {
        this.buy_currency = type;
        $('#buySelectModal').modal('hide');
        setTimeout(() => {
            if (this.buy_type == 'hs') {
                this.hs_buy_modal(type);
            }
            if (this.buy_type == 'storage') {
                this.storage_buy_modal(type);
            }
            if (this.buy_type == 'media') {
                this.media_buy_modal(type);
            }
            if (this.buy_type == 'direct') {
                this.direct_buy_modal(type);
            }
        }, 100);

    }

    hs_buy_modal(type) {
        if (this.logined === 0) {
            this.alert(app.languageData.status_need_login);
            return false;
        }

        //隐藏不同类型币种的价格列表
        $('.hs_price_list').hide();
        //显示当前币种的价格列表
        $('#hs_price_of_' + type).show();

        $('#highspeedModal').modal('show');
    }

    direct_buy_modal(type) {
        if (this.logined === 0) {
            this.alert(app.languageData.status_need_login);
            return false;
        }

        //隐藏不同类型币种的价格列表
        $('.direct_quota_price_list').hide();
        //显示当前币种的价格列表
        $('#direct_quota_opt_' + type).show();

        $('#directQuotaModal').modal('show');
    }

    hs_download_file(filename) {
        if (this.logined === 0) {
            this.alert(app.languageData.status_need_login);
            return false;
        }
        $('#btn_highdownload').addClass('disabled');
        $('#btn_highdownload').html(app.languageData.file_btn_download_status0);
        $.post(this.api_file, {
            action: 'highspeed_check',
            token: this.api_token
        }, (rsp) => {
            if (rsp.status == 0) {
                $('#highspeedModal').modal('show');
                $('#btn_highdownload').removeClass('disabled');
                $('#btn_highdownload').html(app.languageData.file_btn_highdownload);
            } else {
                $.post(this.api_file, {
                    action: 'download_check',
                    token: this.api_token
                }, (rsp) => {
                    if (rsp.status == 1) {
                        // location.href = $('#btn_download').attr('x-href');
                        // $('#btn_highdownload').html(app.languageData.file_btn_download_status2);
                        this.download.single_start($('.single_download_progress_bar').attr('data-href'), $('.single_download_progress_bar').attr('data-filename'));
                    } else {
                        $('#btn_highdownload').html(app.languageData.file_btn_download_status1);
                    }
                    setTimeout(() => {
                        $('#btn_highdownload').removeClass('disabled');
                        $('#btn_highdownload').html(app.languageData.file_btn_highdownload);
                    }, 3000);
                }, 'json');
            }
        }, 'json');
    }

    direct_quota_buy() {
        if (this.logined === 0) {
            this.alert(this.app.languageData.status_need_login);
            return false;
        }

        let price = 0;
        let time = 1;
        let code = 0;

        if (this.buy_currency == 'cny') {
            code = $('#dq_code_cny').val();
            price = $("#dq_code_cny option:selected").attr('data-price');
        } else {
            code = $('#dq_code_usd').val();
            price = $("#dq_code_usd option:selected").attr('data-price');
        }

        if (this.buy_currency == 'cny') {
            window.location.href = "https://pay.vezii.com/id4/pay_v2?price=" + price + "&token=" + this.api_token + "&prepare_code=" + code + "&prepare_type=direct&prepare_times=" + time;
        } else {
            window.location.href = 'https://s12.tmp.link/payment/paypal/checkout_v2?price=' + price + '&token=' + this.api_token + '&prepare_type=direct&prepare_code=' + code + '&prepare_times=' + time;
        }
    }

    hs_download_buy() {
        if (this.logined === 0) {
            this.alert(this.app.languageData.status_need_login);
            return false;
        }

        let price = 0;
        let time = $('#highspeed_time').val();
        let code = 'HS';

        if (this.buy_currency == 'cny') {
            code = 'HS';
            price = 6 * time;
        } else {
            code = 'HS-us';
            price = 1 * time;
        }

        if (this.buy_currency == 'cny') {
            window.location.href = "https://pay.vezii.com/id4/pay_v2?price=" + price + "&token=" + this.api_token + "&prepare_code=" + code + "&prepare_type=addon&prepare_times=" + time;
        } else {
            window.location.href = 'https://s12.tmp.link/payment/paypal/checkout_v2?price=' + price + '&token=' + this.api_token + '&prepare_type=addon&prepare_code=' + code + '&prepare_times=' + time;
        }
    }

    storage_buy() {
        if (this.logined === 0) {
            this.alert(this.app.languageData.status_need_login);
            return false;
        }
        var price = 0;
        let code = 0;
        if (this.buy_currency == 'cny') {
            code = $('#storage_code_cny').val();
        } else {
            code = $('#storage_code_usd').val();
        }
        let time = $('#storage_time').val();
        switch (code) {
            case '256GB':
                price = 6 * time;
                break;
            case '1TB':
                price = 18 * time;
                break;

            case '256GB-us':
                price = 1 * time;
                break;
            case '1TB-us':
                price = 3 * time;
                break;
        }
        if (this.buy_currency == 'cny') {
            window.location.href = "https://pay.vezii.com/id4/pay_v2?price=" + price + "&token=" + this.api_token + "&prepare_code=" + code + "&prepare_type=addon&prepare_times=" + time;
        } else {
            window.location.href = 'https://s12.tmp.link/payment/paypal/checkout_v2?price=' + price + '&token=' + this.api_token + '&prepare_type=addon&prepare_code=' + code + '&prepare_times=' + time;
        }
    }

    media_buy() {
        if (this.logined === 0) {
            this.alert(this.app.languageData.status_need_login);
            return false;
        }
        var price = 0;
        let code = 0;
        if (this.buy_currency == 'cny') {
            code = $('#media_code_cny').val();
        } else {
            code = $('#media_code_usd').val();
        }
        let time = $('#media_time').val();
        switch (code) {
            case 'MEDIA-V-P':
                price = 6 * time;
                break;
            case 'MEDIA-V-H':
                price = 18 * time;
                break;

            case 'MEDIA-V-P-us':
                price = 1 * time;
                break;
            case 'MEDIA-V-H-us':
                price = 3 * time;
                break;
        }
        if (this.buy_currency == 'cny') {
            window.location.href = "https://pay.vezii.com/id4/pay_v2?price=" + price + "&token=" + this.api_token + "&prepare_code=" + code + "&prepare_type=addon&prepare_times=" + time;
        } else {
            window.location.href = 'https://s12.tmp.link/payment/paypal/checkout_v2?price=' + price + '&token=' + this.api_token + '&prepare_type=addon&prepare_code=' + code + '&prepare_times=' + time;
        }
    }

    orders_list() {
        $.post(this.api_user, {
            action: 'order_list',
            token: this.api_token,
            //captcha: recaptcha
        }, (rsp) => {
            if (rsp.data.service == 0) {
                $('#orders_addon_contents').html('<div class="text-center"><iconpark-icon name="folder-open" class="fa-fw fa-4x"></iconpark-icon></div>');
            } else {
                $('#orders_addon_contents').html('<div class="row" id="orders_services_contents"></div>');
                var service_list = rsp.data.service;
                var r = this.service_code(service_list);
                $('#order_list').html(app.tpl('order_list_tpl', r));
            }
            $('#orders_loader').fadeOut();
            $('#orders_loaded').show();
        }, 'json');
    }

    service_code(data) {
        var r = {};
        for (let i in data) {
            r[i] = {};
            r[i].name = '';
            r[i].des = '';
            r[i].icon = '';
            r[i].etime = data[i].etime;
            switch (data[i].code) {
                case 'hs':
                    r[i].name = app.languageData.service_code_hs;
                    r[i].des = app.languageData.service_code_hs_des;
                    r[i].icon = 'heart-circle-check';
                    break;
                case 'storage':
                    r[i].name = app.languageData.service_code_storage + ' (' + bytetoconver(data[i].val, true) + ')';
                    r[i].des = app.languageData.service_code_storage_des;
                    r[i].icon = 'album-circle-plus';
                    break;
                case 'media-video':
                    r[i].name = app.languageData.service_code_media + ' (' + bytetoconver(data[i].val, true) + ')';
                    r[i].des = app.languageData.service_code_media_des;
                    r[i].icon = 'circle-video';
                    break;
                //找不到对应的 code ，丢弃该单元
                default:
                    delete r[i];
                    break;
            }
        }
        return r;
    }

    pf_mybg_set(type, ukey) {
        this.loading_box_on();
        $.post(this.api_user, {
            action: 'pf_mybg_set',
            token: this.api_token,
            type: type,
            ukey: ukey
        }, (rsp) => {
            if (rsp.status == 1) {
                $.notifi(app.languageData.mybg_set_ok, "success");
                this.get_details(() => {
                    let night = this.matchNightModel();
                    this.bgLoadImg1(night);
                });
            } else {
                $.notifi(app.languageData.mybg_set_error, "error");
            }
            this.loading_box_off();
        });
    }

    profile_bulk_copy_post() {
        let status = ($('#bulk_copy_status').is(':checked')) ? 'yes' : 'no';
        localStorage.setItem('user_profile_bulk_copy', status);
        $.post(this.api_user, {
            action: 'pf_bulk_copy_set',
            token: this.api_token,
            status: status
        });
    }

    profile_bulk_copy_set(status) {
        localStorage.setItem('user_profile_bulk_copy', status);
        if (status == 'yes') {
            $('#bulk_copy_status').prop('checked', true);
            this.bulkCopyStatus = true;
        }
    }

    profile_bulk_copy_get() {
        let status = localStorage.getItem('user_profile_bulk_copy');
        if (status == 'yes') {
            return true;
        } else {
            return false;
        }
    }



    profile_confirm_delete_post() {
        let status = ($('#confirm_delete_status').is(':checked')) ? 'yes' : 'no';
        localStorage.setItem('user_profile_confirm_delete', status);
        $.post(this.api_user, {
            action: 'pf_confirm_delete_set',
            token: this.api_token,
            status: status
        });
    }

    profile_confirm_delete_set(status) {
        localStorage.setItem('user_profile_confirm_delete', status);
        if (status == 'yes') {
            $('#confirm_delete_status').prop('checked', true);
        }
    }

    profile_confirm_delete_get() {
        let status = localStorage.getItem('user_profile_confirm_delete');
        if (status == 'yes') {
            return true;
        } else {
            return false;
        }
    }

    file_rename(ukey, default_name) {
        var newname = prompt(app.languageData.modal_meetingroom_newname, default_name);
        if (newname == null || newname == "") {
            return false;
        }
        $.post(this.api_file, {
            action: 'rename',
            token: this.api_token,
            name: newname,
            ukey: ukey
        }, (rsp) => {
            //统一使用 dir 模块刷新文件列表
            this.dir.filelist(0);
        });
    }

    file_set_as_cover(ukey, ext) {
        var newname = 'tmplink.preview.' + ext;
        this.loading_box_on();
        $.post(this.api_file, {
            action: 'rename',
            token: this.api_token,
            name: newname,
            ukey: ukey
        }, (rsp) => {
            this.loading_box_off();
            if (rsp.status == 1) {
                $.notifi(app.languageData.set_as_cover + ' - ' + app.languageData.status_ok, "success");
                location.reload();
            } else {
                $.notifi(app.languageData.set_as_cover + ' - ' + app.languageData.mybg_set_fail, "error");
            }
        });
    }

    login() {
        var email = $('#email').val();
        var password = $('#password').val();
        $('#submit').attr('disabled', true);
        $('#msg_notice').show();
        $('#submit').html(app.languageData.form_btn_processing);
        $('#msg_notice').html(app.languageData.form_btn_processing);
        this.recaptcha_do('login', (recaptcha) => {
            if (email !== '' && password !== '') {
                $.post(this.api_user, {
                    action: 'login',
                    token: this.api_token,
                    captcha: recaptcha,
                    email: email,
                    password: password
                }, (rsp) => {
                    if (rsp.status == 1) {
                        $('#msg_notice').html(app.languageData.login_ok);
                        this.logined = 1;
                        this.get_details(() => {
                            localStorage.setItem('app_login', 1);
                            //如果当前页是首页，则刷新当前页面
                            // let url = get_url_params();
                            // if (url.tmpui_page === '/' || url.tmpui_page === undefined) {
                            //     window.location.reload();
                            // } else {
                            //     window.history.back();
                            // }
                            //登录后更新一下用户信息
                            this.profile.init_details();
                            this.storage_status_update();
                            //如果有设置 return_page，则跳转到 return_page
                            let return_page = localStorage.getItem('return_page');
                            if (return_page !== '0') {
                                location.href = return_page;
                                localStorage.setItem('return_page', 0);
                            } else {
                                // 跳转到新版 VXUI 后台
                                app.open('/vx');
                            }
                        });
                    } else {
                        $('#msg_notice').html(app.languageData.login_fail);
                        $('#submit').html(app.languageData.form_btn_login);
                        $('#submit').removeAttr('disabled');
                    }
                });
            } else {
                $('#msg_notice').html(app.languageData.login_fail);
                $('#submit').html(app.languageData.form_btn_login);
                $('#submit').removeAttr('disabled');
            }
        });
    }

    language(lang) {
        if (this.logined === 1) {
            $.post(this.api_user, {
                action: 'language',
                token: this.api_token,
                lang: lang
            });
        }
        this.currentLanguage = lang;
        this.languageBtnSet();
        app.languageSet(lang);
        if (this.uploader && typeof this.uploader.updatePermanentOptionLabel === 'function') {
            this.uploader.updatePermanentOptionLabel();
        }
        //重新初始化导航，目前有一个小问题，无法刷新导航，暂时不管。
        this.navbar.init(this);
        //debug('navbar reinit');
        //如果当前语言不是中文，则覆盖一些支付系统的设置
        this.buy.setAvaliablePayment();
    }

    languageBtnSet() {
        let lang = this.currentLanguage;
        let span_lang = 'English';
        if (lang === 'en') {
            span_lang = 'English';
        }

        if (lang === 'cn') {
            span_lang = '简体中文';
        }

        if (lang === 'hk') {
            span_lang = '繁体中文';
        }

        if (lang === 'jp') {
            span_lang = '日本語';
        }
        $('.selected_lang').html(span_lang);
    }

    /**
     * 旧版兼容：对当前页面（或指定容器）执行 i18n 翻译。
     * VXUI 中部分模块会调用 TL.tpl_lang() 来刷新语言。
     * @param {Element|string} root 可选：DOM 元素或选择器，默认 document
     */
    tpl_lang(root) {
        const translateScope = () => {
            if (typeof app === 'undefined' || !app || !app.languageData) return false;
            const i18nLang = app.languageData;

            let scope = root;
            if (!scope) scope = document;
            if (typeof scope === 'string') scope = document.querySelector(scope);
            if (!scope) scope = document;

            const applyOne = (dom) => {
                if (!dom || !dom.getAttribute) return;
                const key = dom.getAttribute('i18n');
                if (!key || i18nLang[key] === undefined) return;
                const val = i18nLang[key];
                const i18nOnly = dom.getAttribute('i18n-only');

                // innerHTML
                if (dom.innerHTML != null && dom.innerHTML !== '') {
                    if (!i18nOnly || i18nOnly === 'html') {
                        dom.innerHTML = val;
                    }
                }
                // placeholder
                if (dom.getAttribute('placeholder') != null && dom.getAttribute('placeholder') !== '') {
                    if (!i18nOnly || i18nOnly === 'placeholder') {
                        dom.setAttribute('placeholder', val);
                    }
                }
                // content
                if (dom.getAttribute('content') != null && dom.getAttribute('content') !== '') {
                    if (!i18nOnly || i18nOnly === 'content') {
                        dom.setAttribute('content', val);
                    }
                }
                // title
                if (dom.getAttribute('title') != null && dom.getAttribute('title') !== '') {
                    if (!i18nOnly || i18nOnly === 'title') {
                        dom.setAttribute('title', val);
                    }
                }
                // value (only when explicitly specified)
                if (dom.value != null && dom.value !== '') {
                    if (i18nOnly === 'value') {
                        dom.value = val;
                    }
                }
            };

            // VXUI uses data-tpl="key" for most UI texts
            const applyTpl = (dom) => {
                if (!dom || !dom.getAttribute) return;
                const key = dom.getAttribute('data-tpl');
                if (!key || i18nLang[key] === undefined) return;
                const val = i18nLang[key];

                const tag = (dom.tagName || '').toUpperCase();

                // title
                if (dom.getAttribute('title') != null && dom.getAttribute('title') !== '') {
                    dom.setAttribute('title', val);
                }

                // inputs: prefer placeholder
                if (tag === 'INPUT' || tag === 'TEXTAREA') {
                    if (dom.getAttribute('placeholder') != null) {
                        dom.setAttribute('placeholder', val);
                    } else if (dom.value != null) {
                        dom.value = val;
                    }
                    return;
                }

                // Only translate leaf nodes to avoid breaking icon+text layouts
                if (dom.children && dom.children.length > 0) return;
                dom.textContent = val;
            };

            // 支持传入 Element：先翻译自身，再翻译其子节点
            if (scope instanceof Element) {
                if (scope.hasAttribute && scope.hasAttribute('i18n')) applyOne(scope);
                scope.querySelectorAll('[i18n]').forEach(applyOne);

                if (scope.hasAttribute && scope.hasAttribute('data-tpl')) applyTpl(scope);
                scope.querySelectorAll('[data-tpl]').forEach(applyTpl);
            } else {
                document.querySelectorAll('[i18n]').forEach(applyOne);
                document.querySelectorAll('[data-tpl]').forEach(applyTpl);
            }

            return true;
        };

        // 若语言包尚未就绪，先触发构建
        if (typeof app !== 'undefined' && app && typeof app.languageBuild === 'function' && !app.languageData) {
            try {
                const p = app.languageBuild();
                if (p && typeof p.then === 'function') {
                    p.then(() => translateScope());
                    return;
                }
            } catch (e) {
                // ignore
            }
        }

        translateScope();
    }

    logout() {
        localStorage.setItem('app_login', 0);
        this.uid = 0;
        this.logined = 0;
        this.storage_used = 0;
        this.storage = 0;
        this.notes.cleanKey();
        $.post(this.api_user, {
            action: 'logout',
            token: this.api_token
        }, () => {
            window.location.href = '/';
        });
    }

    register() {
        var email = $('#email_new').val();
        var password = $('#password').val();
        var rpassword = $('#rpassword').val();
        var lang = this.currentLanguage;
        var code = $('#checkcode').val();
        $('#msg_notice').show();
        $('#msg_notice').html(app.languageData.form_btn_processing);
        $('#submit').html(app.languageData.form_btn_login);
        $('#submit').attr('disabled', true);
        this.recaptcha_do('user_register', (recaptcha) => {
            $.post(this.api_user, {
                action: 'register',
                token: this.api_token,
                email: email,
                password: password,
                captcha: recaptcha,
                rpassword: rpassword,
                lang: lang,
                code: code
            }, (rsp) => {
                if (rsp.status === 1) {
                    $('#msg_notice').html(app.languageData.reg_finish);
                    $('#submit').html(app.languageData.reg_finish);
                    //转化
                    // gtag('event', 'conversion', {
                    //     'send_to': 'AW-977119233/7Pa-CNH4qbkBEIHQ9tED',
                    // });
                    this.get_details(() => {
                        setTimeout(() => {
                            dynamicView.room();
                        }, 3000);
                    });
                } else {
                    $('#msg_notice').html(rsp.data);
                    $('#submit').html(app.languageData.form_btn_login);
                    $('#submit').removeAttr('disabled');
                }
            });
        });
    }

    cc_send() {
        var email = $('#email_new').val();

        if (email === '') {
            $('#msg_notice').html(app.languageData.direct_brand_logo_set_unknow);
            return false;
        }

        $('#msg_notice').show();
        $('#msg_notice').html(app.languageData.form_btn_processing);
        $('#button-reg-checkcode').html(app.languageData.form_btn_processing);
        $('#button-reg-checkcode').attr('disabled', true);
        this.recaptcha_do('checkcode_send', (recaptcha) => {
            if (email !== '') {
                $.post(this.api_user, {
                    action: 'checkcode_send',
                    token: this.api_token,
                    captcha: recaptcha,
                    lang: app.languageGet(),
                    email: email
                }, (rsp) => {
                    if (rsp.status == 1) {
                        $('#msg_notice').html(app.languageData.form_checkcode_msg_sended);
                        $('#button-reg-checkcode').html(app.languageData.form_checkcode_sended);
                    } else {
                        $('#msg_notice').html(this.error_text(rsp.status));
                        $('#button-reg-checkcode').html(app.languageData.form_getcode);
                        $('#button-reg-checkcode').removeAttr('disabled');
                    }
                });
            }
        });
    }

    error_text(code) {
        let msg = app.languageData.status_error_0;
        switch (code) {
            case 9:
                msg = app.languageData.status_error_9;
                break;
            case 11:
                msg = app.languageData.status_error_11;
                break;
            case 10:
                msg = app.languageData.status_error_10;
                break;
        }
        return msg;
    }



    alert(content) {
        $("#alert-modal-content").html(content);
        $("#alertModal").modal('show');
    }

    report() {
        var ukey = $('#report_ukey').html();
        var reason = $('#report_model').val();
        $('#reportbtn').attr('disabled', true);
        $('#reportbtn').html(`<span class="text-red">${app.languageData.form_btn_processed}</span>`);
        $.post(this.api_file, {
            'action': 'report',
            'token': this.api_token,
            'reason': reason,
            'ukey': ukey
        }, (rsp) => {
            $('#reportbtn').html(app.languageData.form_btn_processed);
        }, 'json');
    }

    room_report() {
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

    find_file() {
        var ukey = $('#ukey').val();
        if (ukey !== '') {
            window.location.href = 'https://' + this.site_domain + '/f/' + ukey;
        }
    }

    get_url_params() {
        var vars = [],
            hash;
        var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
        for (var i = 0; i < hashes.length; i++) {
            hash = hashes[i].split('=');
            vars.push(hash[0]);
            vars[hash[0]] = hash[1];
        }
        return vars;
    }

    storage_status_update() {
        let data = {};
        data.storage_text = bytetoconver(this.storage, true);
        data.storage_used_text = bytetoconver(this.storage_used, true);
        data.private_storage_used_text = bytetoconver(this.private_storage_used, true);
        data.private_storage_used_percent = (this.private_storage_used / this.storage) * 100;
        data.percent = (this.storage_used / this.storage) * 100;
        $('#upload_storage_status').html(data.private_storage_used_text + ' | ' + data.storage_text);
        $('.user_storage_used').html(data.storage_used_text);
        $('.user_storage_total').html(data.storage_text);
        $('.private_storage_used').html(data.private_storage_used_text);
        $('.private_storage_used_percent').css('width', data.private_storage_used_percent + '%');
        // $('#upload_storage_status').html(app.tpl('upload_storage_status_tpl', data));

        if (this.uploader && typeof this.uploader.setStorageUsage === 'function') {
            this.uploader.setStorageUsage({
                storage: this.storage,
                storage_used: this.storage_used,
                private_storage_used: this.private_storage_used
            });
        }
    }

    btn_copy_bind() {
        // 只在第一次调用时初始化 clipboard 实例
        if (!this.clipboardInstance) {
            // 创建 clipboard 实例，使用 body 作为容器以支持动态添加的元素
            this.clipboardInstance = new Clipboard('.btn_copy', {
                container: document.body
            });
            
            this.clipboardInstance.on('success', (e) => {
                let tmp = $(e.trigger).html();
                $(e.trigger).html(app.languageData.copied);
                setTimeout(() => {
                    $(e.trigger).html(tmp);
                }, 3000);
                e.clearSelection();
            });
            
            this.clipboardInstance.on('error', (e) => {
                console.error('Copy action failed:', e.action);
                console.error('Trigger:', e.trigger);
            });
        }
        // 如果已经初始化过，则不需要重复初始化
        // ClipboardJS 会自动处理动态添加的具有 .btn_copy 类的元素
    }


    api_init() {
        $.post(this.api_url + '/init', (data) => {
            this.api_file = data + '/file';
            this.api_user = data + '/user';
            this.api_url_upload = data + '/file';
            this.api_mr = data + '/meetingroom';
        }, 'text');
        // $.post(this.api_url + '/init_uploader', (data) => {
        //     this.api_url_upload = data + '/file'
        // }, 'text');
    }

    fileicon(type) {
        var r = 'file-lines';
        switch (type) {
            case 'pdf':
                r = 'file-pdf';
                break;
            case 'zip':
                r = 'file-zipper';
                break;
            case 'rar':
                r = 'file-zipper';
                break;
            case '7z':
                r = 'file-zipper';
                break;
            case 'gz':
                r = 'file-zipper';
                break;
            case 'tar':
                r = 'file-zipper';
                break;
            case 'msixbundle':
                r = 'file-zipper';
                break;

            case 'doc':
                r = 'file-word';
                break;
            case 'wps':
                r = 'file-word';
                break;
            case 'docx':
                r = 'file-word';
                break;

            case 'c':
                r = 'file-code';
                break;
            case 'go':
                r = 'file-code';
                break;
            case 'cpp':
                r = 'file-code';
                break;
            case 'php':
                r = 'file-code';
                break;
            case 'java':
                r = 'file-code';
                break;
            case 'js':
                r = 'file-code';
                break;
            case 'vb':
                r = 'file-code';
                break;
            case 'py':
                r = 'file-code';
                break;
            case 'css':
                r = 'file-code';
                break;
            case 'html':
                r = 'file-code';
                break;
            case 'tar':
                r = 'file-code';
                break;
            case 'asm':
                r = 'file-code';
                break;

            case 'ogg':
                r = 'file-music';
                break;
            case 'm4a':
                r = 'file-music';
                break;
            case 'mp3':
                r = 'file-music';
                break;
            case 'wav':
                r = 'file-music';
                break;
            case 'weba':
                r = 'file-music';
                break;
            case 'mp4':
                r = 'file-video';
                break;
            case 'rm':
                r = 'file-video';
                break;
            case 'rmvb':
                r = 'file-video';
                break;
            case 'avi':
                r = 'file-video';
                break;
            case 'mkv':
                r = 'file-video';
                break;
            case 'webm':
                r = 'file-video';
                break;
            case 'wmv':
                r = 'file-video';
                break;
            case 'flv':
                r = 'file-video';
                break;
            case 'mpg':
                r = 'file-video';
                break;
            case 'mpeg':
                r = 'file-video';
                break;
            case 'ts':
                r = 'file-video';
                break;
            case 'mov':
                r = 'file-video';
                break;
            case 'vob':
                r = 'file-video';
                break;

            case 'png':
                r = 'file-image';
                break;
            case 'gif':
                r = 'file-image';
                break;
            case 'bmp':
                r = 'file-image';
                break;
            case 'jpg':
                r = 'file-image';
                break;
            case 'jpeg':
                r = 'file-image';
                break;
            case 'webp':
                r = 'file-image';
                break;

            case 'ppt':
                r = 'file-powerpoint';
                break;
            case 'pptx':
                r = 'file-powerpoint';
                break;

            case 'xls':
                r = 'file-excel';
                break;
            case 'xlsx':
                r = 'file-excel';
                break;
            case 'xlsm':
                r = 'file-excel';
                break;

            case 'exe':
                r = 'window';
                break;
            case 'bin':
                r = 'window';
                break;
            case 'msi':
                r = 'window';
                break;
            case 'bat':
                r = 'window';
                break;
            case 'sh':
                r = 'window';
                break;

            case 'rpm':
                r = 'cube';
                break;
            case 'deb':
                r = 'cube';
                break;
            case 'msi':
                r = 'cube';
                break;
            case 'dmg':
                r = 'cube';
                break;
            case 'apk':
                r = 'cube';
                break;

            case 'torrent':
                r = 'acorn';
                break;

        }
        return r;
    }

    async bulkCopy(dom, content, base64) {
        try {
            //如果传递进来的内容是 base64 编码的内容，先解码
            if (base64 === true) {
                content = Base64Decode(content);
            }

            let tmp = null;
            if (dom !== null) {
                // 保存原始内容用于后续恢复
                tmp = $(dom).html();
                // 显示复制成功的图标
                $(dom).html('<iconpark-icon name="circle-check" class="fa-fw"></iconpark-icon>');
            }

            if (this.profile_bulk_copy_get()) {
                //如果启用了批量复制，检查目前是否处于定时器状态
                if (this.bulkCopyTimer !== 0) {
                    //处于定时器状态，先取消。
                    clearTimeout(this.bulkCopyTimer);
                    this.bulkCopyTimer = 0;
                } else {
                    $.notifi(app.languageData.notify_bulk_copy_start, "success");
                }

                //将内容写入到缓存并复制到剪贴板
                this.bulkCopyTmp += content + " \n";
                await copyToClip(this.bulkCopyTmp);
                //设置一个10秒缓存器
                this.bulkCopyTimer = setTimeout(() => {
                    this.bulkCopyTimer = 0;
                    this.bulkCopyTmp = '';
                    $.notifi(app.languageData.notify_bulk_copy_finish, "success");
                }, 10000);

            } else {
                //直接复制
                $.notifi(app.languageData.copied, "success");
                await copyToClip(content);
            }
            
            // 复制成功后延时恢复原始内容
            if (dom !== null && tmp !== null) {
                setTimeout(() => {
                    $(dom).html(tmp);
                }, 3000);
            }
        } catch (error) {
            console.error("复制失败:", error);
            
            // 复制失败时恢复原始内容
            if (dom !== null && tmp !== null) {
                $(dom).html(tmp);
            }
        }
    }

    async directCopy(dom, content, base64) {
        try {
            //如果传递进来的内容是 base64 编码的内容，先解码
            if (base64 === true) {
                content = Base64Decode(content);
            }

            let tmp = null;
            if (dom !== null) {
                // 保存原始内容用于后续恢复
                tmp = $(dom).html();
                // 显示复制成功的图标
                $(dom).html('<iconpark-icon name="circle-check" class="fa-fw"></iconpark-icon>');
            }

            //直接复制
            $.notifi(app.languageData.copied, "success");
            await copyToClip(content);
            
            // 复制成功后延时恢复原始内容
            if (dom !== null && tmp !== null) {
                setTimeout(() => {
                    $(dom).html(tmp);
                }, 3000);
            }
        } catch (error) {
            console.error("复制失败:", error);
            
            // 复制失败时恢复原始内容
            if (dom !== null && tmp !== null) {
                $(dom).html(tmp);
            }
        }
    }

    randomString(len) {
        len = len || 32;
        let $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
        let maxPos = $chars.length;
        let pwd = '';
        for (let i = 0; i < len; i++) {
            pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
        }
        return pwd;
    }

    // 提供简洁版的复制方法，不使用批量复制功能和通知横幅
    copyFileUrl() {
        // 获取当前URL参数
        const params = this.get_url_params();
        // 复制分享链接（不是下载链接）
        const shareUrl = `https://${this.site_domain}/f/${params.ukey}`;
        
        // 复制到剪贴板
        copyToClip(shareUrl).then(() => {
            // 获取图标元素
            const $icon = $('#btn_copy_fileurl_icon iconpark-icon');
            // 保存原始图标名称
            const originalName = $icon.attr('name');
            // 更换图标为完成的标志
            $icon.attr('name', 'circle-check').css('color', '#22c55e');
            // 3秒后恢复原状
            setTimeout(() => {
                $icon.attr('name', originalName).css('color', '');
            }, 3000);
        }).catch(err => {
            console.error('Copy failed:', err);
        });
    }
    
    // 简洁版复制函数，不使用批量复制功能和通知横幅
    async simpleCopy(dom, content) {
        try {
            // 复制内容到剪贴板
            await copyToClip(content);
            
            // 如果提供了DOM元素，显示视觉反馈
            if (dom) {
                let icon = null;
                
                // 检查dom是否是按钮元素
                if (dom.tagName === 'BUTTON') {
                    // 如果是按钮，查找其中的图标元素
                    icon = $(dom).closest('.btn-point').find('iconpark-icon')[0];
                } else {
                    // 否则假设dom已经是图标容器
                    icon = $(dom).find('iconpark-icon')[0];
                    if (!icon) {
                        // 尝试获取父元素中的图标
                        icon = $(dom).closest('.fileicon').find('iconpark-icon')[0];
                    }
                }
                
                // 如果找到图标元素，改变其为成功图标
                if (icon) {
                    const originalName = $(icon).attr('name');
                    const originalClass = $(icon).attr('class');
                    
                    // 保存原始状态用于还原
                    $(icon).data('original-name', originalName);
                    $(icon).data('original-class', originalClass);
                    
                    // 更改为成功图标
                    $(icon).attr('name', 'circle-check');
                    $(icon).removeClass('text-cyan').addClass('text-green');
                    
                    // 3秒后恢复原状
                    setTimeout(() => {
                        $(icon).attr('name', $(icon).data('original-name'));
                        $(icon).attr('class', $(icon).data('original-class'));
                    }, 3000);
                }
            }
        } catch (error) {
            console.error('Copy failed:', error);
        }
    }

    leftTimeString(time) {
        let now = time - 1;
        let left_time = now;

        let d = '';
        let h = '';
        let m = '';
        let s = '';

        if (now == 0) {
            return false;
        }

        // Check if time is more than 1 day
        const moreThanOneDay = now > 86400;

        if (moreThanOneDay) {
            d = Math.floor(now / 86400);
            d = d + ':';
            left_time = left_time % 86400;
        }

        if (left_time > 3600) {
            h = Math.floor(left_time / 3600);
            h = h < 10 ? "0" + h : h;
            h = h === "0" ? "00" : h;
            h = h + ':';
            left_time = left_time % 3600;
        }

        if (left_time > 60) {
            m = Math.floor(left_time / 60);
            m = m < 10 ? "0" + m : m;
            m = m === "0" ? "00" : m;
            m = m + ':';
            left_time = left_time % 60;
        }

        // Only show seconds if less than 1 day
        if (!moreThanOneDay) {
            if (left_time > 0) {
                s = left_time;
                s = s < 10 ? "0" + s : s;
                s = s === "0" ? "00" : s;
            }
            if (left_time === 0 && m !== '') {
                s = "00";
            }
        } else {
            // Remove trailing colon when more than 1 day
            if (m !== '') {
                m = m.slice(0, -1);
            }
        }

        return d + h + m + s;
    }
}
