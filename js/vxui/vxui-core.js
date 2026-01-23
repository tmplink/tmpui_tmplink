/**
 * VXUI Core Framework
 * 新一代后台框架核心 - 无 Bootstrap 依赖
 * @author VXUI Team
 * @version 1.0.0
 */

'use strict';

function attachTmplinkUiCompat() {
    if (typeof TL === 'undefined' || !TL) return;

    if (typeof TL.alert !== 'function') {
        TL.alert = (msg) => {
            if (typeof VXUI !== 'undefined' && VXUI && typeof VXUI.toastError === 'function') {
                VXUI.toastError(msg);
            } else {
                window.alert(msg);
            }
        };
    }

    if (typeof TL.tpl_lang !== 'function') {
        TL.tpl_lang = (root) => {
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
        };
    }

    if (typeof TL.fileicon !== 'function') {
        TL.fileicon = (type) => {
            let r = 'file-lines';
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
                    r = 'file-excel';
                    break;
                case 'ppt':
                case 'pptx':
                    r = 'file-powerpoint';
                    break;
                case 'txt':
                    r = 'file-lines';
                    break;
                case 'mp3':
                case 'wav':
                case 'aac':
                case 'flac':
                case 'ogg':
                case 'm4a':
                    r = 'file-music';
                    break;
                case 'mp4':
                case 'mkv':
                case 'avi':
                case 'mov':
                case 'wmv':
                case 'flv':
                case 'webm':
                    r = 'file-video';
                    break;
                case 'jpg':
                case 'jpeg':
                case 'png':
                case 'gif':
                case 'bmp':
                case 'webp':
                case 'svg':
                    r = 'file-image';
                    break;
                case 'psd':
                    r = 'file-psd';
                    break;
                case 'ai':
                    r = 'file-ai';
                    break;
                case 'apk':
                    r = 'android';
                    break;
                case 'exe':
                    r = 'windows';
                    break;
                case 'dmg':
                case 'ipa':
                    r = 'apple';
                    break;
                case 'torrent':
                    r = 'acorn';
                    break;
            }
            return r;
        };
    }

    if (typeof TL.bulkCopy !== 'function') {
        TL.bulkCopy = async (dom, content, base64) => {
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

                if (typeof TL.profile_bulk_copy_get === 'function' && TL.profile_bulk_copy_get()) {
                    if (TL.bulkCopyTimer) {
                        clearTimeout(TL.bulkCopyTimer);
                        TL.bulkCopyTimer = 0;
                    } else if (typeof $ !== 'undefined' && $.notifi && app && app.languageData) {
                        $.notifi(app.languageData.notify_bulk_copy_start, 'success');
                    }

                    TL.bulkCopyTmp = (TL.bulkCopyTmp || '') + content + ' \n';
                    await doCopy(TL.bulkCopyTmp);

                    TL.bulkCopyTimer = setTimeout(() => {
                        TL.bulkCopyTimer = 0;
                        TL.bulkCopyTmp = '';
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
        };
    }

    if (typeof TL.workspace_del !== 'function') {
        TL.workspace_del = (ukey) => {
            $.post(TL.api_file, {
                action: 'remove_from_workspace',
                token: TL.api_token,
                ukey: ukey
            }, 'json');
        };
    }

    if (typeof TL.download_direct !== 'function') {
        TL.download_direct = (ukey) => {
            TL.recaptcha_do('download_req', (recaptcha) => {
                $.post(TL.api_file, {
                    action: 'download_req',
                    ukey: ukey,
                    token: TL.api_token,
                    captcha: recaptcha
                }, (req) => {
                    if (req.status == 1) {
                        window.location.href = req.data;
                        return true;
                    }
                    if (req.status == 3) {
                        TL.alert(app.languageData.status_need_login);
                        return false;
                    }
                    TL.alert(app.languageData.status_error_0);
                });
            });
        };
    }

    if (typeof TL.previewModel !== 'function') {
        TL.previewModel = (ukey, name, id, sid, sha1, ftype) => {
            if (!sid || !sha1) {
                TL.alert((app && app.languageData && app.languageData.status_error_0) || '无法预览');
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
        };
    }
}

/**
 * VXUI 核心类
 */
class VXUICore {
    constructor() {
        // 版本
        this.version = '1.0.0';
        
        // 当前模块
        this.currentModule = null;
        
        // 已注册的模块
        this.modules = new Map();
        
        // 侧边栏状态
        this.sidebarOpen = false;
        this.sidebarCollapsed = false;

        // 侧边栏显示模式（抽屉/常驻）
        this.sidebarOverlayMode = false;
        
        // 暗色模式
        this.darkMode = this.getDarkModePreference();
        
        // 已加载的模板
        this.loadedTemplates = new Map();
        
        // Toast 队列
        this.toastQueue = [];
        
        // 当前打开的模态框
        this.openModals = [];
        
        // 绑定方法
        this.init = this.init.bind(this);

        // i18n: avoid duplicated concurrent builds
        this._languageReadyPromise = null;
    }

    /**
     * Ensure language pack is loaded (best-effort).
     */
    ensureLanguageReady() {
        if (this._languageReadyPromise) return this._languageReadyPromise;

        // If language data already exists, treat as ready.
        if (typeof app !== 'undefined' && app && app.languageData) {
            this._languageReadyPromise = Promise.resolve();
            return this._languageReadyPromise;
        }

        if (typeof app === 'undefined' || !app || typeof app.languageBuild !== 'function') {
            this._languageReadyPromise = Promise.resolve();
            return this._languageReadyPromise;
        }

        try {
            const ret = app.languageBuild();
            if (ret && typeof ret.then === 'function') {
                this._languageReadyPromise = ret.catch(() => undefined).then(() => undefined);
                return this._languageReadyPromise;
            }
        } catch (e) {
            // ignore
        }

        this._languageReadyPromise = Promise.resolve();
        return this._languageReadyPromise;
    }

    /**
     * Remove sidebar skeleton and show actual content
     */
    removeSidebarSkeleton() {
        const skeleton = document.getElementById('vx-sidebar-skeleton');
        const staticNav = document.getElementById('vx-sidebar-static');
        const bottomNav = document.getElementById('vx-sidebar-bottom-real');

        if (skeleton) {
            skeleton.style.display = 'none';
        }
        if (staticNav) {
            staticNav.style.display = '';
        }
        if (bottomNav) {
            bottomNav.style.display = '';
        }
    }
    
    /**
     * 初始化 VXUI
     */
    init() {
        console.log('[VXUI] Initializing VXUI Core v' + this.version);

        attachTmplinkUiCompat();
        
        // 应用暗色模式
        this.applyDarkMode();
        
        // 监听系统主题变化
        this.listenSystemTheme();
        
        // 绑定全局事件
        this.bindGlobalEvents();

        // 处理竖屏平板等场景：侧边栏使用抽屉模式
        this.applySidebarResponsiveMode();

        // 根据登录状态调整侧边栏导航
        this.applyAuthVisibility();
        
        // 初始化提示框容器
        this.initToastContainer();
        
        // 处理 URL 参数，加载对应模块
        this.handleRoute();
        
        // i18n: ensure language pack ready, then translate
        this.ensureLanguageReady().finally(() => {
            // 初始化语言切换器（VXUI 顶层入口）
            this.initLanguageSwitcher();

            if (typeof TL !== 'undefined' && TL && typeof TL.tpl_lang === 'function') {
                TL.tpl_lang();
            }

            // Show sidebar after translation
            this.removeSidebarSkeleton();
        });
        
        console.log('[VXUI] Core initialized');
    }

    /**
     * 记录 UI 行为（event_ui）
     * @param {string} title
     */
    trackUI(title) {
        try {
            if (!title) return;
            if (typeof TL !== 'undefined' && TL && typeof TL.ga === 'function') {
                TL.ga(title);
            }
        } catch (e) {
            // ignore
        }
    }

    /**
     * 当前是否登录
     */
    isLoggedIn() {
        if (typeof TL !== 'undefined' && TL && typeof TL.isLogin === 'function') {
            try {
                return !!TL.isLogin();
            } catch (e) {
                return false;
            }
        }
        const login = localStorage.getItem('app_login');
        return login !== null && login !== '0' && login !== 0;
    }

    /**
     * 根据登录状态显示/隐藏导航项
     */
    applyAuthVisibility() {
        const loggedIn = this.isLoggedIn();
        document.querySelectorAll('[data-auth="logged-in"]').forEach((el) => {
            el.style.display = loggedIn ? '' : 'none';
        });
        document.querySelectorAll('[data-auth="logged-out"]').forEach((el) => {
            el.style.display = loggedIn ? 'none' : '';
        });

        const layout = document.getElementById('vx-layout');
        if (layout) {
            layout.classList.toggle('vx-logged-in', loggedIn);
            layout.classList.toggle('vx-logged-out', !loggedIn);
        }
    }

    /**
     * 初始化语言切换（sidebar dropdown）
     */
    initLanguageSwitcher() {
        // label is translated via data-tpl="language"; no dynamic language-name label
        if (typeof TL !== 'undefined' && TL && typeof TL.tpl_lang === 'function') {
            const el = document.getElementById('vx-lang-dropdown');
            if (el) TL.tpl_lang(el);
        }
    }

    /**
     * 设置语言（兼容旧版逻辑：优先走 TL.language -> app.languageSet）
     */
    async setLanguage(lang) {
        const nextLang = String(lang || '').toLowerCase();
        if (!nextLang) return;

        // 清除缓存的语言就绪 Promise，强制重新等待新语言包加载
        this._languageReadyPromise = null;

        // 调用 TL.language 或 app.languageSet，并等待语言包加载完成
        let buildPromise = null;
        if (typeof TL !== 'undefined' && TL && typeof TL.language === 'function') {
            // TL.language 内部会调用 app.languageSet，现在它返回 Promise
            TL.language(nextLang);
        } else if (typeof app !== 'undefined' && app && typeof app.languageSet === 'function') {
            buildPromise = app.languageSet(nextLang);
        }

        // 等待语言包加载完成（app.languageSet 现在返回 Promise）
        if (!buildPromise && typeof app !== 'undefined' && app && app.languageBuild) {
            // 如果通过 TL.language 调用，我们需要单独等待 languageBuild
            // 由于 TL.language 内部调用 app.languageSet 已经触发了 languageBuild，
            // 我们需要给一点时间让 languageBuild 开始执行，然后等待它完成
            // 最可靠的方式是重新调用一次 languageBuild（它会检查 localStorage 并加载对应语言包）
            try {
                await app.languageBuild();
            } catch (e) {
                // ignore
            }
        } else if (buildPromise && typeof buildPromise.then === 'function') {
            try {
                await buildPromise;
            } catch (e) {
                // ignore
            }
        }
        
        // 翻译整个页面
        if (typeof TL !== 'undefined' && TL && typeof TL.tpl_lang === 'function') {
            TL.tpl_lang();
        }

        // 通知当前模块刷新动态文本（如状态文本等通过 JS 设置的内容）
        this.refreshCurrentModuleDynamicText();
    }

    /**
     * 刷新当前模块的动态文本
     * 用于语言切换后更新通过 JS 动态设置的文本内容
     */
    refreshCurrentModuleDynamicText() {
        const mod = this.currentModule;
        if (!mod) return;

        // 直链模块：刷新品牌状态文本
        if (mod === 'direct' && typeof VX_DIRECT !== 'undefined' && VX_DIRECT.applyBrandToUI) {
            VX_DIRECT.applyBrandToUI();
        }

        // 商店模块：刷新动态文本（标题、订单列表等）
        if (mod === 'shop' && typeof VX_SHOP !== 'undefined' && VX_SHOP.refreshDynamicText) {
            VX_SHOP.refreshDynamicText();
        }
    }

    /**
     * 是否需要侧边栏抽屉模式
     * - 手机：<=768
     * - 竖屏平板：<=1024 且竖屏
     */
    isSidebarOverlayMode() {
        const width = window.innerWidth;
        if (width <= 768) return true;

        const isPortrait = (typeof window.matchMedia === 'function'
            && window.matchMedia('(orientation: portrait)').matches)
            || (window.innerHeight > window.innerWidth);

        return isPortrait && width <= 1024;
    }

    /**
     * 应用侧边栏响应式模式，并在模式切换时重置状态
     */
    applySidebarResponsiveMode() {
        const layout = document.getElementById('vx-layout');
        if (!layout) return;

        const nextMode = this.isSidebarOverlayMode();
        const prevMode = this.sidebarOverlayMode;
        this.sidebarOverlayMode = nextMode;

        // 进入/退出抽屉模式时，确保侧边栏默认隐藏
        if (nextMode !== prevMode) {
            this.closeSidebar();
        }

        // 抽屉模式下不使用折叠（避免出现窄条侧边栏占位/遮挡）
        if (nextMode && this.sidebarCollapsed) {
            this.sidebarCollapsed = false;
            layout.classList.remove('sidebar-collapsed');
        }
    }
    
    /**
     * 处理路由
     */
    handleRoute() {
        const params = this.getUrlParams();
        const module = params.module || 'filelist';
        const moduleParams = { ...params };
        delete moduleParams.module;
        
        this.navigate(module, moduleParams);
    }
    
    /**
     * 获取 URL 参数
     */
    getUrlParams() {
        const params = {};
        const searchParams = new URLSearchParams(window.location.search);
        
        // 从 tmpui_page 参数中获取
        const tmpuiPage = searchParams.get('tmpui_page');
        if (tmpuiPage) {
            const pageParams = new URLSearchParams(tmpuiPage.split('?')[1] || '');
            pageParams.forEach((value, key) => {
                params[key] = value;
            });
        }
        
        // 直接从 URL 获取
        searchParams.forEach((value, key) => {
            if (key !== 'tmpui_page') {
                params[key] = value;
            }
        });
        
        return params;
    }
    
    /**
     * 注册模块
     */
    registerModule(name, module) {
        this.modules.set(name, module);
        console.log(`[VXUI] Module registered: ${name}`);
    }
    
    /**
     * 导航到指定模块
     */
    navigate(moduleName, params = {}) {
        // 未登录时仅允许文件夹浏览（filelist）；其余模块跳转登录
        const restrictedModules = new Set(['direct', 'notes', 'ai', 'shop', 'profile', 'settings']);
        if (restrictedModules.has(moduleName) && !this.isLoggedIn()) {
            if (typeof this.toastWarning === 'function') {
                const msg = (typeof app !== 'undefined' && app.languageData && app.languageData.vx_need_login)
                    ? app.languageData.vx_need_login
                    : '请先登录';
                this.toastWarning(msg);
            }
            app.open('/app&listview=login');
            return;
        }

        // photo 模块已整合到 filelist(album) 中：兼容旧入口
        if (moduleName === 'photo') {
            moduleName = 'filelist';
            params = { ...params, view: 'album' };
        }

        // filelist 模块：默认补齐 view 参数，确保 URL 可直接还原视图模式
        if (moduleName === 'filelist') {
            const nextView = (params && params.view) ? String(params.view) : (localStorage.getItem('vx_view_mode') || 'list');
            params = { ...params, view: nextView };
        }

        console.log(`[VXUI] Navigating to: ${moduleName}`, params);
        
        // 获取模块
        const module = this.modules.get(moduleName);
        if (!module) {
            console.error(`[VXUI] Module not found: ${moduleName}`);
            // 兼容：旧模块可能尝试跳转到 login 模块，但登录页是独立路由
            if (moduleName === 'login') {
                app.open('/app&listview=login');
                return;
            }
            this.toastError(`模块 ${moduleName} 未找到`);
            return;
        }
        
        // 卸载当前模块
        if (this.currentModule && this.currentModule !== moduleName) {
            const currentMod = this.modules.get(this.currentModule);
            if (currentMod && typeof currentMod.destroy === 'function') {
                currentMod.destroy();
            }
        }
        
        // 更新当前模块
        this.currentModule = moduleName;
        
        // 更新导航状态
        this.updateNavState(moduleName, params);

        // 登录状态可能变化，刷新导航可见性
        this.applyAuthVisibility();

        // 重置模块侧边栏区域（模块仅写入 dynamic 区）
        this.clearSidebarDynamic();

        // i18n: ensure language is ready BEFORE template injection
        this.ensureLanguageReady().finally(() => {
            // 加载模块模板
            this.loadModuleTemplate(moduleName, () => {
            // 初始化模块（确保即使模块 init 抛错也会更新 URL）
            try {
                if (typeof module.init === 'function') {
                    module.init(params);
                }
            } catch (e) {
                console.error(`[VXUI] Module init failed: ${moduleName}`, e);
                this.toastError('模块初始化失败');
            } finally {
                // 更新 URL
                this.updateUrl(moduleName, params);
            }

            // i18n: translate newly injected DOM (module + dynamic sidebar)
            if (typeof TL !== 'undefined' && TL && typeof TL.tpl_lang === 'function') {
                setTimeout(() => TL.tpl_lang(), 0);
            }
            
            // 关闭移动端侧边栏
            this.closeSidebar();
            });
        });
    }
    
    /**
     * 加载模块模板
     */
    loadModuleTemplate(moduleName, callback) {
        const templatePath = `/tpl/vxui/${moduleName}.html`;
        const container = document.getElementById('vx-module-container');
        
        if (!container) {
            console.error('[VXUI] Module container not found');
            return;
        }
        
        // 检查是否已缓存
        if (typeof app !== 'undefined' && typeof app.getFile === 'function') {
            const cachedContent = app.getFile(templatePath);
            if (cachedContent) {
                container.innerHTML = cachedContent;
                if (callback) callback();
                return;
            }
        }
        
        // 通过 AJAX 加载
        fetch(templatePath)
            .then(response => response.text())
            .then(html => {
                // 与旧版保持一致：注入前尽量先翻译，减少“先中文后闪”的观感
                let output = html;
                if (typeof app !== 'undefined' && app && typeof app.languageTranslateHtml === 'function') {
                    output = app.languageTranslateHtml(html);
                }
                container.innerHTML = output;

                // 旧版兼容：部分 VXUI 模块会依赖 TL.tpl_lang() 来刷新语言
                if (typeof TL !== 'undefined' && TL && typeof TL.tpl_lang === 'function') {
                    TL.tpl_lang(container);
                }
                if (callback) callback();
            })
            .catch(error => {
                console.error(`[VXUI] Failed to load template: ${templatePath}`, error);
                this.toastError('加载模块失败');
            });
    }
    
    /**
     * 更新导航状态
     */
    updateNavState(moduleName, params = {}) {
        // 移除所有 active 状态
        document.querySelectorAll('.vx-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelectorAll('.vx-mobile-btn').forEach(item => {
            item.classList.remove('active');
        });
        
        // 添加当前模块的 active 状态
        document.querySelectorAll(`[data-module="${moduleName}"]`).forEach(item => item.classList.add('active'));

        // filelist 模块：同一模块下区分 list/album 入口
        if (moduleName === 'filelist') {
            const view = (params && params.view) ? String(params.view) : (localStorage.getItem('vx_view_mode') || 'list');
            document.querySelectorAll('[data-module="filelist"][data-view]').forEach(item => {
                const itemView = item.getAttribute('data-view');
                if (itemView && itemView !== view) {
                    item.classList.remove('active');
                }
            });
            document.querySelectorAll(`[data-module="filelist"][data-view="${view}"]`).forEach(item => item.classList.add('active'));
        }
    }

    /**
     * 清空模块动态侧边栏区域，并恢复静态导航可见性
     */
    clearSidebarDynamic() {
        const sidebarStatic = document.getElementById('vx-sidebar-static');
        const sidebarDynamic = document.getElementById('vx-sidebar-dynamic');
        const divider = document.getElementById('vx-sidebar-divider');

        if (sidebarStatic) {
            sidebarStatic.style.display = '';
        }
        if (sidebarDynamic) {
            sidebarDynamic.innerHTML = '';
        }
        if (divider) {
            divider.style.display = 'none';
        }
    }

    /**
     * 从 template 渲染模块动态侧边栏（仅模块特定操作区）
     */
    setSidebarDynamicFromTemplate(templateId) {
        const tpl = document.getElementById(templateId);
        const sidebarDynamic = document.getElementById('vx-sidebar-dynamic');
        const divider = document.getElementById('vx-sidebar-divider');
        if (!tpl || !sidebarDynamic) return;

        const content = tpl.content ? tpl.content.cloneNode(true) : tpl.cloneNode(true);
        sidebarDynamic.innerHTML = '';
        sidebarDynamic.appendChild(content);

        const hasContent = sidebarDynamic.textContent && sidebarDynamic.textContent.trim().length > 0;
        if (divider) {
            divider.style.display = hasContent ? '' : 'none';
        }

        // i18n: translate newly inserted sidebar content
        this._languageReadyPromise = null;
        this.ensureLanguageReady().finally(() => {
            if (typeof TL !== 'undefined' && TL && typeof TL.tpl_lang === 'function') {
                TL.tpl_lang(sidebarDynamic);
            }
        });
    }

    /**
     * 根据 dynamic 是否为空刷新分割线显示
     */
    refreshSidebarDivider() {
        const sidebarDynamic = document.getElementById('vx-sidebar-dynamic');
        const divider = document.getElementById('vx-sidebar-divider');
        if (!sidebarDynamic || !divider) return;
        const hasContent = sidebarDynamic.textContent && sidebarDynamic.textContent.trim().length > 0;
        divider.style.display = hasContent ? '' : 'none';
    }
    
    /**
     * 更新 URL
     */
    updateUrl(moduleName, params) {
        const url = new URL(window.location.href);
        const baseUrl = url.origin + url.pathname;
        
        // 构建正确的 URL 参数格式
        let queryParams = `tmpui_page=/vx&module=${moduleName}`;
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null && value !== '') {
                queryParams += `&${key}=${encodeURIComponent(value)}`;
            }
        }
        
        const newUrl = `${baseUrl}?${queryParams}`;
        window.history.replaceState({}, '', newUrl);
    }
    
    /**
     * 绑定全局事件
     */
    bindGlobalEvents() {
        // ESC 键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeTopModal();
            }
        });
        
        // 窗口大小变化
        window.addEventListener('resize', () => {
            this.applySidebarResponsiveMode();
        });

        // 监听登录状态变化（跨标签页）
        window.addEventListener('storage', (event) => {
            if (event && event.key === 'app_login') {
                this.applyAuthVisibility();
            }
        });

        // 设备旋转（iPad 等）
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.applySidebarResponsiveMode(), 50);
        });
        
        // 点击侧边栏外部关闭
        document.addEventListener('click', (e) => {
            // Language dropdown toggle
            const langToggle = e.target && e.target.closest ? e.target.closest('[data-action="vx-lang-toggle"]') : null;
            const langSet = e.target && e.target.closest ? e.target.closest('[data-action="vx-lang-set"]') : null;
            const langDropdown = document.getElementById('vx-lang-dropdown');

            if (langToggle && langDropdown) {
                e.preventDefault();
                e.stopPropagation();
                langDropdown.classList.toggle('open');
                return;
            }

            if (langSet) {
                e.preventDefault();
                e.stopPropagation();
                const nextLang = langSet.getAttribute('data-lang');
                if (langDropdown) langDropdown.classList.remove('open');
                this.setLanguage(nextLang);
                return;
            }

            // Click outside closes language dropdown
            if (langDropdown && langDropdown.classList.contains('open')) {
                if (!langDropdown.contains(e.target)) {
                    langDropdown.classList.remove('open');
                }
            }

            const sidebar = document.getElementById('vx-sidebar');
            const toggleBtn = document.querySelector('[onclick*="toggleSidebar"]');
            const openBtn = document.querySelector('[onclick*="openSidebar"]');
            
            if (this.sidebarOpen && 
                sidebar && 
                !sidebar.contains(e.target) && 
                (!toggleBtn || !toggleBtn.contains(e.target)) &&
                (!openBtn || !openBtn.contains(e.target))) {
                this.closeSidebar();
            }
        });
    }
    
    // ==================== 侧边栏控制 ====================
    
    /**
     * 打开侧边栏
     */
    openSidebar() {
        this.sidebarOpen = true;
        const layout = document.getElementById('vx-layout');
        if (layout) {
            layout.classList.add('sidebar-open');
        }
        // 防止滚动穿透 - 保存当前滚动位置
        this._savedScrollY = window.scrollY;
        document.body.classList.add('vx-sidebar-open');
        document.body.style.top = `-${this._savedScrollY}px`;
    }
    
    /**
     * 关闭侧边栏
     */
    closeSidebar() {
        this.sidebarOpen = false;
        const layout = document.getElementById('vx-layout');
        if (layout) {
            layout.classList.remove('sidebar-open');
        }
        // 恢复滚动位置
        document.body.classList.remove('vx-sidebar-open');
        document.body.style.top = '';
        if (this._savedScrollY !== undefined) {
            window.scrollTo(0, this._savedScrollY);
        }
    }
    
    /**
     * 切换侧边栏
     */
    toggleSidebar() {
        if (this.isSidebarOverlayMode()) {
            if (this.sidebarOpen) {
                this.closeSidebar();
            } else {
                this.openSidebar();
            }
        } else {
            this.sidebarCollapsed = !this.sidebarCollapsed;
            const layout = document.getElementById('vx-layout');
            if (layout) {
                layout.classList.toggle('sidebar-collapsed', this.sidebarCollapsed);
            }
        }
    }
    
    // ==================== 暗色模式 ====================
    
    /**
     * 获取暗色模式偏好
     */
    getDarkModePreference() {
        // 始终跟随系统主题
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    /**
     * 监听系统主题变化
     */
    listenSystemTheme() {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const callback = (e) => {
            this.darkMode = e.matches;
            this.applyDarkMode();
            
            // 同步更新主题色
            if (typeof TL !== 'undefined' && typeof TL.setThemeColor === 'function') {
                TL.setThemeColor();
            }
        };
        
        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', callback);
        } else if (typeof media.addListener === 'function') {
            // 兼容旧版浏览器
            media.addListener(callback);
        }
    }
    
    /**
     * 应用暗色模式
     */
    applyDarkMode() {
        if (this.darkMode) {
            document.documentElement.classList.add('vx-dark');
        } else {
            document.documentElement.classList.remove('vx-dark');
        }
    }
    
    /**
     * 切换暗色模式
     */
    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        localStorage.setItem('vxui-dark-mode', this.darkMode);
        this.applyDarkMode();
    }

    /**
     * 切换到经典版界面
     * 保存用户偏好到 localStorage 并跳转到经典版界面
     */
    switchToClassic() {
        localStorage.setItem('tmplink_ui_preference', 'vxui');
        app.open('/vx');
    }
    
    // ==================== Toast 提示 ====================
    
    /**
     * 初始化 Toast 容器
     */
    initToastContainer() {
        if (!document.getElementById('vx-toast-container')) {
            const container = document.createElement('div');
            container.id = 'vx-toast-container';
            container.className = 'vx-toast-container';
            document.body.appendChild(container);
        }
    }
    
    /**
     * 显示 Toast
     */
    toast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('vx-toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `vx-toast vx-toast-${type}`;
        
        const icons = {
            success: 'circle-check',
            error: 'circle-xmark',
            warning: 'circle-exclamation',
            info: 'circle-exclamation'
        };
        
        toast.innerHTML = `
            <iconpark-icon name="${icons[type] || 'info-circle'}" class="vx-toast-icon"></iconpark-icon>
            <span class="vx-toast-message">${message}</span>
        `;
        
        container.appendChild(toast);
        
        // 触发动画
        requestAnimationFrame(() => {
            toast.classList.add('vx-toast-show');
        });
        
        // 自动移除
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.remove('vx-toast-show');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
    }
    
    /**
     * 成功提示
     */
    toastSuccess(message, duration = 3000) {
        this.toast(message, 'success', duration);
    }
    
    /**
     * 错误提示
     */
    toastError(message, duration = 4000) {
        this.toast(message, 'error', duration);
    }
    
    /**
     * 警告提示
     */
    toastWarning(message, duration = 3500) {
        this.toast(message, 'warning', duration);
    }
    
    /**
     * 信息提示
     */
    toastInfo(message, duration = 3000) {
        this.toast(message, 'info', duration);
    }
    
    // ==================== Modal 模态框 ====================
    
    /**
     * 打开模态框
     */
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        modal.classList.add('vx-modal-open');
        document.body.classList.add('vx-modal-body-open');
        this.openModals.push(modalId);
        
        // 聚焦第一个输入框
        const firstInput = modal.querySelector('input, textarea, select');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }
    
    /**
     * 关闭模态框
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        modal.classList.remove('vx-modal-open');
        this.openModals = this.openModals.filter(id => id !== modalId);
        
        if (this.openModals.length === 0) {
            document.body.classList.remove('vx-modal-body-open');
        }
    }
    
    /**
     * 关闭顶层模态框
     */
    closeTopModal() {
        if (this.openModals.length > 0) {
            const topModalId = this.openModals[this.openModals.length - 1];
            this.closeModal(topModalId);
        }
    }
    
    /**
     * 创建提示对话框
     */
    alert(options) {
        // 如果 options 是字符串，则当作 message 处理
        if (typeof options === 'string') {
            options = { message: options };
        }
        
        const {
            title = '提示',
            message = '',
            confirmText = '确定',
            confirmClass = 'vx-btn-primary',
            onConfirm = () => {}
        } = options;

        this.confirm({
            title,
            message,
            confirmText,
            cancelText: null, // 隐藏取消按钮
            confirmClass,
            onConfirm
        });
    }

    /**
     * 创建确认对话框
     */
    confirm(options) {
        const {
            title = '确认',
            message = '确定要执行此操作吗？',
            confirmText = '确定',
            cancelText = '取消',
            confirmClass = 'vx-btn-primary',
            onConfirm = () => {},
            onCancel = () => {}
        } = options;

        const hasCancel = cancelText !== null && cancelText !== undefined && String(cancelText).trim() !== '';
        
        // 创建模态框
        const modalId = 'vx-confirm-modal-' + Date.now();
        const modal = document.createElement('div');
        modal.className = 'vx-modal';
        modal.id = modalId;
        
        modal.innerHTML = `
            <div class="vx-modal-overlay" onclick="VXUI.closeModal('${modalId}')"></div>
            <div class="vx-modal-container vx-modal-sm">
                <div class="vx-modal-header">
                    <h3 class="vx-modal-title">${title}</h3>
                    <button class="vx-modal-close" onclick="VXUI.closeModal('${modalId}')">
                        <iconpark-icon name="circle-xmark"></iconpark-icon>
                    </button>
                </div>
                <div class="vx-modal-body">
                    <div class="vx-modal-message">${message}</div>
                </div>
                <div class="vx-modal-footer">
                    ${hasCancel ? `<button class="vx-btn vx-btn-secondary" id="${modalId}-cancel">${cancelText}</button>` : ''}
                    <button class="vx-btn ${confirmClass}" id="${modalId}-confirm">${confirmText}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 绑定事件
        if (hasCancel) {
            document.getElementById(`${modalId}-cancel`).onclick = () => {
                this.closeModal(modalId);
                setTimeout(() => modal.remove(), 300);
                onCancel();
            };
        }
        
        document.getElementById(`${modalId}-confirm`).onclick = () => {
            this.closeModal(modalId);
            setTimeout(() => modal.remove(), 300);
            onConfirm();
        };
        
        // 打开模态框
        setTimeout(() => this.openModal(modalId), 10);
    }
    
    /**
     * 创建输入对话框
     */
    prompt(options) {
        const {
            title = '输入',
            message = '',
            placeholder = '',
            defaultValue = '',
            confirmText = '确定',
            cancelText = '取消',
            onConfirm = () => {},
            onCancel = () => {}
        } = options;
        
        const modalId = 'vx-prompt-modal-' + Date.now();
        const modal = document.createElement('div');
        modal.className = 'vx-modal';
        modal.id = modalId;
        
        modal.innerHTML = `
            <div class="vx-modal-overlay" onclick="VXUI.closeModal('${modalId}')"></div>
            <div class="vx-modal-container vx-modal-sm">
                <div class="vx-modal-header">
                    <h3 class="vx-modal-title">${title}</h3>
                    <button class="vx-modal-close" onclick="VXUI.closeModal('${modalId}')">
                        <iconpark-icon name="circle-xmark"></iconpark-icon>
                    </button>
                </div>
                <div class="vx-modal-body">
                    ${message ? `<p class="vx-mb-md">${message}</p>` : ''}
                    <input type="text" class="vx-input" id="${modalId}-input" 
                        placeholder="${placeholder}" value="${defaultValue}">
                </div>
                <div class="vx-modal-footer">
                    <button class="vx-btn vx-btn-secondary" id="${modalId}-cancel">${cancelText}</button>
                    <button class="vx-btn vx-btn-primary" id="${modalId}-confirm">${confirmText}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const input = document.getElementById(`${modalId}-input`);
        
        // 绑定事件
        document.getElementById(`${modalId}-cancel`).onclick = () => {
            this.closeModal(modalId);
            setTimeout(() => modal.remove(), 300);
            onCancel();
        };
        
        document.getElementById(`${modalId}-confirm`).onclick = () => {
            const value = input.value;
            this.closeModal(modalId);
            setTimeout(() => modal.remove(), 300);
            onConfirm(value);
        };
        
        // 回车确认
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                document.getElementById(`${modalId}-confirm`).click();
            }
        };
        
        // 打开模态框
        setTimeout(() => this.openModal(modalId), 10);
    }
    
    /**
     * 显示移动端 Action Sheet 操作菜单
     * @param {string} title - 标题
     * @param {Array} items - 菜单项数组 [{icon, text, action, danger}]
     */
    showActionSheet(title, items) {
        const modalId = 'vx-action-sheet';
        
        // 移除已存在的
        const existing = document.getElementById(modalId);
        if (existing) existing.remove();
        
        // 构建菜单项 HTML，支持 label 类型作为分组标题
        let actionIndex = 0;
        const itemsHtml = items.map((item) => {
            if (item.type === 'label') {
                return `<div class="vx-action-sheet-label">${item.text}</div>`;
            }
            const html = `
                <button class="vx-action-sheet-item ${item.danger ? 'vx-action-danger' : ''}" data-action-index="${actionIndex}">
                    ${item.icon ? `<iconpark-icon name="${item.icon}"></iconpark-icon>` : ''}
                    <span>${item.text}</span>
                </button>
            `;
            actionIndex++;
            return html;
        }).join('');
        
        // 过滤出实际的 action items（非 label）
        const actionItems = items.filter(item => item.type !== 'label');
        
        const modalHtml = `
            <div class="vx-modal vx-action-sheet" id="${modalId}">
                <div class="vx-modal-overlay" onclick="VXUI.closeActionSheet()"></div>
                <div class="vx-action-sheet-container">
                    ${title ? `<div class="vx-action-sheet-title">${title}</div>` : ''}
                    <div class="vx-action-sheet-items">
                        ${itemsHtml}
                    </div>
                    <button class="vx-action-sheet-cancel" onclick="VXUI.closeActionSheet()">
                        <span data-tpl="btn_cancel">取消</span>
                    </button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // 绑定点击事件（使用过滤后的 actionItems）
        const sheet = document.getElementById(modalId);
        sheet.querySelectorAll('.vx-action-sheet-item').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                this.closeActionSheet();
                if (actionItems[index] && typeof actionItems[index].action === 'function') {
                    actionItems[index].action();
                }
            });
        });
        
        // 翻译
        if (typeof TL !== 'undefined' && typeof TL.tpl_lang === 'function') {
            TL.tpl_lang(sheet);
        }
        
        // 打开
        setTimeout(() => this.openModal(modalId), 10);
    }
    
    /**
     * 关闭 Action Sheet
     */
    closeActionSheet() {
        const modalId = 'vx-action-sheet';
        this.closeModal(modalId);
        setTimeout(() => {
            const el = document.getElementById(modalId);
            if (el) el.remove();
        }, 300);
    }
    
    // ==================== 工具方法 ====================
    
    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * 格式化日期
     */
    formatDate(timestamp) {
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diff = now - date;
        
        // 小于 1 分钟
        if (diff < 60000) {
            return '刚刚';
        }
        
        // 小于 1 小时
        if (diff < 3600000) {
            return Math.floor(diff / 60000) + ' 分钟前';
        }
        
        // 小于 24 小时
        if (diff < 86400000) {
            return Math.floor(diff / 3600000) + ' 小时前';
        }
        
        // 小于 30 天
        if (diff < 2592000000) {
            return Math.floor(diff / 86400000) + ' 天前';
        }
        
        // 其他情况显示完整日期
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }
    
    /**
     * 复制到剪贴板
     */
    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.toastSuccess('已复制到剪贴板');
            }).catch(() => {
                this.fallbackCopy(text);
            });
        } else {
            this.fallbackCopy(text);
        }
    }
    
    /**
     * 降级复制方法
     */
    fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            this.toastSuccess('已复制到剪贴板');
        } catch (err) {
            this.toastError('复制失败');
        }
        document.body.removeChild(textarea);
    }
    
    /**
     * 防抖函数
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * 节流函数
     */
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * 获取文件图标
     */
    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const iconMap = {
            // 图片
            'jpg': 'image',
            'jpeg': 'image',
            'png': 'image',
            'gif': 'image',
            'webp': 'image',
            'svg': 'image',
            'bmp': 'image',
            // 视频
            'mp4': 'video',
            'mkv': 'video',
            'avi': 'video',
            'mov': 'video',
            'wmv': 'video',
            'flv': 'video',
            // 音频
            'mp3': 'music',
            'wav': 'music',
            'flac': 'music',
            'aac': 'music',
            'ogg': 'music',
            // 文档
            'pdf': 'file-pdf',
            'doc': 'file-word',
            'docx': 'file-word',
            'xls': 'file-excel',
            'xlsx': 'file-excel',
            'ppt': 'file-powerpoint',
            'pptx': 'file-powerpoint',
            'txt': 'file-text',
            'md': 'file-text',
            // 压缩包
            'zip': 'file-zip',
            'rar': 'file-zip',
            '7z': 'file-zip',
            'tar': 'file-zip',
            'gz': 'file-zip',
            // 代码
            'js': 'code',
            'ts': 'code',
            'html': 'code',
            'css': 'code',
            'json': 'code',
            'xml': 'code',
            'py': 'code',
            'java': 'code',
            'php': 'code',
            // 可执行文件
            'exe': 'file-apps',
            'app': 'file-apps',
            'dmg': 'file-apps',
            'apk': 'file-apps'
        };
        
        return iconMap[ext] || 'file';
    }
    
    /**
     * 判断是否为图片
     */
    isImage(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
    }
    
    /**
     * 判断是否为视频
     */
    isVideo(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        return ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext);
    }
    
    /**
     * 判断是否为音频
     */
    isAudio(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        return ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext);
    }
    
    /**
     * 判断是否为移动端
     */
    isMobile() {
        return window.innerWidth <= 768;
    }
}

// 创建全局实例
const VXUI = new VXUICore();

// 暴露到 window 对象
if (typeof window !== 'undefined') {
    window.VXUI = VXUI;
}
