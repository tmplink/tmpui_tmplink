/*
 * api.js
 * Minimal tmplink surface for VXUI usage.
 */

'use strict';

class tmplink_api {
    api_url = 'https://tmplink-sec.vxtrans.com/api_v2';
    api_url_sec = 'https://tmplink-sec.vxtrans.com/api_v2';
    api_url_upload = null;
    api_file = null;
    api_pay = null;
    api_user = null;
    api_direct = null;
    api_media = null;
    api_mr = null;
    api_notes = null;
    api_ai = null;
    api_toks = null;
    api_tokx = null;
    api_token = null;
    site_domain = null;

    current_file_details = null;
    current_file_download_url = null;
    current_file_curl_command = null;
    current_file_wget_command = null;

    recaptcha_op = false;
    recaptcha = '6LfqxcsUAAAAABAABxf4sIs8CnHLWZO4XDvRJyN5';
    recaptchaToken = '0';
    recaptcha_actions = ["download_req", "stream_req"];

    pageReady = false;
    readyFunction = [];

    logined = 0;
    currentLanguage = 'cn';

    storage = 0;
    storage_used = 0;
    private_storage_used = 0;
    high_speed_channel = false;
    isSponsor = false;

    uid = 0;
    user_group = {};
    sponsor = false;
    sponsor_time = null;
    user_acv = 0;
    user_join = null;
    user_total_files = 0;
    user_total_filesize = '0 GB';
    user_total_upload = '0 GB';

    bulkCopyStatus = false;
    bulkCopyTmp = '';
    bulkCopyTimer = 0;

    ga_keeper = null;
    ga_title = 'vxui_keepalive';
    ga_processing = false;
    lastEventAt = 0;
    lastKeepAliveAt = 0;

    constructor(options = {}) {
        if (options.api_url) this.api_url = options.api_url;
        if (options.api_url_sec) this.api_url_sec = options.api_url_sec;

        this.currentLanguage = this.getStoredLanguage();
        this.init_api();
        this.setDomain();
        this.setThemeColor();
        this.initLanguageAliases();

        this.bootstrapToken();
    }

    init_api() {
        let hostname = window.location.hostname;
        if (hostname === 'www.ttttt.link' || hostname === '127.0.0.1') {
            this.api_url = 'https://connect.cntmp.link/api_v2';
        }

        this.api_url_upload = this.api_url + '/file';
        this.api_file = this.api_url + '/file';
        this.api_pay = this.api_url + '/pay';
        this.api_user = this.api_url + '/user';
        this.api_direct = this.api_url + '/direct';
        this.api_media = this.api_url + '/media';
        this.api_mr = this.api_url + '/meetingroom';
        this.api_notes = this.api_url + '/notes';
        this.api_ai = this.api_url + '/ai';
        this.api_toks = this.api_url_sec + '/token';
        this.api_tokx = this.api_url + '/token';
    }

