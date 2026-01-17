/**
 * File Download Page Controller
 * 文件下载页面的完整控制器，使用 ES6 Class 语法
 * 
 * 职责：
 * - UI 初始化与视口适配
 * - 文件详情加载与展示
 * - 下载按钮事件处理
 * - 多线程分块下载
 * - 下载进度显示
 */

class FilePageController {
    // ========== 常量配置 ==========
    static CHUNK_SIZE = 8 * 1024 * 1024;           // 分块大小 8MB
    static SMALL_FILE_THRESHOLD = 8 * 1024 * 1024 * 3; // 小于 24MB 直接下载
    static MAX_CHUNK_RETRY = 3;                     // 单块最大重试次数
    static MAX_CONCURRENT_DOWNLOADS = 3;            // 最大并行下载数

    // ========== 实例属性 ==========
    constructor() {
        // 下载状态
        this.threads = [];
        this.chunks = [];
        this.totalSize = 0;
        this.downloadedBytes = 0;
        this.lastTotalBytes = 0;
        this.lastSpeedUpdate = 0;
        this.multiThreadActive = false;
        this.fastDownloadInProgress = false;
        this.speedInterval = null;

        // 文件信息
        this.currentFileDetails = null;
        this.currentDownloadUrl = null;
        this.currentCurlCommand = null;
        this.currentWgetCommand = null;

        // DOM 缓存
        this.$downloadBtn = null;
        this.$progressContainer = null;
        this.$progressFill = null;
        this.$downloadSpeed = null;
        this.$downloadProgress = null;
        this.$btnLabel = null;
    }

    // ========== 初始化 ==========
    
    init() {
        this.initViewport();
        this.initDOMCache();
        this.initPageClass();
        this.bindEvents();
        
        // 确保进度容器默认隐藏
        this.hideProgress();
        
        console.log('[FilePageController] Initialized');
    }

    initViewport() {
        const setVH = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };

        const updateCompact = () => {
            const root = document.querySelector('.file-screen');
            if (!root) return;
            const compact = window.innerHeight < 720 || window.innerWidth < 380;
            root.classList.toggle('is-compact', compact);
        };

        setVH();
        updateCompact();

