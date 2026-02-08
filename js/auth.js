/**
 * auth.js
 * Standalone Auth Page Controller
 * Handles login, register, and password reset independently of tmplink.js.
 * Uses tmplink_api (api.js) for token/session management.
 */

'use strict';

class AuthPageController {
    tl = null;

    /**
     * Initialize the auth controller.
     * @param {tmplink_api} tl - The API instance
     */
    init(tl) {
        this.tl = tl;
        document.documentElement.classList.add('file-page', 'auth-page');
        document.body.classList.add('file-page', 'auth-page');
    }

    /**
     * Show a notice message.
     * @param {string} msg - Message text
     * @param {string} [type] - 'error' | 'success' | undefined (info)
     */
    showNotice(msg, type) {
        const el = document.getElementById('msg_notice');
        if (!el) return;
        el.style.display = 'block';
        el.textContent = msg;
        el.className = 'auth-notice';
        if (type === 'error') el.classList.add('error');
        else if (type === 'success') el.classList.add('success');
    }

    /**
     * Hide the notice message.
     */
    hideNotice() {
        const el = document.getElementById('msg_notice');
        if (el) {
            el.style.display = 'none';
        }
    }

    /**
     * Perform login.
     */
    login() {
        const email = $('#email').val();
        const password = $('#password').val();
        const tl = this.tl;

        if (!email || !password) {
            this.showNotice(app.languageData.login_fail, 'error');
            return;
        }

        $('#submit').attr('disabled', true);
        this.showNotice(app.languageData.form_btn_processing);
        $('#submit').find('span').html(app.languageData.form_btn_processing);

        tl.recaptcha_do('login', (recaptcha) => {
            $.post(tl.api_user, {
                action: 'login',
                token: tl.api_token,
                captcha: recaptcha,
                email: email,
                password: password
            }, (rsp) => {
                if (rsp.status == 1) {
                    this.showNotice(app.languageData.login_ok, 'success');
                    tl.logined = 1;
                    tl.get_details(() => {
                        localStorage.setItem('app_login', 1);
                        const return_page = localStorage.getItem('return_page');
                        if (return_page && return_page !== '0' && return_page !== 'null' && return_page !== '') {
                            location.href = return_page;
                            localStorage.setItem('return_page', '0');
                        } else {
                            const uiPreference = localStorage.getItem('tmplink_ui_preference');
                            if (uiPreference === 'classic') {
                                app.open('/app');
                            } else {
                                app.open('/vx');
                            }
                        }
                    });
                } else {
                    this.showNotice(app.languageData.login_fail, 'error');
                    $('#submit').find('span').html(app.languageData.form_btn_login);
                    $('#submit').removeAttr('disabled');
                }
            });
        });
    }

    /**
     * Perform registration.
     */
    register() {
        const email = $('#email_new').val();
        const password = $('#password').val();
        const rpassword = $('#rpassword').val();
        const code = $('#checkcode').val();
        const tl = this.tl;
        const lang = tl.currentLanguage;

        if (!email || !password || !rpassword || !code) {
            this.showNotice(app.languageData.status_error_0, 'error');
            return;
        }

        this.showNotice(app.languageData.form_btn_processing);
        $('#submit').find('span').html(app.languageData.form_btn_processing);
        $('#submit').attr('disabled', true);

        tl.recaptcha_do('user_register', (recaptcha) => {
            $.post(tl.api_user, {
                action: 'register',
                token: tl.api_token,
                email: email,
                password: password,
                captcha: recaptcha,
                rpassword: rpassword,
                lang: lang,
                code: code
            }, (rsp) => {
                if (rsp.status === 1) {
                    this.showNotice(app.languageData.reg_finish, 'success');
                    $('#submit').find('span').html(app.languageData.reg_finish);
                    tl.get_details(() => {
                        localStorage.setItem('app_login', 1);
                        setTimeout(() => {
                            const uiPreference = localStorage.getItem('tmplink_ui_preference');
                            if (uiPreference === 'classic') {
                                app.open('/app');
                            } else {
                                app.open('/vx');
                            }
                        }, 3000);
                    });
                } else {
                    this.showNotice(rsp.data, 'error');
                    $('#submit').find('span').html(app.languageData.form_btn_reg);
                    $('#submit').removeAttr('disabled');
                }
            });
        });
    }

