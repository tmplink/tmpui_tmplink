/**
 * VXUI 初始化脚本
 * 负责加载和初始化 VXUI 框架
 */

(function() {
    'use strict';

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

        // 注册所有模块
        registerModules();

        // 初始化框架
        VXUI.init();

        console.log('[init_vx] VXUI initialized');
    }

    // 使用 app.ready 确保 tmpUI 就绪
    if (typeof app !== 'undefined' && typeof app.ready === 'function') {
        app.ready(function() {
            initVXUI();
        });
    } else {
        // 降级：DOM 就绪后初始化
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            initVXUI();
        } else {
            document.addEventListener('DOMContentLoaded', initVXUI);
        }
    }

})();