        window.addEventListener('resize', () => { setVH(); updateCompact(); });
        window.addEventListener('orientationchange', () => { setVH(); updateCompact(); });
    }

    initPageClass() {
        document.documentElement.classList.add('file-page');
        document.body.classList.add('file-page');
    }

    initDOMCache() {
        this.$downloadBtn = document.getElementById('file_download_btn_fast');
        this.$progressContainer = document.getElementById('download_progress_container');
        this.$progressFill = document.getElementById('progress_thread_1');
        this.$downloadSpeed = document.getElementById('download_speed');
        this.$downloadProgress = document.getElementById('download_progress');
        this.$btnLabel = this.$downloadBtn?.querySelector('.download-btn-label');
    }

    isMobileContext() {
        if (typeof isMobileScreen === 'function') {
            return isMobileScreen();
        }
        if (typeof window !== 'undefined' && window.matchMedia) {
            return window.matchMedia('(max-width: 675px)').matches;
        }
        return false;
    }

    bindEvents() {
        // 下载按钮点击事件由 tmplink.js 绑定（因涉及 API token/recaptcha）
        // 这里只处理 UI 层面的事件
    }

    // ========== 文件详情加载 ==========

    async loadFileDetails() {
        $('#top_loggo').attr('src', '/img/ico/logo-new.svg').show();
        // 显示骨架屏，隐藏实际内容
        $('#file_skeleton').show();
        $('#file_loading_box').hide();
        $('#file_box').hide();
        $('.mobile-footer').hide();

        if (this.isWeixin()) {
            $('#file_messenger_icon').html('<iconpark-icon name="cloud-arrow-down" class="fa-fw fa-4x"></iconpark-icon>');
            $('#file_messenger_msg').removeClass('display-4');
            $('#file_messenger > div').removeClass('shadow').removeClass('card');
            $('#file_messenger_msg').html('请复制链接后，在外部浏览器打开进行下载。');
            $('#file_skeleton').hide();
            $('#file_messenger').show();
            $('#file_loading_box').hide();
            $('.mobile-footer').hide();
            if (typeof TL !== 'undefined' && typeof TL.ga === 'function') {
                TL.ga('weixinUnavailable');
            }
            return false;
        }

        const params = (typeof get_url_params === 'function') ? get_url_params() : {};
        if (!params.ukey) {
            $('#file_messenger_icon').html('<iconpark-icon name="folder-xmark" class="fa-fw fa-4x"></iconpark-icon>');
            $('#file_messenger_msg').html(app?.languageData?.file_unavailable || 'File unavailable');
            $('#file_skeleton').hide();
            $('#file_messenger').show();
            $('#file_box').hide();
            $('.mobile-footer').hide();
            return false;
        }
        
        let rsp;
        if (typeof TL !== 'undefined' && typeof TL.file_get_details === 'function') {
            rsp = await TL.file_get_details(params.ukey);
        } else {
            console.error('[FilePageController] TL (tmplink_api) not available');
            rsp = { status: 0, error: 'api_not_available' };
        }

        $('#top_loggo').attr('src', '/img/ico/logo-new.svg').show();
        // 隐藏骨架屏和加载框
        $('#file_skeleton').hide();
        $('#file_loading_box').hide();

        if (rsp && rsp.status === 1) {
            const fileinfo = rsp.data;
            this.currentFileDetails = fileinfo;

            $('#file_messenger').hide();
            if (typeof TL !== 'undefined' && typeof TL.ga === 'function') {
                TL.ga('D-' + fileinfo.name);
            }

            $('#file_box').show();
            $('.mobile-footer').show();
            
            // 模板已加载，重新初始化 DOM 缓存
            this.initDOMCache();
            
            $('#filename').html(fileinfo.name);
            $('#filesize').html(fileinfo.size);

            if (fileinfo.ui_publish === 'yes' && fileinfo.ui_publish_status === 'ok' && fileinfo.ui_pro === 'yes') {
                $('.userinfo_avatar').show();
                if ($('.userinfo_avatar_img').length > 0) {
                    $('#top_loggo').hide();
                }
                const avatarURL = `https://tmp-static.vx-cdn.com/static/avatar?id=${fileinfo.ui_avatar_id}`;
                const img = new Image();
                img.src = avatarURL;
                img.onload = () => {
                    $('.userinfo_avatar_img').attr('src', avatarURL);
                    $('.userinfo_avatar_card_img').attr('src', avatarURL);
                };
            }

            if (fileinfo.ui_intro && typeof TL !== 'undefined') {
                TL.current_file_details = fileinfo;
                TL.current_file_details.ui_intro = fileinfo.ui_intro;
            }

            if (fileinfo.nsfw === true) {
                $('#nsfw_alert').show();
            }

            if (fileinfo.ui_publish === 'yes' && fileinfo.ui_publish_status === 'ok') {
                if (fileinfo.ui_pro === 'yes') {
                    $('.userinfo_pro').show();
                } else {
                    $('.userinfo_sd').show();
                }
                $('.userinfo').show();
                $('.userinfo_nickname').html(fileinfo.ui_nickname);
            }

            if (typeof TL !== 'undefined' && typeof TL.fileicon === 'function') {
                const icon = TL.fileicon(fileinfo.type);
                $('#file-icon').attr('name', icon);
            }

            document.title = fileinfo.name;

            if (!this.isMobileContext()) {
                $('#likes').off('click').on('click', async () => {
                    if (typeof TL !== 'undefined' && typeof TL.file_like === 'function') {
                        const likeRsp = await TL.file_like(params.ukey);
                        let now = parseInt($('#likes_count').html()) || 0;
                        if (likeRsp && likeRsp.status === 1) {
                            $('#likes_count').html(now + 1);
                        } else {
                            $('#likes_count').html(Math.max(0, now - 1));
                        }
                    }
                });
            }
            $('#likes_count').html(fileinfo.like);

            if (fileinfo.hot == 1) {
                $('.hot-flag').show();
            }

            if (fileinfo.model !== '99') {
                $('#lefttime_show').show();
                if (typeof countDown === 'function') {
                    countDown('lefttime', fileinfo.lefttime_s, (typeof TL !== 'undefined' ? TL.currentLanguage : 'cn'));
                }
            } else {
                $('#lefttime_show').hide();
            }

            $('#report_ukey').html(params.ukey);

            if (typeof TL !== 'undefined' && TL.logined) {
                $('.user-nologin').hide();
                $('.user-login').show();
            } else {
                $('.user-nologin').show();
                $('.user-login').hide();
            }

            this.updateHighSpeedStatus('ready');

            const domain = (typeof TL !== 'undefined' && TL.site_domain) ? TL.site_domain : window.location.host;
            const shareUrl = `https://${domain}/f/${params.ukey}`;

            if (typeof QRCode !== 'undefined') {
                const qrDom = document.getElementById('qr_code_url');
                if (qrDom) {
                    qrDom.innerHTML = '';
                    new QRCode(qrDom, shareUrl);
                    $('#qr_code_url img').css('margin', 'auto');
                }
            }

            $('.btn_copy_fileurl').attr('data-clipboard-text', shareUrl);
            $('.file_ukey').attr('data-clipboard-text', params.ukey);

            $('.btn_copy_downloadurl_for_wget').off('click').on('click', () => {
                this.copyDownloadOption('wget', params.ukey, fileinfo.name);
            });
            $('.btn_copy_downloadurl_for_other').off('click').on('click', () => {
                this.copyDownloadOption('other', params.ukey, fileinfo.name);
            });
            $('.btn_copy_downloadurl_for_curl').off('click').on('click', () => {
                this.copyDownloadOption('curl', params.ukey, fileinfo.name);
            });

            if (typeof TL !== 'undefined' && fileinfo.owner != TL.uid) {
                $('#downloadAlert').fadeIn();
            }

            const downloadHandler = () => {
                if (typeof TL !== 'undefined' && TL.sponsor) {
                    this.updateHighSpeedStatus('enhanced');
                }

                if (typeof window.filePage !== 'undefined') {
                    const getDownloadUrl = async () => {
                        if (typeof TL !== 'undefined' && typeof TL.file_download_url === 'function') {
                            return TL.file_download_url(params.ukey, fileinfo.name);
                        }
                        throw new Error('download api unavailable');
                    };

                    window.filePage.handleDownload({
                        ukey: params.ukey,
                        filename: fileinfo.name,
                        mode: 'fast'
                    }, getDownloadUrl).catch(err => {
                        if (typeof TL !== 'undefined' && typeof TL.alert === 'function') {
                            TL.alert(err.message || app.languageData.status_file_2);
                        } else {
                            alert(err.message || app.languageData.status_file_2);
                        }
                    });
                }
            };

            $('#file_download_btn_fast').off('click').on('click', downloadHandler);

            $('#file_download_by_qrcode').off('click').on('click', () => {
                // 生成二维码
                const qrContainer = document.getElementById('qr_code_url');
                if (qrContainer && typeof QRCode !== 'undefined') {
                    qrContainer.innerHTML = '';
                    new QRCode(qrContainer, {
                        text: window.location.href,
                        width: 200,
                        height: 200
                    });
                }
                fileUI.openModal('qrModal');
                return true;
            });

            if (typeof TL !== 'undefined' && TL.stream && typeof TL.stream.allow === 'function') {
                if (TL.stream.allow(fileinfo.name, fileinfo.owner) || TL.stream.checkForOpenOnApps(fileinfo.name, fileinfo.owner)) {
                    $('.btn_play').show();
                    if (TL.stream.allow(fileinfo.name, fileinfo.owner)) {
                        $('.play_on_browser').attr('onclick', `TL.stream.request('${params.ukey}','web')`);
                        $('.play_on_browser').show();
                    }
                    if (TL.stream.checkForOpenOnApps(fileinfo.name, fileinfo.owner)) {
                        $('.play_on_potplayer').attr('onclick', `TL.stream.request('${params.ukey}','potplayer')`);
                        $('.play_on_potplayer').show();
                        $('.play_on_iina').attr('onclick', `TL.stream.request('${params.ukey}','iina')`);
                        $('.play_on_iina').show();
                        $('.play_on_nplayer').attr('onclick', `TL.stream.request('${params.ukey}','nplayer')`);
                        $('.play_on_nplayer').show();
                        $('.play_copy_url').attr('onclick', `TL.stream.request('${params.ukey}','copy')`);
                        $('.play_copy_url').show();
                    }
                    $('#btn_highdownload').hide();
                }
            }

            $('#btn_add_to_workspace').off('click').on('click', async () => {
                if (typeof TL !== 'undefined' && TL.logined == 1) {
                    $('#btn_add_to_workspace_icon iconpark-icon').attr('name', 'circle-check').css('color', '#22c55e');
                    if (typeof TL.file_add_to_workspace === 'function') {
                        await TL.file_add_to_workspace(params.ukey);
                    }
                    $('#btn_add_to_workspace').off('click');
                } else {
                    localStorage.setItem('return_page', getCurrentURL());
                    app.open('/app&listview=login');
                }
            });

            $('#btn_highdownload').off('click').on('click', () => {
                fileUI.openModal('upupModal');
            });

            $('#btn_report_file').off('click').on('click', () => {
                fileUI.openModal('reportModal');
            });

            if (typeof TL !== 'undefined' && typeof TL.file_preload_download_url === 'function') {
                TL.file_preload_download_url(params.ukey, fileinfo.name);
            }

            $('#file_loading').fadeOut(100);
            $('#file_op').fadeIn(300);
            return true;
        }

        if (rsp && rsp.status === 3) {
            $('#file_messenger_icon').html('<iconpark-icon name="shield-keyhole" class="fa-fw fa-7x"></iconpark-icon>');
            $('#file_messenger_msg').html(app.languageData.status_need_login);
            $('#file_messenger_msg_login').show();
            $('#file_messenger').show();
            if (typeof TL !== 'undefined' && typeof TL.ga === 'function') {
                TL.ga(`Any-[${params.ukey}]`);
            }
            localStorage.setItem('return_page', getCurrentURL());
            return false;
        }

        if (rsp && rsp.status === 2) {
            $('#file_messenger_icon').html('<img src="/img/loading.svg" height="80"  />');
            $('#file_messenger_msg').html(app.languageData.upload_sync_onprogress);
            $('#file_messenger').show();
            if (typeof TL !== 'undefined' && typeof TL.ga === 'function') {
                TL.ga(`Sync-[${params.ukey}]`);
            }
            setTimeout(() => {
                this.loadFileDetails();
            }, 60000);
            return false;
        }

        if (rsp && rsp.status === 4) {
            $('#file_messenger_icon').html('<iconpark-icon name="earth-asia" class="fa-fw fa-7x"></iconpark-icon>');
            $('#file_messenger_msg').html(app.languageData.status_area);
            $('#file_messenger').show();
            $('#file_box').hide();
            $('.mobile-footer').hide();
            if (typeof TL !== 'undefined' && typeof TL.ga === 'function') {
                TL.ga(`Area-[${params.ukey}]`);
            }
            return false;
        }

        if (rsp && rsp.status === 5) {
            $('#file_messenger_icon').html('<iconpark-icon name="lock" class="fa-fw fa-7x"></iconpark-icon>');
            $('#file_messenger_msg').html(app.languageData.file_private);
            $('#file_messenger').show();
            $('#file_box').hide();
            $('.mobile-footer').hide();
            if (typeof TL !== 'undefined' && typeof TL.ga === 'function') {
                TL.ga(`Private-[${params.ukey}]`);
            }
            return false;
        }

        // 处理网络错误或 API 未准备好的情况
        if (rsp && rsp.error === 'network_error') {
            $('#file_messenger_icon').html('<iconpark-icon name="wifi-slash" class="fa-fw fa-4x"></iconpark-icon>');
            $('#file_messenger_msg').html(app?.languageData?.network_error || '网络连接失败，请刷新页面重试');
            $('#file_messenger').show();
            $('#file_box').hide();
            $('.mobile-footer').hide();
            console.error('[FilePageController] Network error when loading file details');
            return false;
        }
        
        if (rsp && rsp.error === 'api_not_available') {
            $('#file_messenger_icon').html('<iconpark-icon name="circle-exclamation" class="fa-fw fa-4x"></iconpark-icon>');
            $('#file_messenger_msg').html(app?.languageData?.api_error || '服务暂时不可用，请稍后重试');
            $('#file_messenger').show();
            $('#file_box').hide();
            $('.mobile-footer').hide();
            console.error('[FilePageController] API not available');
            return false;
        }

        $('#file_messenger_icon').html('<iconpark-icon name="folder-xmark" class="fa-fw fa-4x"></iconpark-icon>');
        $('#file_messenger_msg').html(app.languageData.file_unavailable);
        $('#file_messenger').show();
        $('#file_box').hide();
        $('.mobile-footer').hide();
        if (typeof TL !== 'undefined' && typeof TL.ga === 'function') {
            TL.ga(`Unavailable-[${params.ukey}]`);
        }
        return false;
    }

    updateHighSpeedStatus(status) {
        const $title = $('.hs-model-title');
        const currentText = $title.html();
        if (status === 'ready') {
            if (currentText !== app.languageData.hs_ready) {
                $('.hs-model').fadeOut(() => {
                    $title.html(app.languageData.hs_ready);
                    $('.hs-model').fadeIn();
                    $('.hs-model').addClass('text-blue');
                });
            }
        }
        if (status === 'enhanced') {
            if (currentText !== app.languageData.hs_enhanced) {
                $('.hs-model').fadeOut(() => {
                    if (currentText === app.languageData.hs_ready) {
                        $('.hs-model').removeClass('text-blue');
                    }
                    $title.html(app.languageData.hs_enhanced);
                    $('.hs-model').fadeIn();
                    $('.hs-model').addClass('text-green');
                });
            }
        }
    }

    async copyDownloadOption(type, ukey, filename) {
        $('#file_btn_download_opt').html('<img src="/img/loading-outline.svg" class="fa-fw"/>');

        let url = null;
        if (typeof TL !== 'undefined' && TL.current_file_download_url) {
            url = TL.current_file_download_url;
        } else if (typeof TL !== 'undefined' && typeof TL.file_download_url === 'function') {
            url = await TL.file_download_url(ukey, filename);
        }

        if (!url) {
            if (typeof TL !== 'undefined' && typeof TL.alert === 'function') {
                TL.alert(app.languageData.status_file_2);
            }
            $('#file_btn_download_opt').html(app.languageData.file_btn_download_opt);
            return;
        }

        let content = '';
        if (type === 'other') {
            content = url;
        } else if (type === 'curl') {
            content = TL.current_file_curl_command || `curl -Lo "${filename}" ${url}`;
        } else if (type === 'wget') {
            content = TL.current_file_wget_command || `wget -O "${filename}" ${url}`;
        }

        try {
            if (typeof copyToClip === 'function') {
                await copyToClip(content);
            }
            setTimeout(() => {
                $('#file_btn_download_opt').html(app.languageData.file_btn_download_opt);
            }, 3000);
        } catch (e) {
            $('#file_btn_download_opt').html(app.languageData.file_btn_download_opt);
        }
    }

    copyShareUrl() {
        const params = (typeof get_url_params === 'function') ? get_url_params() : {};
        const domain = (typeof TL !== 'undefined' && TL.site_domain) ? TL.site_domain : window.location.host;
        const shareUrl = `https://${domain}/f/${params.ukey}`;

        if (typeof copyToClip !== 'function') return;

        copyToClip(shareUrl).then(() => {
            const $icon = $('#btn_copy_fileurl_icon iconpark-icon');
            const originalName = $icon.attr('name');
            $icon.attr('name', 'circle-check').css('color', '#22c55e');
            setTimeout(() => {
                $icon.attr('name', originalName).css('color', '');
            }, 3000);
        }).catch(() => {
            // ignore
        });
    }

    async reportFile() {
        const ukey = $('#report_ukey').html();
        const reason = $('#report_model').val();
        $('#reportbtn').attr('disabled', true);
        $('#reportbtn').html(`<span class="text-red">${app.languageData.form_btn_processed}</span>`);

        if (typeof TL !== 'undefined' && typeof TL.file_report === 'function') {
            await TL.file_report(ukey, reason);
        }

        $('#reportbtn').html(app.languageData.form_btn_processed);
    }

    openInMenubarXofIndex() {
        const domain = (typeof TL !== 'undefined' && TL.site_domain) ? TL.site_domain : window.location.host;
        this.openInMenubarX(`https://${domain}/?s=mx`);
    }

    openInMenubarXofFile() {
        const params = (typeof get_url_params === 'function') ? get_url_params() : {};
        const domain = (typeof TL !== 'undefined' && TL.site_domain) ? TL.site_domain : window.location.host;
        this.openInMenubarX(`https://${domain}/f/${params.ukey}`);
    }

    openInMenubarX(link) {
        const openlink = `https://menubarx.app/open/?xurl=${link}&xwidth=375&xheight=677&xbar=0`;
        window.location.href = openlink;
    }

    isWeixin() {
        const ua = navigator.userAgent.toLowerCase();
        return ua.match(/MicroMessenger/i) == "micromessenger";
    }

    // ========== 进度 UI 控制 ==========

    showProgress() {
        if (this.$progressContainer) {
            this.$progressContainer.style.display = 'flex';
            this.$progressContainer.classList.add('is-active');
        }
        if (this.$downloadBtn) {
            this.$downloadBtn.classList.add('download-btn-progress-active');
            this.$downloadBtn.setAttribute('aria-busy', 'true');
        }
    }

    hideProgress() {
        if (this.$progressContainer) {
            this.$progressContainer.style.display = 'none';
            this.$progressContainer.classList.remove('is-active');
        }
        if (this.$downloadBtn) {
            this.$downloadBtn.classList.remove('download-btn-progress-active', 'is-loading');
            this.$downloadBtn.removeAttribute('aria-busy');
        }
        if (this.$progressFill) {
            this.$progressFill.style.width = '0%';
            this.$progressFill.classList.remove('bg-warning');
        }
        this.updateSpeedDisplay(0);
        this.updateProgressDisplay(0, 0);
    }

    updateProgressFill(percent) {
        if (this.$progressFill) {
            this.$progressFill.style.width = `${percent}%`;
        }
    }

    updateSpeedDisplay(bytesPerSecond) {
        if (this.$downloadSpeed) {
            this.$downloadSpeed.textContent = `${this.formatBytes(bytesPerSecond)}/s`;
        }
    }

    updateProgressDisplay(loaded, total) {
        if (this.$downloadProgress) {
            this.$downloadProgress.textContent = `${this.formatBytes(loaded)} / ${this.formatBytes(total)}`;
        }
    }

    updateButtonText(text) {
        const $textEl = this.$downloadBtn?.querySelector('.download-btn-text');
        if ($textEl) {
            $textEl.innerHTML = text;
        }
    }

    setButtonLoading(isLoading) {
        if (this.$downloadBtn) {
            this.$downloadBtn.classList.toggle('is-loading', isLoading);
            this.$downloadBtn.disabled = isLoading;
        }
    }

    setProgressWarning(isWarning) {
        if (this.$progressFill) {
            this.$progressFill.classList.toggle('bg-warning', isWarning);
        }
    }

    // ========== 多线程下载核心 ==========

    async startMultiThreadDownload(url, filename) {
        if (this.fastDownloadInProgress) {
            console.warn('[FilePageController] Download already in progress');
            return false;
        }

        this.fastDownloadInProgress = true;

        try {
            // 获取文件大小
            console.log('[FilePageController] Fetching HEAD for:', url);
            const headResponse = await fetch(url, { method: 'HEAD' });
            console.log('[FilePageController] HEAD response status:', headResponse.status, 'ok:', headResponse.ok);
            
            if (!headResponse.ok) {
                console.log('[FilePageController] HEAD request failed, falling back');
                return this.fallbackDownload(url);
            }

            this.totalSize = parseInt(headResponse.headers.get('content-length'));
            console.log('[FilePageController] Content-Length:', this.totalSize);
            
            if (!Number.isFinite(this.totalSize) || this.totalSize <= 0) {
                console.log('[FilePageController] Invalid content-length, falling back');
                return this.fallbackDownload(url, true);
            }

            // 小文件直接下载
            if (this.totalSize < FilePageController.SMALL_FILE_THRESHOLD) {
                console.log(`[FilePageController] Small file (${this.formatBytes(this.totalSize)} < ${this.formatBytes(FilePageController.SMALL_FILE_THRESHOLD)}), using direct download`);
                return this.fallbackDownload(url, true);
            }

            // 服务器已确认支持 Range 请求，直接进行分片下载
            console.log('[FilePageController] Starting chunked download for', this.formatBytes(this.totalSize));

            // 计算分块
            const chunkSize = FilePageController.CHUNK_SIZE;
            const numberOfChunks = Math.ceil(this.totalSize / chunkSize);

            // 初始化下载状态
            this.initDownloadState(numberOfChunks);
            this.showProgress();

            // 创建下载任务
            const downloadTasks = Array.from({ length: numberOfChunks }, (_, i) => {
                const start = i * chunkSize;
                const end = i === numberOfChunks - 1 
                    ? this.totalSize - 1 
                    : Math.min(start + chunkSize - 1, this.totalSize - 1);
                return { index: i, start, end, expectedSize: end - start + 1 };
            });

            // 启动速度计算
            this.startSpeedCalculator();

            // 下载所有块
            const chunks = new Array(numberOfChunks);
            const queue = [...downloadTasks];
            const activeDownloads = [];

            while (queue.length > 0 || activeDownloads.length > 0) {
                while (activeDownloads.length < FilePageController.MAX_CONCURRENT_DOWNLOADS && queue.length > 0) {
                    const task = queue.shift();
                    const downloadPromise = this.downloadChunk(url, task.index, task.start, task.end, task.expectedSize)
                        .then(chunk => {
                            chunks[task.index] = chunk;
                            const idx = activeDownloads.indexOf(downloadPromise);
                            if (idx !== -1) activeDownloads.splice(idx, 1);
                            return chunk;
                        });
                    activeDownloads.push(downloadPromise);
                }
                if (activeDownloads.length > 0) {
                    await Promise.race(activeDownloads);
                }
            }

            // 验证完整性
            let totalReceived = 0;
            chunks.forEach((chunk, i) => {
                const task = downloadTasks[i];
                if (chunk.byteLength !== task.expectedSize) {
                    throw new Error(`Chunk ${i} size mismatch`);
                }
                totalReceived += chunk.byteLength;
            });

            if (totalReceived !== this.totalSize) {
                throw new Error(`Total size mismatch: expected ${this.totalSize}, got ${totalReceived}`);
            }

            // 合并并触发下载
            const blob = new Blob(chunks, { 
                type: headResponse.headers.get('content-type') || 'application/octet-stream' 
            });
            this.triggerBlobDownload(blob, filename);

            this.cleanupDownload();
            return true;

        } catch (error) {
            console.error('[FilePageController] Multi-thread download failed:', error);
            this.cleanupDownload();
            return this.fallbackDownload(url);
        } finally {
            this.fastDownloadInProgress = false;
        }
    }

    async probeRangeSupport(url) {
        return new Promise(resolve => {
            let resolved = false;
            const finish = (value, reason) => {
                if (resolved) return;
                resolved = true;
                console.log('[FilePageController] probeRangeSupport finish:', value, 'reason:', reason);
                resolve(value);
            };

            try {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.responseType = 'arraybuffer';
                xhr.timeout = 5000;
                xhr.setRequestHeader('Range', 'bytes=0-0');

                xhr.onreadystatechange = () => {
                    console.log('[FilePageController] probeRangeSupport readyState:', xhr.readyState, 'status:', xhr.status);
                    if (xhr.readyState === 2) {
                        const ok = xhr.status === 206;
                        try { xhr.abort(); } catch (e) { /* ignore */ }
                        finish(ok, `status=${xhr.status}`);
                    }
                };
                xhr.onerror = (e) => {
                    console.log('[FilePageController] probeRangeSupport onerror:', e);
                    finish(false, 'onerror');
                };
                xhr.ontimeout = () => {
                    console.log('[FilePageController] probeRangeSupport ontimeout');
                    finish(false, 'timeout');
                };
                xhr.onabort = () => { if (!resolved) finish(false); };
                xhr.send();
            } catch (e) {
                finish(false);
            }
        });
    }

    initDownloadState(numChunks) {
        this.chunks = [];
        this.downloadedBytes = 0;
        this.lastTotalBytes = 0;
        this.lastSpeedUpdate = Date.now();
        this.threads = new Array(numChunks).fill(null).map(() => ({ loaded: 0, hasWarning: false }));
        this.multiThreadActive = true;
    }

    downloadChunk(url, index, start, end, expectedSize, retryCount = 0) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            this.threads[index] = { ...this.threads[index], xhr, loaded: 0 };

            xhr.open('GET', url);
            xhr.responseType = 'arraybuffer';
            xhr.setRequestHeader('Range', `bytes=${start}-${end}`);

            xhr.onprogress = (event) => {
                if (this.multiThreadActive) {
                    this.updateChunkProgress(index, event.loaded);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 206) {
                    const chunk = xhr.response;
                    if (chunk.byteLength !== expectedSize) {
                        if (retryCount < FilePageController.MAX_CHUNK_RETRY) {
                            this.setChunkWarning(index, true);
                            setTimeout(() => {
                                this.downloadChunk(url, index, start, end, expectedSize, retryCount + 1)
                                    .then(resolve).catch(reject);
                            }, 1000);
                            return;
                        }
                        reject(new Error(`Chunk ${index} size mismatch after retries`));
                        return;
                    }
                    this.setChunkWarning(index, false);
                    resolve(chunk);
                } else {
                    this.retryOrReject(url, index, start, end, expectedSize, retryCount, resolve, reject, 
                        `HTTP ${xhr.status}`);
                }
            };

            xhr.onerror = () => this.retryOrReject(url, index, start, end, expectedSize, retryCount, resolve, reject, 'Network error');
            xhr.ontimeout = () => this.retryOrReject(url, index, start, end, expectedSize, retryCount, resolve, reject, 'Timeout');

            xhr.send();
        });
    }

    retryOrReject(url, index, start, end, expectedSize, retryCount, resolve, reject, reason) {
        if (retryCount < FilePageController.MAX_CHUNK_RETRY) {
            console.warn(`[FilePageController] Chunk ${index} failed (${reason}), retrying...`);
            this.setChunkWarning(index, true);
            setTimeout(() => {
                this.downloadChunk(url, index, start, end, expectedSize, retryCount + 1)
                    .then(resolve).catch(reject);
            }, 1000);
        } else {
            reject(new Error(`Chunk ${index} failed after ${FilePageController.MAX_CHUNK_RETRY} retries: ${reason}`));
        }
    }

    updateChunkProgress(index, loaded) {
        if (this.threads[index]) {
            this.threads[index].loaded = loaded;
        }

        this.downloadedBytes = this.threads.reduce((sum, t) => sum + (t?.loaded || 0), 0);
        const percent = (this.downloadedBytes / this.totalSize) * 100;

        this.updateProgressFill(percent);
        this.updateProgressDisplay(this.downloadedBytes, this.totalSize);

        // 检查是否有警告状态
        const hasWarning = this.threads.some(t => t?.hasWarning);
        this.setProgressWarning(hasWarning);
    }

    setChunkWarning(index, isWarning) {
        if (this.threads[index]) {
            this.threads[index].hasWarning = isWarning;
        }
        const hasAnyWarning = this.threads.some(t => t?.hasWarning);
        this.setProgressWarning(hasAnyWarning);
    }

    startSpeedCalculator() {
        this.lastSpeedUpdate = Date.now();
        this.lastTotalBytes = 0;

        this.speedInterval = setInterval(() => {
            if (!this.multiThreadActive) {
                clearInterval(this.speedInterval);
                return;
            }

            const now = Date.now();
            const timeDiff = (now - this.lastSpeedUpdate) / 1000;
            const bytesIncrement = this.downloadedBytes - this.lastTotalBytes;
            const speed = timeDiff > 0 ? bytesIncrement / timeDiff : 0;

            this.updateSpeedDisplay(speed);

            this.lastSpeedUpdate = now;
            this.lastTotalBytes = this.downloadedBytes;
        }, 1000);
    }

    triggerBlobDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    fallbackDownload(url, showFeedback = false) {
        console.log('[FilePageController] Falling back to direct download');
        
        // 先清理下载状态
        this.cleanupDownload();
        
        // 如果需要显示反馈（小文件下载），在清理之后显示
        if (showFeedback) {
            this.showDownloadFeedback();
        }
        
        window.location.href = url;
        return true;
    }

    /**
     * 显示下载开始的视觉反馈
     */
    showDownloadFeedback() {
        console.log('[FilePageController] Showing download feedback');
        
        // 重新获取按钮元素（因为模板可能在 init 之后加载）
        const $btn = this.$downloadBtn || document.getElementById('file_download_btn_fast');
        
        if ($btn) {
            console.log('[FilePageController] Button found, adding download-started class');
            $btn.classList.add('download-started');
            $btn.disabled = false;
            
            // 更新按钮文字
            const $textEl = $btn.querySelector('.download-btn-text');
            if ($textEl) {
                $textEl.textContent = app?.languageData?.download_started || '下载已开始';
            }
            
            // 3秒后恢复
            setTimeout(() => {
                $btn.classList.remove('download-started');
                const $text = $btn.querySelector('.download-btn-text');
                if ($text) {
                    $text.textContent = app?.languageData?.file_btn_download_fast || '高速下载';
                }
            }, 3000);
        } else {
            console.log('[FilePageController] Button not found!');
        }
    }

    cleanupDownload() {
        this.multiThreadActive = false;
        
        // 中止所有进行中的请求
        this.threads.forEach(t => {
            if (t?.xhr?.abort) {
                try { t.xhr.abort(); } catch (e) { /* ignore */ }
            }
        });

        // 清除速度计算定时器
        if (this.speedInterval) {
            clearInterval(this.speedInterval);
            this.speedInterval = null;
        }

        // 重置状态
        this.threads = [];
        this.chunks = [];
        this.downloadedBytes = 0;
        this.lastTotalBytes = 0;
        this.totalSize = 0;

        // 隐藏进度
        this.hideProgress();

        // 恢复按钮状态
        this.setButtonLoading(false);
        if (typeof app !== 'undefined' && app.languageData) {
            this.updateButtonText(app.languageData.file_btn_download_fast || '高速下载');
        }
    }

    abortDownload() {
        this.cleanupDownload();
    }

    // ========== 公共下载入口（供 tmplink.js 调用） ==========

    /**
     * 处理文件下载（需要先获取下载链接）
     * @param {Object} params - { ukey, filename, mode }
     * @param {Function} getDownloadUrl - 异步获取下载链接的函数
     */
    async handleDownload(params, getDownloadUrl) {
        const { filename, mode } = params;

        try {
            this.setButtonLoading(true);
            this.updateButtonText(app?.languageData?.download_preparing || '准备中...');

            const url = await getDownloadUrl();
            if (!url) {
                throw new Error('Failed to get download URL');
            }

            // 对于快速下载模式，直接尝试多线程下载
            // startMultiThreadDownload 内部会自行检测文件大小和 Range 支持，失败则自动回退
            if (mode === 'fast') {
                if (this.isMobileContext()) {
                    // 移动端也显示下载开始反馈
                    this.setButtonLoading(false);
                    this.showDownloadFeedback();
                    window.location.href = url;
                    return true;
                }
                console.log('[FilePageController] Fast mode: attempting multi-thread download');
                // 立即恢复按钮状态，避免长时间显示 loading
                this.setButtonLoading(false);
                
                const success = await this.startMultiThreadDownload(url, filename);
                if (success) {
                    return true;
                }
                // startMultiThreadDownload 返回 false 或内部已触发 fallbackDownload
                // 如果到这里说明已经处理完毕
                return true;
            }

            // 小文件、普通模式或 HEAD 失败：直接下载
            window.location.href = url;
            setTimeout(() => {
                this.setButtonLoading(false);
                this.updateButtonText(app?.languageData?.file_btn_download_fast || '高速下载');
            }, 3000);

            return true;

        } catch (error) {
            console.error('[FilePageController] Download failed:', error);
            this.cleanupDownload();
            throw error;
        }
    }

    /**
     * 直接使用已知 URL 下载（跳过 API 请求）
     * @param {string} url - 下载链接
     * @param {string} filename - 文件名
     * @param {string} mode - 'fast' | 'normal'
     */
    async startDirectDownload(url, filename, mode = 'fast') {
        try {
            this.setButtonLoading(true);
            this.updateButtonText('<img src="/img/loading-outline.svg" style="height:1.2em"/>');

            if (mode === 'fast') {
                if (this.isMobileContext()) {
                    window.location.href = url;
                    setTimeout(() => {
                        this.setButtonLoading(false);
                        this.updateButtonText(app?.languageData?.file_btn_download_fast || '高速下载');
                    }, 3000);
                    return true;
                }
                const headResponse = await fetch(url, { method: 'HEAD' });
                if (headResponse.ok) {
                    const fileSize = parseInt(headResponse.headers.get('content-length'));
                    if (Number.isFinite(fileSize) && fileSize >= FilePageController.SMALL_FILE_THRESHOLD) {
                        await this.startMultiThreadDownload(url, filename);
                        return true;
                    }
                }
            }

            window.location.href = url;
            setTimeout(() => {
                this.setButtonLoading(false);
                this.updateButtonText(app?.languageData?.file_btn_download_fast || '高速下载');
            }, 3000);

            return true;

        } catch (error) {
            console.error('[FilePageController] Direct download failed:', error);
            this.cleanupDownload();
            window.location.href = url; // 回退
            return true;
        }
    }

    // ========== 工具方法 ==========

    formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// ========== 全局实例 ==========
