(function (window, document) {
    'use strict';

    const state = {
        loggedIn: true,
        owner: true,
        user: {
            name: 'Demo Owner',
            owner: true
        }
    };

    const framework = new window.VXUIFramework({
        root: '#vx-app',
        viewContainer: '#vx-view',
        sidebarNav: '#vx-sidebar-nav',
        mobileNav: '#vx-mobile-bar',
        titleElement: '#vx-current-title',
        breadcrumbElement: '#vx-breadcrumb',
        authLabelElement: '#vx-auth-pill',
        sidebar: '#vx-sidebar',
        sidebarOverlay: '[data-vx-sidebar-overlay]',
        defaultView: 'overview',
        unauthorizedView: 'overview',
        authProvider: function () {
            return {
                loggedIn: state.loggedIn,
                owner: state.owner,
                user: state.loggedIn ? state.user : null
            };
        }
    });

    function overviewView() {
        return [
            '<section class="vx-panel">',
                '<h2 class="vx-panel-title">VXUI Framework Demo</h2>',
                '<div class="vx-copy">This lightweight demo validates navigation, auth visibility, theme switching, and framework feedback components.</div>',
            '</section>',
            '<section class="vx-grid is-two">',
                '<article class="vx-card"><h3 class="vx-card-title">Runtime</h3><div class="vx-card-copy">No tmpUI, no TL, no jQuery required.</div></article>',
                '<article class="vx-card"><h3 class="vx-card-title">Components</h3><div class="vx-card-copy">Modal, toast, list shell, and auth visibility are built in.</div></article>',
            '</section>'
        ].join('');
    }

    function feedbackView() {
        return [
            '<section class="vx-panel">',
                '<h2 class="vx-panel-title">Feedback Components</h2>',
                '<div class="vx-inline-actions" style="margin-top: 10px;">',
                    '<button class="vx-btn vx-btn-primary" type="button" id="demo-toast-success">Success Toast</button>',
                    '<button class="vx-btn vx-btn-secondary" type="button" id="demo-modal-confirm">Open Confirm</button>',
                '</div>',
            '</section>'
        ].join('');
    }

    function protectedView() {
        return [
            '<section class="vx-panel">',
                '<h2 class="vx-panel-title">Protected Area</h2>',
                '<div class="vx-copy">This view requires logged-in state.</div>',
            '</section>',
            '<section class="vx-card-grid">',
                '<article class="vx-card" data-auth="logged-in"><h3 class="vx-card-title">Signed-in block</h3><div class="vx-card-copy">Visible when user is authenticated.</div></article>',
                '<article class="vx-card" data-auth="logged-out"><h3 class="vx-card-title">Guest block</h3><div class="vx-card-copy">Visible when user is logged out.</div></article>',
                '<article class="vx-card" data-owner="true"><h3 class="vx-card-title">Owner block</h3><div class="vx-card-copy">Visible only for owner users.</div></article>',
            '</section>'
        ].join('');
    }

    framework.registerViews({
        overview: {
            title: 'Overview',
            render: overviewView
        },
        feedback: {
            title: 'Feedback',
            render: feedbackView,
            afterRender: function () {
                const toastButton = document.getElementById('demo-toast-success');
                const modalButton = document.getElementById('demo-modal-confirm');

                if (toastButton) {
                    toastButton.addEventListener('click', function () {
                        framework.toastSuccess('Saved successfully.');
                    });
                }

                if (modalButton) {
                    modalButton.addEventListener('click', async function () {
                        const ok = await framework.confirm({
                            title: 'Confirm action',
                            message: 'Apply this change in the demo workspace?'
                        });

                        framework.toastInfo(ok ? 'Confirmed.' : 'Canceled.');
                    });
                }
            }
        },
        workspace: {
            title: 'Workspace',
            render: protectedView,
            requiresAuth: true
        }
    });

    framework.setNavigation([
        { view: 'overview', label: 'Overview', icon: 'house' },
        { view: 'feedback', label: 'Feedback', icon: 'circle-info' },
        { view: 'workspace', label: 'Workspace', icon: 'lock', showWhenLoggedIn: true }
    ]);

    function bindControls() {
        const themeButton = document.getElementById('demo-theme-toggle');
        const authButton = document.getElementById('demo-auth-toggle');

        if (themeButton) {
            const updateThemeLabel = function () {
                themeButton.textContent = 'Theme · ' + framework.getThemeMode();
            };

            themeButton.addEventListener('click', function () {
                framework.cycleTheme();
                updateThemeLabel();
            });

            updateThemeLabel();
        }

        if (authButton) {
            const updateAuthLabel = function () {
                authButton.textContent = state.loggedIn ? 'Switch to guest' : 'Mock sign in';
                authButton.className = state.loggedIn ? 'vx-btn vx-btn-secondary vx-btn-sm' : 'vx-btn vx-btn-primary vx-btn-sm';
            };

            authButton.addEventListener('click', function () {
                state.loggedIn = !state.loggedIn;
                state.owner = state.loggedIn;
                framework.refreshAuth();
                framework.renderNavigation();
                framework.renderView(framework.currentView || 'overview', framework.currentState);
                updateAuthLabel();
            });

            updateAuthLabel();
        }
    }

    framework.init().then(function () {
        bindControls();
    });
})(window, document);
