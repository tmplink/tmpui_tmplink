/**
 * VXUI 初始化脚本
 * 负责加载和初始化 VXUI 框架
 * 使用 api.js 作为后端 API 层
 */

(function() {
    'use strict';

    // 初始化 api.js 并设置为全局 TL
    function initTmplink() {
        if (typeof tmplink_api !== 'undefined') {
            window.TL = new tmplink_api();
            console.log('[init_vx] api.js initialized as TL');
            return;
        }
        console.warn('[init_vx] api.js not available');
    }

    // 注册所有可用模块
    function registerModules() {
        if (typeof VXUI === 'undefined') return;

        // 文件列表模块
        if (typeof VX_FILELIST !== 'undefined') {
            VXUI.registerModule('filelist', VX_FILELIST);
        }

        // 直链模块
        if (typeof VX_DIRECT !== 'undefined') {
            VXUI.registerModule('direct', VX_DIRECT);
        }

        // 密记模块
        if (typeof VX_NOTES !== 'undefined') {
            VXUI.registerModule('notes', VX_NOTES);
        }

        // AI 模块
        if (typeof VX_AI !== 'undefined') {
            VXUI.registerModule('ai', VX_AI);
        }
    }

    // 初始化 VXUI
    function initVXUI() {
        if (typeof VXUI === 'undefined') {
            console.error('[init_vx] VXUI not loaded');
            return;
        }

        // 添加 body class 标记 VXUI 激活状态（用于 CSS 样式）
        document.body.classList.add('vx-active');

        // 注册所有模块
        registerModules();

        // 初始化框架
        VXUI.init();

        if (typeof TL !== 'undefined' && typeof TL.keep_alive === 'function') {
            TL.keep_alive();
        }

        console.log('[init_vx] VXUI initialized');
    }

    // 使用 app.ready 确保 tmpUI 就绪
    if (typeof app !== 'undefined' && typeof app.ready === 'function') {
        app.ready(function() {
            // 先初始化 api.js
            initTmplink();

            // 等待 TL ready 后再初始化 VXUI
            if (typeof TL !== 'undefined' && typeof TL.ready === 'function') {
                TL.ready(function() {
                    // 同步语言设置
                    if (typeof app !== 'undefined' && app.languageSetting) {
                        TL.language(app.languageSetting);
                    }
                    initVXUI();
                });
            } else {
                initVXUI();
            }
        });
    } else {
        // 降级：DOM 就绪后初始化
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            initTmplink();
            initVXUI();
        } else {
            document.addEventListener('DOMContentLoaded', function() {
                initTmplink();
                initVXUI();
            });
        }
    }

})();
