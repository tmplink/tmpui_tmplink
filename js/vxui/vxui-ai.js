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
    conversations: [],
    userStats: null,
    maxInputLength: 2000,
    
    /**
     * 初始化模块
     */
    init(params = {}) {
        console.log('[VX_AI] Initializing...', params);
        
        // 检查登录状态
        if (typeof TL !== 'undefined' && !TL.isLogin()) {
            VXUI.toastWarning('请先登录');
            setTimeout(() => {
                window.location.href = '/login';
            }, 300);
            return;
        }
        
        // 确保 token 可用（直达刷新时可能尚未恢复）
        this.ensureTokenReady();

        // 重置状态
        this.resetState();
        
        // 更新侧边栏
        this.updateSidebar();
        
        // 绑定事件
        this.bindEvents();

        // 初始化配额显示
        this.loadStatus();

        // 加载对话历史
        this.loadConversationHistory();
        
        // 直达 URL 指定对话
        if (params.conversationId) {
            this.switchConversation(params.conversationId);
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
        // conversations/userStats 不清空：用于侧边栏与配额显示
        this.setStatusText('就绪');
        this.updateCharCount();
        this.updateSendButton();
    },

    /**
     * 获取 AI API endpoint
     */
    getApiEndpoint() {
        if (typeof TL !== 'undefined') {
            if (TL.api_ai) return TL.api_ai;
            if (TL.api_url) return TL.api_url + '/ai';
        }
        return '/ai';
    },

    /**
     * 确保 token 可用
     */
    ensureTokenReady() {
        if (typeof TL === 'undefined') return null;
        if (TL.api_token) return TL.api_token;

        try {
            const tokenFromStorage = localStorage.getItem('app_token');
            if (tokenFromStorage) {
                TL.api_token = tokenFromStorage;
                return TL.api_token;
            }
        } catch (e) {
            // ignore
        }

        try {
            if (typeof getCookie === 'function') {
                const tokenFromCookie = getCookie('token');
                if (tokenFromCookie) {
                    TL.api_token = tokenFromCookie;
                    return TL.api_token;
                }
            }
        } catch (e) {
            // ignore
        }

        return TL.api_token;
    },

    /**
     * 统一请求封装
     */
    apiPost(action, data = {}, options = {}) {
        const $ = window.$;
        if (typeof $ === 'undefined' || typeof $.post !== 'function') {
            return Promise.reject(new Error('jQuery not available'));
        }

        const token = this.ensureTokenReady();
        if (!token && options.retryIfNoToken) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const retryToken = this.ensureTokenReady();
                    if (!retryToken) {
                        reject(new Error('token not ready'));
                        return;
                    }
                    this.apiPost(action, data, { ...options, retryIfNoToken: false }).then(resolve).catch(reject);
                }, options.retryDelayMs || 300);
            });
        }

        return new Promise((resolve, reject) => {
            $.post(
                this.getApiEndpoint(),
                {
                    action,
                    token: token,
                    ...data
                },
                (rsp) => {
                    if (!rsp) {
                        reject(new Error('empty response'));
                        return;
                    }

                    if (rsp.status === 1) {
                        resolve(rsp.data);
                        return;
                    }

                    // 5: service unavailable
                    if (rsp.status === 5) {
                        reject(new Error(rsp.data || rsp.message || 'AI service unavailable'));
                        return;
                    }

                    reject(new Error(rsp.data || rsp.message || 'request failed'));
                },
                'json'
            ).fail((xhr, textStatus) => {
                const msg = (xhr && xhr.responseJSON && (xhr.responseJSON.message || xhr.responseJSON.data))
                    ? (xhr.responseJSON.message || xhr.responseJSON.data)
                    : (textStatus || 'network error');
                reject(new Error(msg));
            });
        });
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
                    <span class="vx-nav-item-text" data-tpl="ai_clear">清空当前</span>
                </a>
            </div>

            <div class="vx-nav-section">
                <div class="vx-nav-title">对话历史</div>
                <div id="vx-ai-conversation-list"></div>
                <a href="javascript:;" class="vx-nav-item vx-ai-nav-danger" onclick="VX_AI.deleteAllConversationsUI()">
                    <iconpark-icon name="delete"></iconpark-icon>
                    <span class="vx-nav-item-text">删除全部对话</span>
                </a>
            </div>

            <style>
                .vx-ai-nav-danger { color: var(--vx-danger); }
                .vx-ai-nav-danger:hover { background: rgba(239, 68, 68, 0.08); }
                .vx-ai-conv-item { position: relative; flex-direction: column; align-items: stretch; gap: 6px; }
                .vx-ai-conv-top { display: flex; align-items: center; gap: 12px; }
                .vx-ai-conv-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .vx-ai-conv-time { font-size: var(--vx-text-xs); color: var(--vx-text-muted); padding-left: 32px; }
                .vx-ai-conv-del {
                    margin-left: auto;
                    border: none;
                    background: transparent;
                    color: var(--vx-text-muted);
                    padding: 4px;
                    cursor: pointer;
                    border-radius: var(--vx-radius);
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .vx-ai-conv-del:hover { color: var(--vx-danger); background: rgba(239, 68, 68, 0.08); }
            </style>
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
        this._keydownHandler = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        };

        this._inputHandler = () => {
            const input = document.getElementById('vx-ai-input');
            if (!input) return;
            this.autoResizeTextarea(input);
            this.updateCharCount();
            this.updateSendButton();
        };
        
        setTimeout(() => {
            const input = document.getElementById('vx-ai-input');
            input?.addEventListener('keydown', this._keydownHandler);
            input?.addEventListener('input', this._inputHandler);
            this.autoResizeTextarea(input);
            this.updateCharCount();
            this.updateSendButton();
        }, 100);
    },
    
    /**
     * 解绑事件
     */
    unbindEvents() {
        const input = document.getElementById('vx-ai-input');
        if (input && this._keydownHandler) {
            input.removeEventListener('keydown', this._keydownHandler);
        }
        if (input && this._inputHandler) {
            input.removeEventListener('input', this._inputHandler);
        }
    },

    autoResizeTextarea(textarea) {
        if (!textarea) return;
        textarea.style.height = 'auto';
        const maxHeight = 120;
        const newHeight = Math.min(textarea.scrollHeight, maxHeight);
        textarea.style.height = newHeight + 'px';
    },

    updateCharCount() {
        const input = document.getElementById('vx-ai-input');
        const el = document.getElementById('vx-ai-char-count');
        if (!input || !el) return;
        const len = (input.value || '').length;
        el.textContent = `${len}/${this.maxInputLength}`;
    },

    setStatusText(text, level = 'normal') {
        const el = document.getElementById('vx-ai-status');
        if (!el) return;
        el.textContent = text;
        el.classList.remove('vx-ai-status-error', 'vx-ai-status-warn', 'vx-ai-status-loading');
        if (level === 'error') el.classList.add('vx-ai-status-error');
        if (level === 'warn') el.classList.add('vx-ai-status-warn');
        if (level === 'loading') el.classList.add('vx-ai-status-loading');
    },

    canSendMessage() {
        if (!this.userStats) return true;
        const remaining = Number(this.userStats.token_remaining || 0);
        return remaining > 0;
    },

    updateSendButton() {
        const input = document.getElementById('vx-ai-input');
        const sendBtn = document.querySelector('.vx-ai-send-btn');
        if (!sendBtn) return;

        const hasText = !!(input && input.value && input.value.trim());
        const canSend = !this.isLoading && this.canSendMessage() && hasText;
        sendBtn.disabled = !canSend;
        sendBtn.style.opacity = canSend ? '1' : '0.6';
        sendBtn.style.cursor = canSend ? 'pointer' : 'not-allowed';
    },
    
    /**
     * 发送消息
     */
    sendMessage() {
        const input = document.getElementById('vx-ai-input');
        const message = input?.value?.trim();

        // 确保 UI 状态与逻辑一致（Enter 与点击按钮同一套规则）
        this.updateCharCount();
        this.updateSendButton();
        
        if (!message || this.isLoading) return;

        if (!this.canSendMessage()) {
            VXUI.toastError('您的 AI 配额已耗尽，请稍后再试');
            this.setStatusText('配额耗尽', 'warn');
            this.updateSendButton();
            return;
        }
        
        // 清空输入框
        input.value = '';
        this.autoResizeTextarea(input);
        this.updateCharCount();
        this.updateSendButton();
        
        // 添加用户消息
        this.addMessage('user', message);
        
        // 发送到 AI
        this.callAI(message);
    },
    
    /**
     * 添加消息到列表
     */
    addMessage(role, content) {
        const normalizedRole = this.normalizeRole(role);
        this.messages.push({ role: normalizedRole, content, time: Date.now() });
        this.renderMessages();
        this.scrollToBottom();
    },

    normalizeRole(role) {
        const r = String(role || '').toLowerCase();
        if (r === 'user') return 'user';
        if (r === 'assistant' || r === 'ai' || r === 'bot') return 'assistant';
        if (r === 'system') return 'system';
        // 默认按 assistant 处理，避免无样式/无头像
        return 'assistant';
    },
    
    /**
     * 渲染消息列表
     */
    renderMessages() {
        const container = document.getElementById('vx-ai-messages');
        if (!container) return;
        
        if (this.messages.length === 0) {
            if (this.isLoading) {
                container.innerHTML = `
                    <div class="vx-ai-welcome">
                        <div class="vx-ai-welcome-icon">
                            <iconpark-icon name="user-robot"></iconpark-icon>
                        </div>
                        <h3>加载中…</h3>
                        <p>正在获取对话内容</p>
                    </div>
                `;
                return;
            }
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
                        <iconpark-icon name="user-robot"></iconpark-icon>
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
        const role = this.normalizeRole(msg.role);
        const isUser = role === 'user';
        const isSystem = role === 'system';
        const content = this.formatContent(msg.content);

        const avatarIcon = isUser ? 'user' : 'user-robot';
        
        return `
            <div class="vx-ai-message vx-ai-message-${role}">
                <div class="vx-ai-avatar">${isSystem ? '' : `<iconpark-icon name="${avatarIcon}"></iconpark-icon>`}</div>
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
        const raw = String(content ?? '');

        // 优先使用 marked（项目已预置）
        try {
            if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
                return marked.parse(raw);
            }
        } catch (e) {
            // fallthrough
        }

        // 兜底：简单 Markdown
        let html = raw;
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        html = html.replace(/\n/g, '<br>');
        return html;
    },
    
    /**
     * 使用建议
     */
    useSuggestion(text) {
        const input = document.getElementById('vx-ai-input');
        if (input) {
            input.value = text;
            input.focus();
            this.autoResizeTextarea(input);
            this.updateCharCount();
            this.updateSendButton();
        }
    },
    
    /**
     * 调用 AI API
     */
    callAI(message) {
        const isNewConversation = !this.conversationId;
        this.isLoading = true;
        this.setStatusText('思考中…', 'loading');
        this.renderMessages();
        this.scrollToBottom();
        this.updateSendButton();

        const action = this.conversationId ? 'continue' : 'chat';
        const payload = this.conversationId
            ? { conversation_id: this.conversationId, message }
            : { message };

        this.apiPost(action, payload, { retryIfNoToken: true })
            .then((data) => {
                this.isLoading = false;
                this.setStatusText('就绪');

                // 更新配额
                if (data && data.user_stats) {
                    this.updateUserStats(data.user_stats);
                } else {
                    // 尝试刷新一次状态
                    this.loadStatus(false);
                }

                // 更新对话ID
                if (!this.conversationId && data && data.conversation_id) {
                    this.conversationId = data.conversation_id;
                }

                // 从返回的 messages 中取最新 assistant 回复
                if (data && Array.isArray(data.messages) && data.messages.length > 0) {
                    const last = data.messages[data.messages.length - 1];
                    if (last && last.role === 'assistant') {
                        this.addMessage('assistant', last.content || '');
                    }
                } else if (data && typeof data.reply === 'string') {
                    // 兼容另一种返回结构
                    this.addMessage('assistant', data.reply);
                }

                // 新对话：刷新历史列表并高亮
                if (isNewConversation) {
                    this.loadConversationHistory();
                    setTimeout(() => this.highlightActiveConversation(), 300);
                } else {
                    this.highlightActiveConversation();
                }

                this.updateSendButton();
            })
            .catch((err) => {
                this.isLoading = false;
                this.setStatusText('发送失败', 'error');

                const msg = (err && err.message) ? err.message : '网络错误，请检查连接后重试。';
                this.addMessage('assistant', msg);
                this.loadStatus(false);
                this.updateSendButton();
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
                this.highlightActiveConversation();
            }
        });
    },
    
    /**
     * 清空历史
     */
    clearHistory() {
        VXUI.confirm({
            title: '清空对话',
            message: '确定要清空当前对话显示吗？（不会删除服务器上的历史对话）',
            confirmClass: 'vx-btn-danger',
            onConfirm: () => {
                this.messages = [];
                this.renderMessages();
                VXUI.toastSuccess('对话已清空');
                this.setStatusText('就绪');
                this.updateSendButton();
            }
        });
    },
    
    /**
     * 加载历史对话
     */
    loadConversationHistory(limit = 20) {
        this.apiPost('history', { limit: String(limit) }, { retryIfNoToken: true })
            .then((list) => {
                this.conversations = Array.isArray(list) ? list : [];
                this.renderConversationList();
            })
            .catch(() => {
                this.conversations = [];
                this.renderConversationList();
            });
    },

    renderConversationList() {
        const container = document.getElementById('vx-ai-conversation-list');
        if (!container) return;

        if (!this.conversations || this.conversations.length === 0) {
            container.innerHTML = `
                <div class="vx-nav-stats">
                    <div class="vx-nav-stat-item">
                        <iconpark-icon name="inbox"></iconpark-icon>
                        <span>暂无历史对话</span>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = this.conversations.map(conv => {
            const id = conv.conversation_id;
            const title = (conv.title || '新对话').toString();
            const time = (conv.time || '').toString();
            const activeClass = (this.conversationId && id === this.conversationId) ? 'active' : '';
            return `
                <a href="javascript:;" class="vx-nav-item vx-ai-conv-item ${activeClass}" data-conversation-id="${id}" onclick="VX_AI.switchConversation('${id}')">
                    <div class="vx-ai-conv-top">
                        <iconpark-icon name="message-circle"></iconpark-icon>
                        <span class="vx-ai-conv-title">${this.escapeHtml(title)}</span>
                        <button type="button" class="vx-ai-conv-del" title="删除" onclick="event.stopPropagation(); VX_AI.deleteConversationUI('${id}')">
                            <iconpark-icon name="trash"></iconpark-icon>
                        </button>
                    </div>
                    ${time ? `<div class="vx-ai-conv-time">${this.escapeHtml(time)}</div>` : ''}
                </a>
            `;
        }).join('');

        this.highlightActiveConversation();
    },

    highlightActiveConversation() {
        const container = document.getElementById('vx-ai-conversation-list');
        if (!container) return;
        const items = container.querySelectorAll('.vx-ai-conv-item');
        items.forEach(it => it.classList.remove('active'));
        if (!this.conversationId) return;
        const active = container.querySelector(`.vx-ai-conv-item[data-conversation-id="${this.conversationId}"]`);
        if (active) active.classList.add('active');
    },

    switchConversation(conversationId) {
        if (!conversationId) return;
        this.conversationId = conversationId;
        this.messages = [];
        this.isLoading = true;
        this.setStatusText('加载对话…', 'loading');
        this.renderMessages();
        this.highlightActiveConversation();

        this.apiPost('get_conversation', { conversation_id: conversationId }, { retryIfNoToken: true })
            .then((conversation) => {
                this.isLoading = false;
                this.setStatusText('就绪');
                const msgs = (conversation && Array.isArray(conversation.messages)) ? conversation.messages : [];
                this.messages = msgs.map(m => ({
                    role: this.normalizeRole(m && m.role),
                    content: m && m.content,
                    time: Date.now()
                }));
                this.renderMessages();
                this.scrollToBottom();
                this.loadStatus(false);
                this.updateSendButton();
            })
            .catch((err) => {
                this.isLoading = false;
                this.setStatusText('加载失败', 'error');
                const msg = (err && err.message) ? err.message : '加载对话失败';
                this.messages = [{ role: 'assistant', content: msg, time: Date.now() }];
                this.renderMessages();
                this.updateSendButton();
            });
    },

    deleteConversationUI(conversationId) {
        if (!conversationId) return;
        VXUI.confirm({
            title: '删除对话',
            message: '确定要删除这个对话吗？此操作不可撤销。',
            confirmClass: 'vx-btn-danger',
            onConfirm: () => {
                this.apiPost('delete', { conversation_id: conversationId }, { retryIfNoToken: true })
                    .then(() => {
                        if (this.conversationId === conversationId) {
                            this.resetState();
                            this.renderMessages();
                        }
                        this.loadConversationHistory();
                        VXUI.toastSuccess('已删除');
                    })
                    .catch((err) => {
                        VXUI.toastError((err && err.message) ? err.message : '删除失败');
                    });
            }
        });
    },

    deleteAllConversationsUI() {
        if (!this.conversations || this.conversations.length === 0) {
            VXUI.toastError('没有可删除的对话');
            return;
        }
        VXUI.confirm({
            title: '删除全部对话',
            message: '确定要删除全部历史对话吗？此操作不可撤销。',
            confirmClass: 'vx-btn-danger',
            onConfirm: async () => {
                // 逐个删除：与老版一致，避免后端无 delete_all action
                const ids = this.conversations.map(c => c.conversation_id).filter(Boolean);
                this.setStatusText('删除中…', 'loading');
                for (const id of ids) {
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        await this.apiPost('delete', { conversation_id: id }, { retryIfNoToken: true });
                    } catch (e) {
                        // continue
                    }
                }
                this.resetState();
                this.renderMessages();
                this.loadConversationHistory();
                VXUI.toastSuccess('已删除全部对话');
            }
        });
    },

    loadStatus(retryIfFail = true) {
        this.apiPost('status', {}, { retryIfNoToken: true })
            .then((stats) => {
                this.updateUserStats(stats);
            })
            .catch(() => {
                if (!retryIfFail) return;
                setTimeout(() => this.loadStatus(false), 800);
            });
    },

    updateUserStats(stats) {
        this.userStats = stats || null;
        this.updateQuotaUI();
        this.updateSendButton();
    },

    updateQuotaUI() {
        const indicator = document.getElementById('vx-ai-quota-indicator');
        const progress = document.getElementById('vx-ai-quota-progress');
        const text = document.getElementById('vx-ai-quota-text');
        if (!indicator || !progress || !text || !this.userStats) return;

        const remaining = Number(this.userStats.token_remaining || 0);
        const limit = Number(this.userStats.token_limit || 4000);
        const percentage = Math.max(0, Math.min(100, (remaining / Math.max(limit, 1)) * 100));

        indicator.style.display = 'flex';
        progress.style.width = percentage + '%';
        text.textContent = `${remaining}/${limit}`;

        // 颜色
        let color = 'var(--vx-success)';
        if (percentage < 10) color = 'var(--vx-danger)';
        else if (percentage < 30) color = 'var(--vx-warning)';
        progress.style.background = color;

        if (remaining <= 0) {
            this.setStatusText('配额耗尽', 'warn');
        }
    },

    escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
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