    /**
     * Send verification code for registration.
     */
    cc_send() {
        const email = $('#email_new').val();
        const tl = this.tl;

        if (!email) {
            this.showNotice(app.languageData.direct_brand_logo_set_unknow || 'Error', 'error');
            return false;
        }

        this.showNotice(app.languageData.form_btn_processing);
        $('#button-reg-checkcode').find('span').html(app.languageData.form_btn_processing);
        $('#button-reg-checkcode').attr('disabled', true);

        tl.recaptcha_do('checkcode_send', (recaptcha) => {
            $.post(tl.api_user, {
                action: 'checkcode_send',
                token: tl.api_token,
                captcha: recaptcha,
                lang: (typeof app !== 'undefined' && typeof app.languageGet === 'function') ? app.languageGet() : tl.currentLanguage,
                email: email
            }, (rsp) => {
                if (rsp.status == 1) {
                    this.showNotice(app.languageData.form_checkcode_msg_sended, 'success');
                    $('#button-reg-checkcode').find('span').html(app.languageData.form_checkcode_sended);
                } else {
                    this.showNotice(this.errorText(rsp.status), 'error');
                    $('#button-reg-checkcode').find('span').html(app.languageData.form_getcode);
                    $('#button-reg-checkcode').removeAttr('disabled');
                }
            });
        });
    }

    /**
     * Send password reset email.
     */
    password_found() {
        const email = $('#email_new').val();
        const tl = this.tl;

        if (!email) {
            return false;
        }

        $('#submit').attr('disabled', true);
        this.showNotice(app.languageData.form_btn_processing);

        tl.recaptcha_do('passwordfound', (captcha) => {
            $.post(tl.api_user, {
                action: 'passwordfound',
                token: tl.api_token,
                email: email,
                captcha: captcha
            }, (rsp) => {
                if (rsp.status == 1) {
                    this.hideNotice();
                    $('#submit').find('span').html(app.languageData.form_btn_processed);
                } else {
                    switch (rsp.status) {
                        case 13:
                            this.showNotice(app.languageData.status_13, 'error');
                            break;
                        case 14:
                            this.showNotice(app.languageData.status_14, 'error');
                            break;
                        default:
                            this.showNotice(app.languageData.status_unknow, 'error');
                    }
                    $('#submit').removeAttr('disabled');
                }
            }, 'json');
        });
    }

    /**
     * Map error status codes to i18n messages.
     */
    errorText(code) {
        let msg = app.languageData.status_error_0;
        switch (code) {
            case 9: msg = app.languageData.status_error_9; break;
            case 10: msg = app.languageData.status_error_10; break;
            case 11: msg = app.languageData.status_error_11; break;
        }
        return msg;
    }
}

/**
 * Auth UI Controller
 * Handles dropdowns and modals using pure CSS (no Bootstrap dependency).
 * Mirrors fileUI from file.js.
 */
const authUI = {
    toggleDropdown(btn) {
        const wrapper = btn.closest('.file-dropdown');
        if (!wrapper) return;
        const isOpen = wrapper.classList.contains('open');
        this.closeDropdowns();
        if (!isOpen) wrapper.classList.add('open');
    },

    closeDropdowns() {
        document.querySelectorAll('.file-dropdown.open').forEach(d => d.classList.remove('open'));
    },

    openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add('open');

        const onEsc = (e) => {
            if (e.key === 'Escape') {
                this.closeModal(id);
                document.removeEventListener('keydown', onEsc);
            }
        };
        document.addEventListener('keydown', onEsc);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal(id);
        }, { once: true });
    },

    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('open');
    }
};

// Close dropdowns on outside click
document.addEventListener('click', (e) => {
    if (!e.target.closest('.file-dropdown')) {
        authUI.closeDropdowns();
    }
});

// Global exports
if (typeof window !== 'undefined') {
    window.AuthPageController = AuthPageController;
    window.authUI = authUI;
}
