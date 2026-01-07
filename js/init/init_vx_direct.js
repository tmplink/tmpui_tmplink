/**
 * VXUI Direct 模块初始化脚本
 */
(function() {
    'use strict';

    // 注册模块到 VXUI
    if (typeof VXUI !== 'undefined' && typeof VX_DIRECT !== 'undefined') {
        VXUI.registerModule('direct', {
            init(params) {
                if (typeof TL !== 'undefined' && TL.ready) {
                    TL.ready(() => VX_DIRECT.init(params));
                } else {
                    VX_DIRECT.init(params);
                }
            },
            destroy() {
                if (typeof VX_DIRECT.destroy === 'function') {
                    VX_DIRECT.destroy();
                }
            },
            updateSidebar() {
                if (typeof VX_DIRECT.updateSidebar === 'function') {
                    VX_DIRECT.updateSidebar();
                }
            }
        });
    }

    // 设置直链模块特有事件
    function setupDirectEvents() {
        // 无限滚动加载
        let scrollTimeout = null;
        
        window.addEventListener('scroll', function() {
            if (typeof VXUI === 'undefined' || VXUI.currentModule !== 'direct') return;
            if (typeof VX_DIRECT === 'undefined' || !VX_DIRECT.hasMore) return;

            // 节流
            if (scrollTimeout) return;
            
            scrollTimeout = setTimeout(function() {
                scrollTimeout = null;
                
                const scrollTop = window.scrollY;
                const windowHeight = window.innerHeight;
                const docHeight = document.documentElement.scrollHeight;
                
                // 距离底部 200px 时加载更多
                if (scrollTop + windowHeight >= docHeight - 200) {
                    VX_DIRECT.loadMore();
                }
            }, 100);
        });
    }

    setupDirectEvents();
    console.log('[init_vx_direct] Direct module initialized');

})();
