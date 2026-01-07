/**
 * VXUI AI 模块初始化脚本
 */
(function() {
    'use strict';

    // 注册模块到 VXUI
    if (typeof VXUI !== 'undefined' && typeof VX_AI !== 'undefined') {
        VXUI.registerModule('ai', {
            init(params) {
                if (typeof TL !== 'undefined' && TL.ready) {
                    TL.ready(() => VX_AI.init(params));
                } else {
                    VX_AI.init(params);
                }
            },
            destroy() {
                if (typeof VX_AI.destroy === 'function') {
                    VX_AI.destroy();
                }
            },
            updateSidebar() {
                if (typeof VX_AI.updateSidebar === 'function') {
                    VX_AI.updateSidebar();
                }
            }
        });
    }

    // 设置 AI 模块特有事件
    function setupAIEvents() {
        // 输入框自动调整高度
        document.addEventListener('input', function(e) {
            if (e.target.id === 'vx-ai-input') {
                autoResizeTextarea(e.target);
            }
        });

        // 键盘快捷键
        document.addEventListener('keydown', function(e) {
            if (typeof VXUI === 'undefined' || VXUI.currentModule !== 'ai') return;
            if (typeof VX_AI === 'undefined') return;

            // 在输入框中
            if (e.target.id === 'vx-ai-input') {
                // Enter 发送 (Shift+Enter 换行)
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    VX_AI.sendMessage();
                }
            }

            // Ctrl/Cmd + N 新对话
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                if (typeof VX_AI.newConversation === 'function') {
                    VX_AI.newConversation();
                }
            }
        });
    }

    // 自动调整输入框高度
    function autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        const maxHeight = 120;
        const newHeight = Math.min(textarea.scrollHeight, maxHeight);
        textarea.style.height = newHeight + 'px';
    }

    setupAIEvents();
    console.log('[init_vx_ai] AI module initialized');

})();
