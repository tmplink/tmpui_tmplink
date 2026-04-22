'use strict';

/**
 * TMP_SUPPORT_WIDGET — 客服支持组件
 *
 * 用于下载页面（file_desktop / file_mobile）及首页、登录/注册等页面。
 * - 下载页面：复用页面内已有的 #supportModal（.file-modal 体系），通过 fileUI 打开。
 * - 其他页面：使用独立悬浮遮罩层（.tmp-support-widget-overlay）。
 */
(function () {
    var IFRAME_SRC = 'https://www.vxai.link/agent/c6583dcd33fc/?config=13';
    var _overlay = null;

    function _escHandler(e) {
        if (e.key === 'Escape') {
            window.TMP_SUPPORT_WIDGET.close();
        }
    }

    function _openOverlay() {
        if (!_overlay) {
            _overlay = document.createElement('div');
            _overlay.className = 'tmp-support-widget-overlay';
            _overlay.innerHTML =
                '<div class="tmp-support-widget-panel">' +
                    '<div class="tmp-support-widget-body">' +
                        '<iframe src="' + IFRAME_SRC + '" ' +
                            'style="width:100%;height:100%;border:0;display:block;" ' +
                            'allow="microphone" loading="lazy"></iframe>' +
                    '</div>' +
                '</div>';
            _overlay.addEventListener('click', function (e) {
                if (e.target === _overlay) {
                    window.TMP_SUPPORT_WIDGET.close();
                }
            });
            document.body.appendChild(_overlay);
        }
        _overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', _escHandler);
    }

    function _closeOverlay() {
        if (_overlay) {
            _overlay.classList.remove('open');
        }
        document.body.style.overflow = '';
        document.removeEventListener('keydown', _escHandler);
    }

    window.TMP_SUPPORT_WIDGET = {
        /**
         * 打开客服面板。
         * 优先使用页面内 #supportModal（文件下载页），否则使用独立遮罩层。
         */
        open: function () {
            var modal = document.getElementById('supportModal');
            if (modal && typeof window.fileUI !== 'undefined') {
                window.fileUI.openModal('supportModal');
            } else {
                _openOverlay();
            }
        },

        /**
         * 关闭客服面板。
         */
        close: function () {
            var modal = document.getElementById('supportModal');
            if (modal && typeof window.fileUI !== 'undefined') {
                window.fileUI.closeModal('supportModal');
            } else {
                _closeOverlay();
            }
        }
    };
}());
