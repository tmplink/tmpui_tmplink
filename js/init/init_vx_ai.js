/**
 * VXUI AI 模块初始化脚本
 */
(function() {
    'use strict';

    // 模块注册由 js/vxui/vxui-ai.js 负责；此处仅提供额外事件

    // 设置 AI 模块特有事件
    function setupAIEvents() {
        // 输入框自动调整高度
        document.addEventListener('input', function(e) {
            if (e.target.id === 'vx-ai-input') {
                autoResizeTextarea(e.target);

                // 同步字数/发送按钮状态（防止模块内事件未及时绑定导致按钮永远禁用）
                if (typeof VXUI !== 'undefined' && VXUI.currentModule === 'ai' && typeof VX_AI !== 'undefined') {
                    if (typeof VX_AI.updateCharCount === 'function') VX_AI.updateCharCount();
                    if (typeof VX_AI.updateSendButton === 'function') VX_AI.updateSendButton();
                }
            }
        });

        // 键盘快捷键
        document.addEventListener('keydown', function(e) {
            if (typeof VXUI === 'undefined' || VXUI.currentModule !== 'ai') return;
            if (typeof VX_AI === 'undefined') return;

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
