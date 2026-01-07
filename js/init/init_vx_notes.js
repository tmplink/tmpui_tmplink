/**
 * VXUI Notes 模块初始化脚本
 */
(function() {
    'use strict';

    // 注册模块到 VXUI
    if (typeof VXUI !== 'undefined' && typeof VX_NOTES !== 'undefined') {
        VXUI.registerModule('notes', {
            init(params) {
                if (typeof TL !== 'undefined' && TL.ready) {
                    TL.ready(() => VX_NOTES.init(params));
                } else {
                    VX_NOTES.init(params);
                }
            },
            destroy() {
                if (typeof VX_NOTES.destroy === 'function') {
                    VX_NOTES.destroy();
                }
            },
            updateSidebar() {
                if (typeof VX_NOTES.updateSidebar === 'function') {
                    VX_NOTES.updateSidebar();
                }
            }
        });
    }

    // 设置密记模块特有事件
    function setupNotesEvents() {
        // 自动保存提示
        let saveIndicatorTimeout = null;
        
        document.addEventListener('vxNoteSaved', function(e) {
            // 显示保存成功提示
            const indicator = document.querySelector('#vx-notes-save-indicator');
            if (indicator) {
                indicator.classList.add('vx-show');
                
                clearTimeout(saveIndicatorTimeout);
                saveIndicatorTimeout = setTimeout(function() {
                    indicator.classList.remove('vx-show');
                }, 2000);
            }
        });

        // 阻止离开页面时丢失未保存内容
        window.addEventListener('beforeunload', function(e) {
            if (typeof VXUI === 'undefined' || VXUI.currentModule !== 'notes') return;
            if (typeof VX_NOTES === 'undefined' || !VX_NOTES.hasUnsavedChanges) return;
            
            if (VX_NOTES.hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '您有未保存的更改，确定要离开吗？';
                return e.returnValue;
            }
        });

        // 键盘快捷键
        document.addEventListener('keydown', function(e) {
            if (typeof VXUI === 'undefined' || VXUI.currentModule !== 'notes') return;
            if (typeof VX_NOTES === 'undefined') return;

            // Ctrl/Cmd + S 保存
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (typeof VX_NOTES.saveCurrentNote === 'function') {
                    VX_NOTES.saveCurrentNote();
                }
            }

            // Ctrl/Cmd + N 新建
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                if (typeof VX_NOTES.createNote === 'function') {
                    VX_NOTES.createNote();
                }
            }
        });
    }

    setupNotesEvents();
    console.log('[init_vx_notes] Notes module initialized');

})();
