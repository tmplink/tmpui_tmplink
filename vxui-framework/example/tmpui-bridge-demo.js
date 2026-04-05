(function (window, document) {
    'use strict';

    const hostState = {
        loggedIn: true,
        owner: true,
        currentRoute: '/vx&module=bridge-overview'
    };

    window.app = {
        ready: function (callback) {
            callback();
        },
        dynOpen(route) {
            hostState.currentRoute = route;
            renderHostControls();
        },
        open(route) {
            hostState.currentRoute = route;
            renderHostControls();
        }
    };

    window.TL = {
        profile: {
            name: 'Bridge Owner',
            owner: hostState.owner
        },
        isLogin() {
            return hostState.loggedIn;
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
        defaultView: 'bridge-overview',
        unauthorizedView: 'bridge-auth'
    });

    const bridge = new window.VXUITmpuiBridge({
        framework: framework,
        app: window.app,
        service: window.TL,
        ownerResolver: function () {
            return hostState.loggedIn && hostState.owner;
        },
        syncNavigationToHost: true,
        routeMap: {
            'bridge-overview': '/vx&module=bridge-overview',
            'bridge-auth': '/vx&module=bridge-auth',
            'bridge-route': '/vx&module=bridge-route'
        }
    }).attach();

    function hostStateMarkup() {
        return [
            '<div class="vx-card">',
                '<h3 class="vx-card-title">Host State</h3>',
                '<div class="vx-card-copy">Host controls mutate mocked app/TL state, then bridge sync refreshes the framework shell.</div>',
                '<div class="vx-stack" style="margin-top: 12px;">',
                    '<div><strong>Current host route</strong><div class="vx-demo-note vx-mono" id="bridge-host-route">' + hostState.currentRoute + '</div></div>',
                    '<div><strong>Current host auth</strong><div class="vx-demo-note" id="bridge-host-auth-value">' + (hostState.loggedIn ? 'true' : 'false') + '</div></div>',
                    '<div><strong>Current host owner</strong><div class="vx-demo-note" id="bridge-host-owner-value">' + (hostState.owner ? 'true' : 'false') + '</div></div>',
                '</div>',
            '</div>'
        ].join('');
    }

    function bridgeOverviewView() {
        return [
            '<section class="vx-panel">',
                '<h2 class="vx-panel-title">tmpUI Bridge Overview</h2>',
                '<div class="vx-copy">This demo validates auth and route synchronization only. Language mapping is intentionally removed from the framework core.</div>',
            '</section>',
            '<section class="vx-grid is-two">',
                hostStateMarkup(),
                '<div class="vx-card"><h3 class="vx-card-title">Route Mapping</h3><div class="vx-card-copy">When syncNavigationToHost is enabled, view switches call app.dynOpen in the host.</div></div>',
            '</section>'
        ].join('');
    }

    function bridgeAuthView() {
        return [
            '<section class="vx-panel">',
                '<h2 class="vx-panel-title">Auth Mapping</h2>',
                '<div class="vx-copy">Bridge converts host login signals into the framework auth provider shape.</div>',
            '</section>',
            '<section class="vx-card-grid">',
                '<article class="vx-card" data-auth="logged-in"><h3 class="vx-card-title">Logged in</h3><div class="vx-card-copy">Visible only when host reports an authenticated user.</div></article>',
                '<article class="vx-card" data-auth="logged-out"><h3 class="vx-card-title">Guest</h3><div class="vx-card-copy">Visible only when host is logged out.</div></article>',
                '<article class="vx-card" data-owner="true"><h3 class="vx-card-title">Owner</h3><div class="vx-card-copy">Owner visibility is controlled by ownerResolver.</div></article>',
            '</section>'
        ].join('');
    }

    function bridgeRouteView() {
        return [
            '<section class="vx-panel">',
                '<h2 class="vx-panel-title">Route Sync</h2>',
                '<div class="vx-copy">Switch framework views to verify route updates in the host adapter.</div>',
            '</section>',
            hostStateMarkup()
        ].join('');
    }

    framework.registerViews({
        'bridge-overview': {
            title: 'Bridge Overview',
            render: bridgeOverviewView
        },
        'bridge-auth': {
            title: 'Bridge Auth',
            render: bridgeAuthView
        },
        'bridge-route': {
            title: 'Bridge Route',
            render: bridgeRouteView
        }
    });

    framework.setNavigation([
        { view: 'bridge-overview', label: 'Bridge Overview', icon: 'house' },
        { view: 'bridge-auth', label: 'Bridge Auth', icon: 'lock' },
        { view: 'bridge-route', label: 'Bridge Route', icon: 'link' }
    ]);

    function renderHostControls() {
        const loginButton = document.getElementById('bridge-host-login');
        const ownerButton = document.getElementById('bridge-host-owner');

        if (loginButton) {
            loginButton.textContent = hostState.loggedIn ? 'Switch to guest' : 'Mock sign in';
        }

        if (ownerButton) {
            ownerButton.textContent = hostState.owner ? 'Disable owner' : 'Enable owner';
        }

        const routeNode = document.getElementById('bridge-host-route');
        const authNode = document.getElementById('bridge-host-auth-value');
        const ownerNode = document.getElementById('bridge-host-owner-value');

        if (routeNode) routeNode.textContent = hostState.currentRoute;
        if (authNode) authNode.textContent = hostState.loggedIn ? 'true' : 'false';
        if (ownerNode) ownerNode.textContent = hostState.owner ? 'true' : 'false';
    }

    document.getElementById('bridge-host-login').addEventListener('click', function () {
        hostState.loggedIn = !hostState.loggedIn;
        window.localStorage.setItem('app_login', hostState.loggedIn ? '1' : '0');
        bridge.syncFromHost();
        renderHostControls();
    });

    document.getElementById('bridge-host-owner').addEventListener('click', function () {
        hostState.owner = !hostState.owner;
        window.TL.profile.owner = hostState.owner;
        bridge.syncFromHost();
        renderHostControls();
    });

    framework.init().then(function () {
        renderHostControls();
    });
})(window, document);
