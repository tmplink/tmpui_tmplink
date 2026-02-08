/**
 * ワークスペース、ルーム、ダイレクトモジュールの内容を扱うプログラムです。
 * @author CC2655
 * @version 1.0
 * @date 2022/12/23
 */

class dynamic {

    current = null
    mobileHeadInstalled = false

    route() {
        let url = location.href;
        let url_params = app.getUrlVars(window.location.href);
        let listview = url_params.listview;
        
        switch (listview) {
            case 'index':
                window.location.href = '/?tmpui_page=/vx';
                break;

            case 'preload':
                this.preload();
                break;

            case 'workspace': {
                const mrid = (url_params.mrid !== undefined) ? url_params.mrid : '0';
                window.location.href = `/?tmpui_page=/vx&module=filelist&mrid=${mrid}`;
                break;
            }

            case 'room': {
                const mrid = (url_params.mrid !== undefined) ? url_params.mrid : '0';
                window.location.href = `/?tmpui_page=/vx&module=filelist&mrid=${mrid}`;
                break;
            }
            case 'direct':
                window.location.href = '/?tmpui_page=/vx&module=direct';
                break;

            case 'login':
                this.login();
                break;
            case 'reg':
                this.reg();
                break;
            case 'reset':
                this.reset();
                break;

            case 'tos':
                this.tos();
                break;
            case 'privacy':
                this.privacy();
                break;

            case 'notes':
                window.location.href = '/?tmpui_page=/vx&module=notes';
                break;

            case 'ai':
                window.location.href = '/?tmpui_page=/vx&module=ai';
                break;

            case 'photo':
                const photoMrid = (url_params.mrid !== undefined) ? url_params.mrid : '0';
                const mode = (url_params.mode !== undefined) ? url_params.mode : '';
                const modeParam = mode ? `&mode=${encodeURIComponent(mode)}` : '';
                window.location.href = `/?tmpui_page=/vx&module=filelist&view=album&mrid=${photoMrid}${modeParam}`;
                break;

            default:
                listview = 'index';
                this.index();
                break;
        }

    }

    active(title) {
        $('.navbar-collapse').collapse('hide');
        // if(this.current!==title){
        //     $('#nav_'+this.current).removeClass('active');
        //     $('#nav_'+title).addClass('active');
        //     this.current=title;
        // }

        TL.navbar.enabled();
        TL.ready(() => {
            TL.head_set();
        });
        app.linkRebind();
        if (isMobileScreen()) {
            TL.bg_remove();
            this.mobileHead();
        }
    }

    mobileHead() {
        //初始化
        var headerL = '.mobile-head-large-title';
        var headerT = '.mobile-head-top-title';
        $(headerL).show();
        $(headerT).hide();
        if (this.mobileHeadInstalled) {
            return;
        } else {
            this.mobileHeadInstalled = true;
        }
        window.addEventListener('scroll', function () {
            var headerL = '.mobile-head-large-title';
            var headerT = '.mobile-head-top-title';
            var scrollTop = document.documentElement.scrollTop;
            if (scrollTop >= 100) {
                //向下滑动后超过 100px
                $(headerT).show();
                $(headerL).hide();
            } else {
                //向上滑动后小于 100px
                $(headerT).hide();
                $(headerL).show();
            }
        });
    }

    preload() {

        TL.loading_box_on();
        TL.ready(
            () => {
                TL.loading_box_off();
                if (TL.logined == 0) {
                    //未登录，跳转到登录页
                    this.login();
                } else {
                    //已登录，根据用户偏好选择界面
                    const uiPreference = localStorage.getItem('tmplink_ui_preference');
                    if (uiPreference === 'classic') {
                        // 用户选择了经典版
                        this.room();
                    } else {
                        // 默认使用新版界面 (vxui) 或用户选择了新版
                        window.location.href = '/?tmpui_page=/vx';
                    }
                }
            }
        );
    }

    index() {
        $('#tmpui_body').css('opacity', '0');
        TL.ready(
            () => {
                if (TL.logined == 0) {
                    //未登录，跳转到登录页
                    TL.ga('Index');
                    window.location.href = '/';
                } else {
                    //已登录，进入 room
                    this.room();
                    $('#tmpui_body').css('opacity', '1');
                }
            }
        );
    }

    notes() {
        if (isMobileScreen()) {
            $('#home_view').html(app.getFile('/tpl/listview/mobile_notes.html'));
        } else {
            $('#home_view').html(app.getFile('/tpl/listview/notes.html'));
        }
        TL.ga('notes');
        app.dynOpen('/app&listview=notes');
        this.active('notes');
        INIT_notes();
        TL.navbar.model_notes();
    }

    room() {
        if (isMobileScreen()) {
            $('#home_view').html(app.getFile('/tpl/listview/mobile_room.html'));
        } else {
            $('#home_view').html(app.getFile('/tpl/listview/room.html'));
        }
        // app.dynOpen('/app&listview=room');
        this.active('room');
        INIT_room();
        TL.navbar.model_desktop();
    }

    direct() {
        if (isMobileScreen()) {
            $('#home_view').html(app.getFile('/tpl/listview/mobile_direct.html'));
        } else {
            $('#home_view').html(app.getFile('/tpl/listview/direct.html'));
        }
        TL.ga('Direct');
        app.dynOpen('/app&listview=direct');
        this.active('direct');
        TL.navbar.model_direct();
        INIT_direct();
    }

    login() {
        if (isMobileScreen()) {
            $('#home_view').html(app.getFile('/tpl/listview/mobile_login.html'));
        } else {
            $('#home_view').html(app.getFile('/tpl/listview/login.html'));
        }
        app.dynOpen('/login');
        TL.ga('Login');
        app.linkRebind();
        TL.navbar.disabled();
        INIT_login();
    }

    reg() {
        TL.ga('Register');
        if (isMobileScreen()) {
            $('#home_view').html(app.getFile('/tpl/listview/mobile_reg.html'));
        } else {
            $('#home_view').html(app.getFile('/tpl/listview/reg.html'));
        }
        app.dynOpen('/reg');
        app.linkRebind();
        TL.navbar.disabled();
        INIT_reg();
    }

    reset() {
        TL.ga('Reset');
        $('#home_view').html(app.getFile('/tpl/listview/reset.html'));
        app.dynOpen('/reset');
        app.linkRebind();
        TL.navbar.model_direct();
        INIT_reset();
    }

    tos() {
        window.location.href = '/tos.html';
    }

    privacy() {
        window.location.href = '/privacy.html';
    }

    ai() {
        if (isMobileScreen()) {
            $('#home_view').html(app.getFile('/tpl/listview/mobile_ai.html'));
        } else {
            $('#home_view').html(app.getFile('/tpl/listview/ai.html'));
        }
        TL.ga('AI Chat');
        app.dynOpen('/app&listview=ai');
        this.active('ai');
        INIT_ai();
        TL.navbar.model_ai();
    }

    photo() {
        if (isMobileScreen()) {
            $('#home_view').html(app.getFile('/tpl/listview/mobile_photo.html'));
        } else {
            $('#home_view').html(app.getFile('/tpl/listview/photo.html'));
        }
        TL.ga('Photo Album');
        let params = app.getUrlVars(window.location.href);
        let mrid = params.mrid || '0';
        let mode = params.mode || 'folder';
        app.dynOpen('/app&listview=photo&mrid=' + mrid + '&mode=' + mode);
        this.active('photo');
        INIT_photo();
        TL.navbar.disabled();
    }

}
