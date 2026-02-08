/**
 * init_auth.js
 * Shared initialization for all auth pages (login, register, reset).
 * Initializes TL (api.js), OAuth, and the AuthPageController.
 * Detects mobile via isMobileScreen() and loads the appropriate sub-template.
 */

app.ready(() => {
    // Initialize TL object from api.js (lightweight, no tmplink.js dependency)
    if (typeof window.TL === 'undefined') {
        if (typeof window.tmplink_api !== 'undefined') {
            window.TL = new tmplink_api();
        } else {
            console.error('[init_auth] tmplink_api (api.js) not loaded');
            return;
        }
    }

    // Initialize OAuth module
    if (typeof oauth === 'function' && !TL.oauth) {
        TL.oauth = new oauth();
        TL.oauth.init(TL);
    }

    // Determine page type from URL
    const pagePath = new URLSearchParams(window.location.search).get('tmpui_page') || '';
    const mobile = (typeof isMobileScreen === 'function') && isMobileScreen();

    // Load desktop or mobile sub-template into the auth shell
    let tplDesktop, tplMobile;
    if (pagePath.startsWith('/reg')) {
        tplDesktop = '/tpl/auth_reg.html';
        tplMobile  = '/tpl/auth_reg_mobile.html';
    } else if (pagePath.startsWith('/reset')) {
        tplDesktop = '/tpl/auth_reset.html';
        tplMobile  = '/tpl/auth_reset_mobile.html';
    } else {
        tplDesktop = '/tpl/auth_login.html';
        tplMobile  = '/tpl/auth_login_mobile.html';
    }

    if (mobile) {
        document.body.classList.add('auth-mobile');
        $('#auth-view').html(app.getFile(tplMobile));
    } else {
        $('#auth-view').html(app.getFile(tplDesktop));
    }

    // Initialize auth controller
    window.authPage = new AuthPageController();
    authPage.init(TL);

    // Apply i18n translations
    app.languageBuild();

    // Set page-specific title and description
    if (pagePath.startsWith('/reg')) {
        $('title').html(app.languageData.title_reg || 'Register');
        $('meta[name=description]').attr('content', app.languageData.des_reg || '');
    } else if (pagePath.startsWith('/reset')) {
        $('title').html(app.languageData.title_reset || 'Reset Password');
        $('meta[name=description]').attr('content', app.languageData.des_reset || '');
    } else {
        $('title').html(app.languageData.title_login || 'Login');
        $('meta[name=description]').attr('content', app.languageData.des_login || '');
    }

    TL.ready(() => {
        // Show language selector
        $('#index_lang').fadeIn();

        // Area-based UI adjustment (CN users are redirected to ttttt.link)
        const isAreaCN = (window.location.hostname === 'www.ttttt.link');
        if (isAreaCN) {
            $('.area_global').remove();
        } else {
            $('.area_cn').remove();
        }

        // Redirect already-logged-in users (except on reset page)
        if (TL.isLogin() && !pagePath.startsWith('/reset')) {
            const uiPreference = localStorage.getItem('tmplink_ui_preference');
            if (uiPreference === 'classic') {
                app.open('/app');
            } else {
                app.open('/vx');
            }
            return;
        }

        // Initialize Google OAuth on login page
        if (pagePath.startsWith('/login') || pagePath === '/login') {
            const mx = localStorage.getItem('from_menubarx');
            if (mx === '1') {
                $('#google_login').hide();
            }
            if (TL.oauth && typeof TL.oauth.google_login === 'function') {
                TL.oauth.google_login();
            }
        }
    });
});
