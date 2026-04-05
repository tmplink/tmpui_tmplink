(function (window) {
    'use strict';

    function isFunction(value) {
        return typeof value === 'function';
    }

    class VXUITmpuiBridge {
        constructor(options) {
            const config = options || {};

            if (!config.framework) {
                throw new Error('VXUITmpuiBridge requires a framework instance');
            }

            this.framework = config.framework;
            this.app = config.app || window.app || null;
            this.service = config.service || window.TL || null;
            this.authResolver = isFunction(config.authResolver) ? config.authResolver : null;
            this.userResolver = isFunction(config.userResolver) ? config.userResolver : null;
            this.ownerResolver = isFunction(config.ownerResolver) ? config.ownerResolver : null;
            this.routeMap = config.routeMap || {};
            this.routeBuilder = isFunction(config.routeBuilder) ? config.routeBuilder : null;
            this.syncNavigationToHost = config.syncNavigationToHost === true;
            this.useDynOpen = config.useDynOpen !== false;

            this._attached = false;
            this._frameworkInitWrapped = false;
            this._onViewChange = this._handleFrameworkViewChange.bind(this);
            this._onStorage = this._handleStorage.bind(this);
        }

        attach() {
            this.framework.setAuthProvider(() => this.resolveAuthState());

            if (this.framework.initialized) {
                this._bindFrameworkEvents();
                this.syncFromHost();
                return this;
            }

            if (!this._frameworkInitWrapped) {
                const originalInit = this.framework.init.bind(this.framework);
                this.framework.init = async (...args) => {
                    const result = await originalInit(...args);
                    this._bindFrameworkEvents();
                    this.syncFromHost();
                    return result;
                };
                this._frameworkInitWrapped = true;
            }

            return this;
        }

        detach() {
            if (!this._attached) {
                return this;
            }

            const root = this.framework.getRootElement();
            if (root) {
                root.removeEventListener('vxui:viewchange', this._onViewChange);
            }

            window.removeEventListener('storage', this._onStorage);
            this._attached = false;
            return this;
        }

        _bindFrameworkEvents() {
            if (this._attached) {
                return;
            }

            const root = this.framework.getRootElement();
            if (!root) {
                return;
            }

            root.addEventListener('vxui:viewchange', this._onViewChange);
            window.addEventListener('storage', this._onStorage);
            this._attached = true;
        }

        resolveAuthState() {
            if (this.authResolver) {
                return this.authResolver({ app: this.app, service: this.service, framework: this.framework }) || {
                    loggedIn: false,
                    owner: false,
                    user: null
                };
            }

            const loggedIn = this._isLoggedIn();
            const user = this._resolveUser(loggedIn);
            const owner = this.ownerResolver
                ? !!this.ownerResolver({ app: this.app, service: this.service, user: user, loggedIn: loggedIn })
                : !!(user && (user.owner || user.isOwner));

            return {
                loggedIn: loggedIn,
                owner: owner,
                user: user
            };
        }

        _isLoggedIn() {
            if (this.service && isFunction(this.service.isLogin)) {
                try {
                    return !!this.service.isLogin();
                } catch (error) {
                    return false;
                }
            }

            if (this.service && this.service.logined != null) {
                return !!this.service.logined;
            }

            const stored = window.localStorage.getItem('app_login');
            return stored !== null && stored !== '0' && stored !== 'false';
        }

        _resolveUser(loggedIn) {
            if (!loggedIn) {
                return null;
            }

            if (this.userResolver) {
                return this.userResolver({ app: this.app, service: this.service, framework: this.framework }) || null;
            }

            const source = this.service || {};
            const profile = source.profile || {};
            const uid = source.uid != null ? source.uid : profile.uid;
            const displayName = profile.name || profile.username || profile.nickname || (uid ? 'User #' + uid : 'User');

            return {
                id: uid || null,
                name: displayName,
                owner: !!profile.owner,
                sponsor: !!source.sponsor,
                group: source.user_group || {}
            };
        }

        syncFromHost() {
            this.framework.refreshAuth();
            return this;
        }

        buildHostRoute(view, state) {
            if (this.routeBuilder) {
                return this.routeBuilder(view, state || {}, {
                    app: this.app,
                    service: this.service,
                    framework: this.framework
                });
            }

            const mapped = this.routeMap[view];
            if (isFunction(mapped)) {
                return mapped(state || {}, {
                    app: this.app,
                    service: this.service,
                    framework: this.framework
                });
            }

            if (typeof mapped === 'string') {
                return mapped;
            }

            return null;
        }

        _handleFrameworkViewChange(event) {
            if (!this.syncNavigationToHost || !event || !event.detail) {
                return;
            }

            const route = this.buildHostRoute(event.detail.view, event.detail.state || {});
            if (!route || !this.app) {
                return;
            }

            if (this.useDynOpen && isFunction(this.app.dynOpen)) {
                this.app.dynOpen(route);
                return;
            }

            if (isFunction(this.app.open)) {
                this.app.open(route);
            }
        }

        _handleStorage(event) {
            if (!event || event.key !== 'app_login') {
                return;
            }

            this.syncFromHost();
        }
    }

    window.VXUITmpuiBridge = VXUITmpuiBridge;
})(window);
