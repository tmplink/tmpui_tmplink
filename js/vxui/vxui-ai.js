/**
 * VXUI AI (AI 助手) Module
 * AI 对话模块 - 基于新 VXUI 框架
 * @version 1.0.0
 */

'use strict';

const VX_AI = {
    // 状态
    conversationId: null,
    messages: [],
    isLoading: false,
    
    /**
     * 初始化模块
     */
    init(params = {}) {
        console.log('[VX_AI] Initializing...', params);
        
        // 检查登录状态
        if (typeof TL !== 'undefined' && !TL.isLogin()) {
            VXUI.navigate('login');
            return;
        }
        
        // 重置状态
        this.resetState();
        
        // 更新侧边栏
        this.updateSidebar();
        
        // 绑定事件
        this.bindEvents();
        
        // 加载历史对话
        if (params.conversationId) {
            this.loadConversation(params.conversationId);
        }
    },
    
    /**
     * 销毁模块
     */
    destroy() {
        console.log('[VX_AI] Destroying...');
        this.unbindEvents();
    },
    
    /**
     * 重置状态
     */
    resetState() {
        this.conversationId = null;
        this.messages = [];
        this.isLoading = false;
    },
    
    /**
     * 更新侧边栏
     */
    updateSidebar() {
        const sidebarDynamic = document.getElementById('vx-sidebar-dynamic');
        if (!sidebarDynamic) return;
        
        sidebarDynamic.innerHTML = `
            <div class="vx-nav-section">
                <div class="vx-nav-title" data-tpl="ai_actions">操作</div>
                <a href="javascript:;" class="vx-nav-item" onclick="VX_AI.newConversation()">
                    <iconpark-icon name="circle-plus"></iconpark-icon>
                    <span class="vx-nav-item-text" data-tpl="ai_new">新对话</span>
                </a>
                <a href="javascript:;" class="vx-nav-item" onclick="VX_AI.clearHistory()">
                    <iconpark-icon name="trash"></iconpark-icon>
                    <span class="vx-nav-item-text" data-tpl="ai_clear">清空对话</span>
                </a>
            </div>
        `;
        
        if (typeof app !== 'undefined') {
            app.languageBuild();
        }

        if (typeof VXUI !== 'undefined' && typeof VXUI.refreshSidebarDivider === 'function') {
            VXUI.refreshSidebarDivider();
        }
    },
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 输入框事件
        this._inputHandler = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        };
        
        setTimeout(() => {
            const input = document.getElementById('vx-ai-input');
            input?.addEventListener('keydown', this._inputHandler);
        }, 100);
    },
    
    /**
     * 解绑事件
     */
    unbindEvents() {
        const input = document.getElementById('vx-ai-input');
        if (input && this._inputHandler) {
            input.removeEventListener('keydown', this._inputHandler);
        }
    },
    
    /**
     * 发送消息
     */
    sendMessage() {
        const input = document.getElementById('vx-ai-input');
        const message = input?.value?.trim();
        
        if (!message || this.isLoading) return;
        
        // 清空输入框
        input.value = '';
        
        // 添加用户消息
        this.addMessage('user', message);
        
        // 发送到 AI
        this.callAI(message);
    },
    
    /**
     * 添加消息到列表
     */
    addMessage(role, content) {
        this.messages.push({ role, content, time: Date.now() });
        this.renderMessages();
        this.scrollToBottom();
    },
    
    /**
     * 渲染消息列表
     */
    renderMessages() {
        const container = document.getElementById('vx-ai-messages');
        if (!container) return;
        
        if (this.messages.length === 0) {
            container.innerHTML = `
                <div class="vx-ai-welcome">
                    <div class="vx-ai-welcome-icon">
                        <iconpark-icon name="robot"></iconpark-icon>
                    </div>
                    <h3>AI 助手</h3>
                    <p>有什么我可以帮助你的吗？</p>
                    <div class="vx-ai-suggestions">
                        <button class="vx-ai-suggestion" onclick="VX_AI.useSuggestion('帮我分析一下我的文件使用情况')">
                            分析文件使用情况
                        </button>
                        <button class="vx-ai-suggestion" onclick="VX_AI.useSuggestion('如何创建一个共享文件夹？')">
                            创建共享文件夹
                        </button>
                        <button class="vx-ai-suggestion" onclick="VX_AI.useSuggestion('什么是直链，如何使用？')">
                            了解直链功能
                        </button>
                    </div>
                </div>
            `;
            return;
        }
        
        let html = '';
        this.messages.forEach(msg => {
            html += this.renderMessage(msg);
        });
        
        // 如果正在加载，添加加载指示器
        if (this.isLoading) {
            html += `
                <div class="vx-ai-message vx-ai-message-assistant">
                    <div class="vx-ai-avatar">
                        <iconpark-icon name="robot"></iconpark-icon>
                    </div>
                    <div class="vx-ai-bubble">
                        <div class="vx-ai-typing">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
    },
    
    /**
     * 渲染单条消息
     */
    renderMessage(msg) {
        const isUser = msg.role === 'user';
        const content = this.formatContent(msg.content);
        
        return `
            <div class="vx-ai-message vx-ai-message-${msg.role}">
                <div class="vx-ai-avatar">
                    <iconpark-icon name="${isUser ? 'user' : 'robot'}"></iconpark-icon>
                </div>
                <div class="vx-ai-bubble">
                    <div class="vx-ai-content">${content}</div>
                </div>
            </div>
        `;
    },
    
    /**
     * 格式化内容（支持 Markdown）
     */
    formatContent(content) {
        // 简单的 Markdown 解析
        // 代码块
        content = content.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
        // 行内代码
        content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
        // 粗体
        content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // 斜体
        content = content.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        // 链接
        content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        // 换行
        content = content.replace(/\n/g, '<br>');
        
        return content;
    },
    
    /**
     * 使用建议
     */
    useSuggestion(text) {
        const input = document.getElementById('vx-ai-input');
        if (input) {
            input.value = text;
            input.focus();
        }
    },
    
    /**
     * 调用 AI API
     */
    callAI(message) {
        this.isLoading = true;
        this.renderMessages();
        this.scrollToBottom();
        
        if (typeof TL === 'undefined' || typeof AI === 'undefined') {
            // 模拟响应
            setTimeout(() => {
                this.isLoading = false;
                this.addMessage('assistant', '抱歉，AI 服务暂时不可用。请稍后再试。');
            }, 1000);
            return;
        }
        
        // 调用实际的 AI API
        $.post(TL.api_ai, {
            action: 'chat',
            token: TL.api_token,
            message: message,
            conversation_id: this.conversationId
        }, (rsp) => {
            this.isLoading = false;
            
            if (rsp.status === 1) {
                this.conversationId = rsp.data.conversation_id;
                this.addMessage('assistant', rsp.data.reply || '');
            } else {
                this.addMessage('assistant', rsp.message || '发生错误，请重试。');
            }
        }).fail(() => {
            this.isLoading = false;
            this.addMessage('assistant', '网络错误，请检查连接后重试。');
        });
    },
    
    /**
     * 新对话
     */
    newConversation() {
        VXUI.confirm({
            title: '新建对话',
            message: '确定要开始新对话吗？当前对话将被保存。',
            onConfirm: () => {
                this.resetState();
                this.renderMessages();
            }
        });
    },
    
    /**
     * 清空历史
     */
    clearHistory() {
        VXUI.confirm({
            title: '清空对话',
            message: '确定要清空当前对话吗？此操作不可撤销。',
            confirmClass: 'vx-btn-danger',
            onConfirm: () => {
                this.messages = [];
                this.renderMessages();
                VXUI.toastSuccess('对话已清空');
            }
        });
    },
    
    /**
     * 加载历史对话
     */
    loadConversation(id) {
        this.conversationId = id;
        // TODO: 实现加载历史对话
    },
    
    /**
     * 滚动到底部
     */
    scrollToBottom() {
        const container = document.getElementById('vx-ai-messages');
        if (container) {
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 100);
        }
    }
};

// 注册模块
if (typeof VXUI !== 'undefined') {
    VXUI.registerModule('ai', VX_AI);
}