const filePage = new FilePageController();

// DOM Ready 后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => filePage.init());
} else {
    filePage.init();
}

// ========== 纯 CSS UI 控制器 (替代 Bootstrap) ==========
const fileUI = {
    /**
     * 切换下拉菜单显示状态
     * @param {HTMLElement} toggleBtn - 触发按钮
     */
    toggleDropdown(toggleBtn) {
        const dropdown = toggleBtn.closest('.file-dropdown');
        if (!dropdown) return;

        const isOpen = dropdown.classList.contains('open');
        
        // 先关闭所有其他下拉菜单
        this.closeDropdowns();
        
        // 切换当前下拉菜单
        if (!isOpen) {
            dropdown.classList.add('open');
            // 添加点击外部关闭的监听
            setTimeout(() => {
                document.addEventListener('click', this._outsideClickHandler);
            }, 0);
        }
    },

    /**
     * 关闭所有下拉菜单
     */
    closeDropdowns() {
        document.querySelectorAll('.file-dropdown.open').forEach(el => {
            el.classList.remove('open');
        });
        document.removeEventListener('click', this._outsideClickHandler);
    },

    /**
     * 点击外部关闭下拉菜单的处理器
     */
    _outsideClickHandler(e) {
        if (!e.target.closest('.file-dropdown')) {
            fileUI.closeDropdowns();
        }
    },

    /**
     * 打开模态框
     * @param {string} modalId - 模态框 ID
     */
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
        
        // ESC 键关闭
        document.addEventListener('keydown', this._escKeyHandler);
        
        // 点击背景关闭
        modal.addEventListener('click', this._modalBackdropHandler);
    },

    /**
     * 关闭模态框
     * @param {string} modalId - 模态框 ID
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        modal.classList.remove('open');
        document.body.style.overflow = '';
        
        document.removeEventListener('keydown', this._escKeyHandler);
        modal.removeEventListener('click', this._modalBackdropHandler);
    },

    /**
     * ESC 键关闭模态框
     */
    _escKeyHandler(e) {
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.file-modal.open');
            if (openModal) {
                fileUI.closeModal(openModal.id);
            }
        }
    },

    /**
     * 点击背景关闭模态框
     */
    _modalBackdropHandler(e) {
        if (e.target.classList.contains('file-modal')) {
            fileUI.closeModal(e.target.id);
        }
    }
};

// 暴露给全局
window.filePage = filePage;
window.FilePageController = FilePageController;
window.fileUI = fileUI;
