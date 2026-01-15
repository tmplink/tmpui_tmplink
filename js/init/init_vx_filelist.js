/**
 * VXUI FileList Module Initializer
 * 文件列表模块初始化（支持列表/相册双视图）
 */
(() => {
    'use strict';
    
    // 注册模块到 VXUI
    if (typeof VXUI !== 'undefined') {
        VXUI.registerModule('filelist', {
            init(params) {
                if (TL?.ready) {
                    TL.ready(() => VX_FILELIST.init(params));
                } else {
                    VX_FILELIST.init(params);
                }
            },
            destroy() {
                if (typeof VX_FILELIST !== 'undefined' && VX_FILELIST.destroy) {
                    VX_FILELIST.destroy();
                }
            }
        });
    }
})();