    initLanguageAliases() {
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
            // ignore
        }
    }

    bootstrapToken() {
        const token = this.getTokenFromStorage();
        const finalize = () => this.readyExec();

        if (!this.api_tokx) {
            if (token) this.api_token = token;
            this.get_details(() => finalize());
            return;
        }

        const ensureToken = (newToken) => {
            if (newToken) {
                this.api_token = newToken;
                localStorage.setItem('app_token', newToken);
            }
            this.get_details(() => finalize());
        };

        const requestNewToken = (fallbackToken) => {
            this.recaptcha_do('token', (captcha) => {
                $.post(this.api_tokx, {
                    action: 'token',
                    captcha: captcha,
                    token: fallbackToken
                }, (rsp) => {
                    if (rsp && rsp.data) {
                        ensureToken(rsp.data);
                    } else {
                        finalize();
                    }
                }, 'json').fail(() => finalize());
            });
        };

        if (token) {
            $.post(this.api_tokx, {
                action: 'token_check',
                token: token
            }, (rsp) => {
                if (rsp && rsp.status === 1) {
                    this.api_token = token;
                    this.get_details(() => finalize());
                    return;
                }

                if (rsp && rsp.status === 3) {
                    if (typeof app !== 'undefined' && app && typeof app.tpl === 'function') {
                        const html = app.tpl('initFail', {});
                        $('#tmpui_body').html(html);
                        if (typeof app.languageBuild === 'function') app.languageBuild();
                    }
                    finalize();
                    return;
                }

                requestNewToken(token);
            }, 'json').fail(() => requestNewToken(token));
        } else {
            requestNewToken(null);
        }
    }

    getTokenFromStorage() {
        const stored = localStorage.getItem('app_token');
        if (stored) return stored;
        if (typeof getCookie === 'function') {
            const c = getCookie('token');
            if (c) return c;
        }
        return null;
    }

    getStoredLanguage() {
        const stored = localStorage.getItem('app_lang');
        if (stored) return stored;
        if (typeof app !== 'undefined' && app && app.languageSetting) return app.languageSetting;
        return 'cn';
    }

    matchNightModel() {
        let media = window.matchMedia('(prefers-color-scheme: dark)');
        return media.matches;
    }

    setThemeColor() {
        if (this.matchNightModel()) {
            $('meta[name="theme-color"]').attr('content', '#000');
        } else {
            $('meta[name="theme-color"]').attr('content', '#fff');
        }
    }

    setDomain() {
        this.site_domain = window.location.hostname == 'www.ttttt.link' ? 'ttttt.link' : 'tmp.link';
    }

    ga(title, path) {
        if (!title) return;
        if (this.api_token == null) return;
        if (!this.api_user) return;
        this.ga_processing = true;
        this.ga_title = title;
        this.lastEventAt = Date.now();
        $.post(this.api_user, {
            action: 'event_ui',
            token: this.api_token,
            title: title,
            path: path || (location.pathname + location.search),
        }).always(() => {
            this.ga_processing = false;
        });
    }

    setupActivityTracking() {
        if (this._activityTrackingSetup) return;
        this._activityTrackingSetup = true;
    }

    keep_alive() {
        if (this.ga_keeper !== null) return;
        
        this.lastEventAt = Date.now();
        this.setupActivityTracking();

        const IDLE_THRESHOLD = 3 * 60 * 1000; // 3 minutes

        this.ga_keeper = setInterval(() => {
            const now = Date.now();
            
            // Logic: 
            // 1. User must be idle (> 3 mins no input)
            // 2. Heartbeat throttled (> 3 mins since last send)
            if (now - this.lastEventAt >= IDLE_THRESHOLD) {
                if (now - this.lastKeepAliveAt >= IDLE_THRESHOLD) {
                     if (this.ga_processing) return;
                     if (!this.api_token || !this.api_user) return;

                     this.ga_processing = true;
                     $.post(this.api_user, {
                        action: 'event_ui',
                        token: this.api_token,
                        title: this.ga_title,
                        path: (location.pathname + location.search),
                    }).always(() => {
                        this.ga_processing = false;
                        this.lastKeepAliveAt = Date.now(); 
                        // Do NOT update lastEventAt here, preserving idle state
                    });
                }
            }
        }, 5000);
    }

    ready(cb) {
        if (this.pageReady) {
            if (typeof cb === 'function') cb();
        } else if (typeof cb === 'function') {
            this.readyFunction.push(cb);
        }
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

    isLogin() {
        const login = localStorage.getItem('app_login');
        return login !== null && login !== '0' && login !== 0;
    }

    recaptcha_do(type, cb) {
        if (this.recaptcha_op && this.recaptchaCheckAction(type)) {
            grecaptcha.ready(() => {
                grecaptcha.execute(this.recaptcha, { action: type }).then((token) => {
                    cb(token);
                });
            });
        } else {
            $.post(this.api_tokx, { action: 'challenge' }, (rsp) => cb(rsp.data));
        }
    }

    async recaptcha_do_async(type) {
        return new Promise((resolve, reject) => {
            if (this.recaptcha_op && this.recaptchaCheckAction(type)) {
                grecaptcha.ready(async () => {
                    try {
                        const token = await grecaptcha.execute(this.recaptcha, { action: type });
                        resolve(token);
                    } catch (error) {
                        reject(error);
                    }
                });
            } else {
                $.post(this.api_tokx, { action: 'challenge' })
                    .then(rsp => resolve(rsp.data))
                    .fail(error => reject(error));
            }
        });
    }

    recaptchaCheckAction(action) {
        for (let i in this.recaptcha_actions) {
            if (this.recaptcha_actions[i] == action) return true;
        }
        return false;
    }

    async get_download_url(ukey) {
        const api = this.api_file;
        const token = this.api_token;
        if (!api || !token) throw new Error('missing api/token');

        const recaptcha = (typeof this.recaptcha_do_async === 'function')
            ? await this.recaptcha_do_async('download_req')
            : '';

        const response = await $.post(api, {
            action: 'download_req',
            ukey: ukey,
            token: token,
            captcha: recaptcha
        });

        if (response && response.status === 1) return response.data;
        if (response && response.status === 3) {
            throw new Error((app && app.languageData && app.languageData.status_need_login) || '需要登录');
        }
        throw new Error((app && app.languageData && app.languageData.status_error_0) || '请求失败');
    }

    get_details(cb) {
        if (!this.api_user || !this.api_token) {
            if (typeof cb === 'function') cb();
            return;
        }

        $.post(this.api_user, {
            action: 'get_detail',
            token: this.api_token
        }, (rsp) => {
            if (rsp && rsp.status === 1) {
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

                const sizeConv = (typeof bytetoconver === 'function') ? bytetoconver : (v) => v;
                this.user_total_filesize = sizeConv(rsp.data.total_filesize, true);
                this.user_total_upload = sizeConv(rsp.data.total_upload, true);

                if (rsp.data.lang) {
                    localStorage.setItem('app_lang', rsp.data.lang);
                    this.currentLanguage = rsp.data.lang;
                    if (typeof app !== 'undefined' && app && typeof app.languageSet === 'function') {
                        app.languageSet(rsp.data.lang);
                    }
                }

                this.isSponsor = !!this.sponsor;
                if (this.isSponsor && document.body) {
                    document.body.classList.add('sponsor-mode');
                }
            }

            if (typeof cb === 'function') cb();
        }, 'json').fail(() => {
            if (typeof cb === 'function') cb();
        });
    }

    language(lang) {
        if (!lang) return;
        if (this.logined === 1 && this.api_user && this.api_token) {
            $.post(this.api_user, {
                action: 'language',
                token: this.api_token,
                lang: lang
            });
        }
        this.currentLanguage = lang;
        localStorage.setItem('app_lang', lang);

        if (typeof app !== 'undefined' && app && typeof app.languageSet === 'function') {
            return app.languageSet(lang);
        }
        return null;
    }

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
                const key = dom.getAttribute('i18n') || dom.getAttribute('data-tpl');
                if (!key || i18nLang[key] === undefined) return;
                const val = i18nLang[key];
                const i18nOnly = dom.getAttribute('i18n-only');

                if (dom.innerHTML != null && dom.innerHTML !== '') {
                    if (!i18nOnly || i18nOnly === 'html') {
                        dom.innerHTML = val;
                    }
                }
                if (dom.getAttribute('placeholder') != null && dom.getAttribute('placeholder') !== '') {
                    if (!i18nOnly || i18nOnly === 'placeholder') {
                        dom.setAttribute('placeholder', val);
                    }
                }
                if (dom.getAttribute('title') != null && dom.getAttribute('title') !== '') {
                    if (!i18nOnly || i18nOnly === 'title') {
                        dom.setAttribute('title', val);
                    }
                }
            };

            const nodes = scope.querySelectorAll('[i18n],[data-tpl]');
            for (let i = 0; i < nodes.length; i++) {
                applyOne(nodes[i]);
            }
            return true;
        };

        if (!root && typeof app !== 'undefined' && app && typeof app.languageBuild === 'function') {
            try {
                app.languageBuild();
                return true;
            } catch (_) {
                return translateScope();
            }
        }

        return translateScope();
    }

    fileicon(type) {
        var r = 'file-lines';
        switch (type) {
            case 'pdf':
                r = 'file-pdf';
                break;
            case 'zip':
            case 'rar':
            case '7z':
            case 'gz':
            case 'tar':
            case 'msixbundle':
                r = 'file-zipper';
                break;
            case 'doc':
            case 'wps':
            case 'docx':
                r = 'file-word';
                break;
            case 'xls':
            case 'xlsx':
            case 'xlsm':
                r = 'file-excel';
                break;
            case 'ppt':
            case 'pptx':
                r = 'file-powerpoint';
                break;
            case 'c':
            case 'go':
            case 'cpp':
            case 'php':
            case 'java':
            case 'js':
            case 'vb':
            case 'py':
            case 'css':
            case 'html':
            case 'asm':
                r = 'file-code';
                break;
            case 'ogg':
            case 'm4a':
            case 'mp3':
            case 'wav':
            case 'weba':
            case 'aac':
            case 'flac':
                r = 'file-music';
                break;
            case 'mp4':
            case 'rm':
            case 'rmvb':
            case 'avi':
            case 'mkv':
            case 'webm':
            case 'wmv':
            case 'flv':
            case 'mpg':
            case 'mpeg':
            case 'ts':
            case 'mov':
            case 'vob':
                r = 'file-video';
                break;
            case 'png':
            case 'gif':
            case 'bmp':
            case 'jpg':
            case 'jpeg':
            case 'webp':
                r = 'file-image';
                break;
            case 'exe':
            case 'bin':
            case 'msi':
            case 'bat':
            case 'sh':
                r = 'window';
                break;
            case 'rpm':
            case 'deb':
            case 'dmg':
            case 'apk':
                r = 'cube';
                break;
            case 'torrent':
                r = 'acorn';
                break;
        }
        return r;
    }

    previewModel(ukey, name, id, sid, sha1, ftype) {
        if (!sid || !sha1) {
            if (typeof app !== 'undefined' && app.languageData) {
                this.alert(app.languageData.status_error_0 || '无法预览');
            }
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

        $('#preview_title').html(name);
        $('#btn_preview_download').attr('data-ukey', ukey);
        $('#btn_preview_download').removeAttr('disabled');
        $('#btn_preview_download').attr('onclick', 'TL.download_direct(\'' + ukey + '\')');
        $('#btn_preview_remove').attr('onclick', "TL.workspace_del('" + ukey + "')");
        $('#previewModal').modal('show');
    }

    async bulkCopy(dom, content, base64) {
        try {
            if (base64 === true && typeof Base64Decode === 'function') {
                content = Base64Decode(content);
            }

            let tmp = null;
            if (dom !== null && dom !== undefined) {
                tmp = $(dom).html();
                $(dom).html('<iconpark-icon name="circle-check" class="fa-fw"></iconpark-icon>');
            }

            const doCopy = async (text) => {
                if (typeof copyToClip === 'function') {
                    await copyToClip(text);
                    return;
                }
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                    return;
                }
            };

            if (this.profile_bulk_copy_get()) {
                if (this.bulkCopyTimer !== 0) {
                    clearTimeout(this.bulkCopyTimer);
                    this.bulkCopyTimer = 0;
                } else if (typeof $ !== 'undefined' && $.notifi && app && app.languageData) {
                    $.notifi(app.languageData.notify_bulk_copy_start, 'success');
                }

                this.bulkCopyTmp += content + ' \n';
                await doCopy(this.bulkCopyTmp);

                this.bulkCopyTimer = setTimeout(() => {
                    this.bulkCopyTimer = 0;
                    this.bulkCopyTmp = '';
                    if (typeof $ !== 'undefined' && $.notifi && app && app.languageData) {
                        $.notifi(app.languageData.notify_bulk_copy_finish, 'success');
                    }
                }, 10000);
            } else {
                if (typeof $ !== 'undefined' && $.notifi && app && app.languageData) {
                    $.notifi(app.languageData.copied, 'success');
                }
                await doCopy(content);
            }

            if (dom !== null && dom !== undefined && tmp !== null) {
                setTimeout(() => $(dom).html(tmp), 600);
            }
        } catch (e) {
            // ignore
        }
    }

    profile_bulk_copy_post() {
        const status = (localStorage.getItem('pref_bulk_copy') === 'true') ? 'yes' : 'no';
        localStorage.setItem('user_profile_bulk_copy', status);
        if (this.api_user && this.api_token) {
            $.post(this.api_user, {
                action: 'pf_bulk_copy_set',
                token: this.api_token,
                status: status
            });
        }
    }

    profile_bulk_copy_get() {
        const status = localStorage.getItem('user_profile_bulk_copy');
        if (status === 'yes') return true;
        if (status === 'no') return false;
        return localStorage.getItem('pref_bulk_copy') === 'true';
    }

    profile_confirm_delete_post() {
        const status = (localStorage.getItem('pref_confirm_delete') === 'false') ? 'no' : 'yes';
        localStorage.setItem('user_profile_confirm_delete', status);
        if (this.api_user && this.api_token) {
            $.post(this.api_user, {
                action: 'pf_confirm_delete_set',
                token: this.api_token,
                status: status
            });
        }
    }

    cc_send() {
        const email = $('#email_new').val();
        if (!email) return false;
        this.recaptcha_do('checkcode_send', (recaptcha) => {
            $.post(this.api_user, {
                action: 'checkcode_send',
                token: this.api_token,
                captcha: recaptcha,
                lang: (app && typeof app.languageGet === 'function') ? app.languageGet() : this.currentLanguage,
                email: email
            });
        });
    }

    file_rename(ukey, default_name) {
        const promptText = (app && app.languageData && app.languageData.modal_meetingroom_newname) || '请输入新名称';
        var newname = prompt(promptText, default_name);
        if (newname == null || newname === '') return false;

        $.post(this.api_file, {
            action: 'rename',
            token: this.api_token,
            name: newname,
            ukey: ukey
        }, () => {
            if (typeof VX_FILELIST !== 'undefined' && VX_FILELIST && typeof VX_FILELIST.refresh === 'function') {
                VX_FILELIST.refresh();
            }
        });
    }

    set_file_download_cache(url, filename) {
        if (!url) return;
        this.current_file_download_url = url;
        if (filename) {
            this.current_file_curl_command = `curl -Lo "${filename}" ${url}`;
            this.current_file_wget_command = `wget -O "${filename}" ${url}`;
        }
    }

    async file_get_details(ukey) {
        if (!this.api_file) {
            console.error('[tmplink_api] api_file not initialized');
            return { status: 0, error: 'api_not_ready' };
        }
        return new Promise((resolve) => {
            $.post(this.api_file, {
                action: 'details',
                ukey: ukey,
                token: this.api_token
            }, (rsp) => {
                if (rsp && rsp.status === 1) {
                    this.current_file_details = rsp.data;
                }
                resolve(rsp);
            }, 'json').fail((xhr, status, error) => {
                console.error('[tmplink_api] file_get_details failed:', status, error);
                resolve({ status: 0, error: 'network_error' });
            });
        });
    }

    async file_download_url(ukey, filename) {
        if (this.current_file_download_url) return this.current_file_download_url;
        const url = await this.get_download_url(ukey);
        this.set_file_download_cache(url, filename);
        return url;
    }

    async file_preload_download_url(ukey, filename) {
        if (this.current_file_download_url) return this.current_file_download_url;
        try {
            return await this.file_download_url(ukey, filename);
        } catch (e) {
            return null;
        }
    }

    async file_like(ukey) {
        if (!this.api_file) return { status: 0 };
        return new Promise((resolve) => {
            $.post(this.api_file, {
                action: 'like',
                ukey: ukey,
                token: this.api_token
            }, (rsp) => resolve(rsp), 'json').fail(() => resolve({ status: 0 }));
        });
    }

    async file_add_to_workspace(ukey) {
        if (!this.api_file) return { status: 0 };
        return new Promise((resolve) => {
            $.post(this.api_file, {
                action: 'add_to_workspace',
                token: this.api_token,
                ukey: ukey
            }, (rsp) => resolve(rsp), 'json').fail(() => resolve({ status: 0 }));
        });
    }

    async file_report(ukey, reason) {
        if (!this.api_file) return { status: 0 };
        return new Promise((resolve) => {
            $.post(this.api_file, {
                action: 'report',
                token: this.api_token,
                reason: reason,
                ukey: ukey
            }, (rsp) => resolve(rsp), 'json').fail(() => resolve({ status: 0 }));
        });
    }

    logout() {
        localStorage.setItem('app_login', 0);
        this.uid = 0;
        this.logined = 0;
        this.storage_used = 0;
        this.storage = 0;

        // Clean notes key if available
        try {
            localStorage.removeItem('NotesKey');
            sessionStorage.removeItem('NotesKey');
        } catch (e) { /* ignore */ }

        if (this.api_user && this.api_token) {
            $.post(this.api_user, {
                action: 'logout',
                token: this.api_token
            }, () => {
                window.location.href = '/';
            });
        } else {
            window.location.href = '/';
        }
    }

    switchToClassic() {
        localStorage.setItem('tmplink_ui_preference', 'vxui');
        window.location.href = '/?tmpui_page=/vx';
    }

    alert(msg) {
        if (typeof VXUI !== 'undefined' && VXUI && typeof VXUI.toastError === 'function') {
            VXUI.toastError(msg);
        } else {
            window.alert(msg);
        }
    }
}

if (typeof window !== 'undefined') {
    window.tmplink_api = tmplink_api;
}
