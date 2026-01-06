/**
 * AI 聊天服务核心类
 * 遵循项目API调用规范
 */
class ai {
    
    parent_op = null
    conversations = []
    currentConversationId = null
    isLoading = false
    currentMessages = []
    userStats = null
    
    /**
     * 初始化AI服务
     * @param {tmplink} parent_op 父对象实例
     */
    init(parent_op) {
        this.parent_op = parent_op
    }
    
    /**
     * 初始化AI界面和事件
     */
    initUI() {
        // 设置页面标题和描述
        app.languageBuild()
        $('title').html(app.languageData.ai_page_title || '智能小薇 - TMP.LINK')
        $('meta[name=description]').attr('content', app.languageData.ai_page_description || '智能小薇，智能对话体验')

        // 发送页面访问统计
        this.parent_op.ga('AI_Page')

        // 初始化界面
        this.initListView()
        
        // 显示AI聊天界面
        setTimeout(() => {
            $('#ai_chat').show()
        }, 100)
        
        // 加载对话历史
        this.loadConversationHistory()

        // 绑定事件
        this.bindEvents()
        
        // 初始化配额显示
        this.initQuotaDisplay()
        
        // 绑定删除按钮悬停事件
        this.bindDeleteButtonHover()
    }
    
    /**
     * 初始化AI listview界面
     */
    initListView() {
        // 设置navbar（仅当用户已登录时显示）
        if (localStorage.getItem('app_login') == 1) {
            $('.auth-logged-in').show();
        }
        
        // 移动端UI调整
        $('.mobile-head-padding-large').css('padding-top', '100px')
    }
    
    /**
     * 绑定AI事件
     */
    bindEvents() {
        // 输入框自动调整大小和字符计数
        $('#ai_input').on('input', () => {
            this.autoResizeTextarea($('#ai_input')[0])
        })
        
        // 回车发送消息
        $('#ai_input').on('keypress', (e) => {
            if (e.keyCode === 13 && !e.shiftKey) {
                e.preventDefault()
                this.sendMessage()
            }
        })
    }
    
    /**
     * 绑定删除按钮悬停事件
     */
    bindDeleteButtonHover() {
        // 悬停在对话历史区域时显示删除按钮
        $('#ai_sidebar_content').hover(
            function() {
                // 鼠标进入
                $('#ai_delete_all_btn').css('opacity', '1')
            },
            function() {
                // 鼠标离开
                $('#ai_delete_all_btn').css('opacity', '0')
            }
        )
    }
    
    /**
     * 加载对话历史
     */
    loadConversationHistory() {
        this.getHistoryList(20, 
            (conversations) => {
                this.updateConversationListUI(conversations)
            },
            (error) => {
                console.error('加载对话历史失败:', error)
                this.updateConversationListUI([])
            }
        )
    }
    
    /**
     * 更新对话列表UI
     */
    updateConversationListUI(conversations) {
        // 检测是否为移动端
        const isMobile = isMobileScreen()
        
        // 根据设备类型选择容器和模板
        let listContainer, template, noConvElement
        
        if (isMobile) {
            listContainer = $('#ai_conversation_list_mobile_new')
            template = 'ai_conversation_list_mobile_new_tpl'
            noConvElement = $('.no_conversations_mobile')
            
            // 显示移动端主容器
            $('#ai_chat_mobile').show()
        } else {
            listContainer = $('#ai_conversation_list')
            template = 'ai_conversation_list_tpl'
            noConvElement = $('.no_conversations')
        }
        
        listContainer.empty()
        
        if (!conversations || conversations.length === 0) {
            noConvElement.show()
            // 隐藏删除按钮（没有对话可删除）
            $('#ai_delete_all_btn').hide()
            $('#ai_delete_all_btn_mobile').hide()
            return
        } else {
            noConvElement.hide()
            // 显示删除按钮
            $('#ai_delete_all_btn').show()
            $('#ai_delete_all_btn_mobile').show()
        }
        
        // 使用模板渲染对话列表
        try {
            const html = app.template(template, conversations)
            listContainer.html(html)
        } catch (error) {
            console.error('Error rendering conversation list template:', error)
            
            // 如果模板渲染失败，手动生成HTML作为备选方案
            let fallbackHtml = ''
            conversations.forEach(conv => {
                if (isMobile) {
                    // 移动端备选HTML，支持深色模式
                    fallbackHtml += `
                        <div class="card mb-2 conversation_unit_mobile_${conv.conversation_id} shadow-sm" 
                             data-conversation-id="${conv.conversation_id}"
                             onclick="$('#aiChatModalMobile').modal('show'); TL.ai.openConversation('${conv.conversation_id}');" 
                             style="cursor: pointer; border: 1px solid var(--bs-border-color, #dee2e6);">
                            <div class="card-body py-3" style="background-color: var(--bs-card-bg, #fff); color: var(--bs-body-color, #212529);">
                                <div class="d-flex align-items-center">
                                    <div class="mr-3">
                                        <iconpark-icon name="message" class="fa-fw fa-2x" style="color: var(--bs-primary, #007bff);"></iconpark-icon>
                                    </div>
                                    <div class="flex-fill">
                                        <div class="font-weight-medium text-truncate" style="color: var(--bs-body-color, #212529);">
                                            ${conv.title || '新对话'}
                                        </div>
                                        <div class="small mt-1" style="color: var(--bs-text-muted, #6c757d);">
                                            <iconpark-icon name="timer" class="fa-fw"></iconpark-icon>
                                            ${conv.time}
                                        </div>
                                    </div>
                                    <div class="ml-2">
                                        <button class="btn btn-sm text-danger mr-1" 
                                                onclick="event.stopPropagation(); TL.ai.deleteConversationUI('${conv.conversation_id}');"
                                                title="删除对话"
                                                style="background-color: var(--bs-light, #f8f9fa); border: 1px solid var(--bs-border-color, #dee2e6);">
                                            <iconpark-icon name="trash" class="fa-fw"></iconpark-icon>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `
                } else {
                    // 桌面端备选HTML
                    fallbackHtml += `
                        <div class="conversation-item mb-1 p-2 rounded conversation_unit_${conv.conversation_id}" 
                             data-conversation-id="${conv.conversation_id}" 
                             onclick="TL.ai.switchConversation('${conv.conversation_id}');"
                             style="cursor: pointer; transition: all 0.2s;">
                            
                            <div class="d-flex align-items-start">
                                <iconpark-icon name="message-circle" class="fa-fw text-muted mr-2 mt-1" style="font-size: 12px;"></iconpark-icon>
                                <div class="flex-fill" style="min-width: 0;">
                                    <div class="conversation-title text-truncate" style="font-size: 13px; line-height: 1.3;">
                                        ${conv.title || '新对话'}
                                    </div>
                                    <div class="small text-muted" style="font-size: 11px;">
                                        ${conv.time}
                                    </div>
                                </div>
                                <div class="conversation-actions" style="opacity: 0; transition: opacity 0.2s;">
                                    <button onclick="TL.ai.deleteConversationUI('${conv.conversation_id}'); event.stopPropagation();" 
                                            class="btn btn-sm btn-link text-danger p-1" 
                                            title="删除对话"
                                            style="font-size: 12px; color: #dc3545 !important;">
                                        <iconpark-icon name="trash" class="fa-fw"></iconpark-icon>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `
                }
            })
            
            listContainer.html(fallbackHtml)
        }
    }
    
    /**
     * 发起新对话
     * @param {string} message 用户消息
     * @param {function} callback 成功回调
     * @param {function} errorCallback 错误回调
     */
    chat(message, callback, errorCallback) {
        $.post(this.parent_op.api_url + '/ai', {
            'action': 'chat',
            'token': this.parent_op.api_token,
            'message': message
        }, (rsp) => {
            if (rsp.status === 1) {
                if (callback) callback(rsp.data)
            } else if (rsp.status === 5) {
                // API暂时不可用，建议重试
                if (errorCallback) errorCallback(app.languageData.ai_service_unavailable || 'AI服务暂时不可用，请稍后再试', rsp.data)
            } else {
                if (errorCallback) errorCallback(rsp.data, rsp.data)
            }
        }, 'json').fail((xhr, textStatus, errorThrown) => {
            let errorMessage = app.languageData.ai_send_message_failed || '发送消息失败'
            if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = xhr.responseJSON.message
            } else if (textStatus) {
                errorMessage = `${app.languageData.ai_request_failed || '请求失败'}: ${textStatus}`
            }
            if (errorCallback) errorCallback(errorMessage)
        })
    }
    
    /**
     * 继续对话
     * @param {string} conversationId 对话ID
     * @param {string} message 用户消息
     * @param {function} callback 成功回调
     * @param {function} errorCallback 错误回调
     */
    continue(conversationId, message, callback, errorCallback) {
        $.post(this.parent_op.api_url + '/ai', {
            'action': 'continue',
            'token': this.parent_op.api_token,
            'conversation_id': conversationId,
            'message': message
        }, (rsp) => {
            if (rsp.status === 1) {
                if (callback) callback(rsp.data)
            } else if (rsp.status === 5) {
                // API暂时不可用，建议重试
                if (errorCallback) errorCallback(app.languageData.ai_service_unavailable || 'AI服务暂时不可用，请稍后再试', rsp.data)
            } else {
                if (errorCallback) errorCallback(rsp.data, rsp.data)
            }
        }, 'json').fail((xhr, textStatus, errorThrown) => {
            let errorMessage = app.languageData.ai_send_message_failed || '发送消息失败'
            if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = xhr.responseJSON.message
            } else if (textStatus) {
                errorMessage = `${app.languageData.ai_request_failed || '请求失败'}: ${textStatus}`
            }
            if (errorCallback) errorCallback(errorMessage)
        })
    }
    
    /**
     * 获取用户状态
     * @param {function} callback 成功回调
     * @param {function} errorCallback 错误回调
     */
    getStatus(callback, errorCallback) {
        $.post(this.parent_op.api_url + '/ai', {
            'action': 'status',
            'token': this.parent_op.api_token
        }, (rsp) => {
            if (rsp.status === 1) {
                if (callback) callback(rsp.data)
            } else if (rsp.status === 5) {
                // API暂时不可用，建议重试
                if (errorCallback) errorCallback(app.languageData.ai_service_unavailable || 'AI服务暂时不可用，请稍后再试')
            } else {
                if (errorCallback) errorCallback(rsp.data)
            }
        }, 'json').fail((xhr, textStatus, errorThrown) => {
            let errorMessage = app.languageData.ai_get_status_failed || '获取状态失败'
            if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = xhr.responseJSON.message
            } else if (textStatus) {
                errorMessage = `${app.languageData.ai_request_failed || '请求失败'}: ${textStatus}`
            }
            if (errorCallback) errorCallback(errorMessage)
        })
    }
    
    /**
     * 获取对话历史列表
     * @param {number} limit 限制数量
     * @param {function} callback 成功回调
     * @param {function} errorCallback 错误回调
     */
    getHistoryList(limit, callback, errorCallback) {
        $.post(this.parent_op.api_url + '/ai', {
            'action': 'history',
            'token': this.parent_op.api_token,
            'limit': limit.toString()
        }, (rsp) => {
            if (rsp.status === 1) {
                this.conversations = rsp.data
                if (callback) callback(rsp.data)
            } else if (rsp.status === 5) {
                // API暂时不可用，建议重试
                if (errorCallback) errorCallback(app.languageData.ai_service_unavailable || 'AI服务暂时不可用，请稍后再试')
            } else {
                if (errorCallback) errorCallback(rsp.data)
            }
        }, 'json').fail((xhr, textStatus, errorThrown) => {
            let errorMessage = app.languageData.ai_get_history_failed || '获取对话历史失败'
            if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = xhr.responseJSON.message
            } else if (textStatus) {
                errorMessage = `${app.languageData.ai_request_failed || '请求失败'}: ${textStatus}`
            }
            if (errorCallback) errorCallback(errorMessage)
        })
    }
    
    /**
     * 获取对话详情
     * @param {string} conversationId 对话ID
     * @param {function} callback 成功回调
     * @param {function} errorCallback 错误回调
     */
    getConversationDetail(conversationId, callback, errorCallback) {
        $.post(this.parent_op.api_url + '/ai', {
            'action': 'get_conversation',
            'token': this.parent_op.api_token,
            'conversation_id': conversationId
        }, (rsp) => {
            if (rsp.status === 1) {
                if (callback) callback(rsp.data)
            } else if (rsp.status === 5) {
                // API暂时不可用，建议重试
                if (errorCallback) errorCallback(app.languageData.ai_service_unavailable || 'AI服务暂时不可用，请稍后再试')
            } else {
                if (errorCallback) errorCallback(rsp.data)
            }
        }, 'json').fail((xhr, textStatus, errorThrown) => {
            let errorMessage = app.languageData.ai_get_detail_failed || '获取对话详情失败'
            if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = xhr.responseJSON.message
            } else if (textStatus) {
                errorMessage = `${app.languageData.ai_request_failed || '请求失败'}: ${textStatus}`
            }
            if (errorCallback) errorCallback(errorMessage)
        })
    }
    
    /**
     * 删除对话
     * @param {string} conversationId 对话ID
     * @param {function} callback 成功回调
     * @param {function} errorCallback 错误回调
     */
    deleteConversation(conversationId, callback, errorCallback) {
        $.post(this.parent_op.api_url + '/ai', {
            'action': 'delete',
            'token': this.parent_op.api_token,
            'conversation_id': conversationId
        }, (rsp) => {
            if (rsp.status === 1) {
                // 从本地列表中移除
                this.conversations = this.conversations.filter(
                    conv => conv.conversation_id !== conversationId
                )
                if (callback) callback(true)
            } else if (rsp.status === 5) {
                // API暂时不可用，建议重试
                if (errorCallback) errorCallback(app.languageData.ai_service_unavailable || 'AI服务暂时不可用，请稍后再试')
            } else {
                if (errorCallback) errorCallback(rsp.data)
            }
        }, 'json').fail((xhr, textStatus, errorThrown) => {
            let errorMessage = app.languageData.ai_delete_failed || '删除对话失败'
            if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = xhr.responseJSON.message
            } else if (textStatus) {
                errorMessage = `${app.languageData.ai_request_failed || '请求失败'}: ${textStatus}`
            }
            if (errorCallback) errorCallback(errorMessage)
        })
    }
    
    /**
     * 开始新对话（移动端使用）
     */
    startNewConversation() {
        // 清空当前对话状态
        this.currentConversationId = null
        this.currentMessages = []
        
        // 清空消息区域，显示欢迎界面
        $('#ai_messages_mobile').empty()
        $('#ai_welcome_mobile').show()
        
        // 清空输入框
        $('#ai_input_mobile').val('')
        this.updateCharCount(true)
        
        // 设置模态框标题
        $('#aiChatModalMobileTitle').text((app.languageData.ai_name || '智能小薇') + ' - ' + (app.languageData.ai_new_conversation || '新对话'))
        
        // 聚焦到输入框
        setTimeout(() => {
            $('#ai_input_mobile').focus()
        }, 100)
    }

    /**
     * 新建对话
     */
    newConversation() {
        // 发送新建对话统计
        this.parent_op.ga('AI_StartNewConversation')
        
        // 清空当前对话状态，准备新对话
        this.currentConversationId = null
        this.currentMessages = []
        
        // 清除所有对话的激活状态
        $('.conversation-item').removeClass('active')
        
        // 清空消息区域，显示欢迎界面
        $('#ai_messages').html(`
            <div class="text-center text-muted py-5">
                <iconpark-icon name="star-one" class="fa-fw fa-3x mb-3 text-primary"></iconpark-icon>
                <h5 class="text-muted">${app.languageData.ai_start_new_chat || '开始新对话'}</h5>
                <p class="text-muted small">${app.languageData.ai_ask_question_hint || '输入您的问题，智能小薇将为您解答'}</p>
            </div>
        `)
        
        // 聚焦到输入框
        setTimeout(() => {
            $('#ai_input').focus()
        }, 100)
    }

    /**
     * 切换对话
     */
    switchConversation(conversationId) {
        // 发送切换对话统计
        this.parent_op.ga('AI_SwitchConversation')
        
        // 更新UI状态
        $('.conversation-item').removeClass('active')
        $(`.conversation_unit_${conversationId}`).addClass('active')
        
        // 加载对话详情
        this.openConversation(conversationId)
    }

    /**
     * 打开对话
     */
    openConversation(conversationId) {
        // 检测是否为移动端
        const isMobile = isMobileScreen()
        const messagesContainer = isMobile ? '#ai_messages_mobile' : '#ai_messages'
        
        // 显示加载状态
        $(messagesContainer).html(`
            <div class="text-center text-muted py-5">
                <div class="spinner-border text-primary mb-3"></div>
                <div>${app.languageData.ai_loading_conversation || '加载对话中...'}</div>
            </div>
        `)
        
        // 隐藏移动端欢迎界面
        if (isMobile) {
            $('#ai_welcome_mobile').hide()
        }
        
        this.getConversationDetail(conversationId,
            (conversation) => {
                this.currentConversationId = conversationId
                this.currentMessages = conversation.messages || []
                
                // 更新模态框标题
                if (isMobile) {
                    $('#aiChatModalMobileTitle').text(conversation.title || (app.languageData.ai_name || '智能小薇'))
                }
                
                // 渲染消息历史
                $(messagesContainer).empty()
                if (this.currentMessages.length > 0) {
                    this.currentMessages.forEach(msg => {
                        if (isMobile) {
                            this.addMobileMessageToChat(msg.role, msg.content, false)
                        } else {
                            this.addMessageToChat(msg.role, msg.content, false)
                        }
                    })
                    
                    // 对所有代码块应用高亮
                    setTimeout(() => {
                        this.applyCodeHighlighting()
                        this.addCopyButtonsToCodeBlocks($(messagesContainer))
                    }, 100)
                    
                    // 滚动到底部
                    if (isMobile) {
                        const container = $(messagesContainer)
                        if (container.length > 0 && container[0]) {
                            container.scrollTop(container[0].scrollHeight)
                        }
                    } else {
                        this.scrollToBottom(false)
                    }
                } else {
                    $(messagesContainer).html(`
                        <div class="text-center text-muted py-5">
                            <iconpark-icon name="star-one" class="fa-fw fa-3x mb-3 text-primary"></iconpark-icon>
                            <h5 class="text-muted">${app.languageData.ai_continue_chat || '继续与智能小薇对话吧！'}</h5>
                            <p class="text-muted small">${app.languageData.ai_previous_conversation || '这是您之前的对话，可以继续提问'}</p>
                        </div>
                    `)
                }
            },
            (error) => {
                console.error('加载对话失败:', error)
                $(messagesContainer).html(`
                    <div class="text-center text-muted py-5">
                        <iconpark-icon name="error-view" class="fa-fw fa-3x mb-3 text-danger"></iconpark-icon>
                        <h5 class="text-muted">${app.languageData.ai_load_failed || '加载失败'}</h5>
                        <p class="text-muted small">${app.languageData.ai_load_error_msg || '无法加载对话内容'}: ${error}</p>
                    </div>
                `)
            }
        )
    }

    /**
     * 发送消息
     */
    sendMessage(isMobile = false) {
        const inputElement = isMobile ? $('#ai_input_mobile') : $('#ai_input')
        const message = inputElement.val().trim()
        
        if (!message || this.isLoading) return
        
        // 检查配额状态
        if (!this.canSendMessage()) {
            const quotaMessage = app.languageData.ai_quota_exhausted_message || '您的对话配额已耗尽，请等待重置后继续使用。'
            TL.alert(quotaMessage)
            return
        }
        
        // 添加用户消息
        if (isMobile) {
            this.addMobileMessageToChat('user', message)
        } else {
            this.addMessageToChat('user', message, false)
        }
        
        inputElement.val('')
        if (isMobile) {
            this.updateCharCount(true)
        } else {
            this.autoResizeTextarea(inputElement[0])
        }
        
        // 设置加载状态
        this.setLoadingState(true, isMobile)
        
        // 选择使用chat或continue方法
        const apiMethod = this.currentConversationId ? 'continue' : 'chat'
        const apiParams = this.currentConversationId ? [this.currentConversationId, message] : [message]
        
        this[apiMethod](...apiParams,
            (response) => {
                // 检查是否是新对话的第一条消息
                const isNewConversation = !this.currentConversationId
                
                // 发送AI交互统计
                if (isNewConversation) {
                    this.parent_op.ga('AI_NewChat')
                } else {
                    this.parent_op.ga('AI_Continue')
                }
                
                // 更新用户配额统计
                if (response.user_stats) {
                    this.updateUserStats(response.user_stats)
                }
                
                // 更新对话ID
                if (!this.currentConversationId) {
                    this.currentConversationId = response.conversation_id
                }
                
                // 从返回的messages中获取最新的assistant消息
                if (response.messages && response.messages.length > 0) {
                    const lastMessage = response.messages[response.messages.length - 1]
                    if (lastMessage.role === 'assistant') {
                        if (isMobile) {
                            this.addMobileMessageToChat('assistant', lastMessage.content)
                        } else {
                            this.addMessageToChat('assistant', lastMessage.content, false)
                        }
                    }
                }
                
                // 如果是新对话的第一条消息，刷新对话列表并选中新对话
                if (isNewConversation) {
                    this.loadConversationHistory()
                    
                    // 延迟选中新创建的对话
                    setTimeout(() => {
                        $(`.conversation_unit_${this.currentConversationId}`).addClass('active')
                    }, 500)
                }
                
                this.setLoadingState(false, isMobile)
            },
            (error, errorData) => {
                console.error('发送消息失败:', error)
                
                // 如果错误响应包含用户配额信息，更新显示
                if (errorData && errorData.user_stats) {
                    this.updateUserStats(errorData.user_stats)
                }
                
                let errorMessage = ''
                if (error.includes('Failed to fetch') || error.includes('网络')) {
                    errorMessage = app.languageData.ai_network_error || '抱歉，AI服务暂时不可用，请稍后再试。'
                    TL.alert(app.languageData.ai_connection_failed || 'AI服务连接失败，请检查网络或稍后再试')
                } else if (error.includes('令牌不足') || error.includes('配额耗尽') || error.includes('Token limit exceeded')) {
                    errorMessage = app.languageData.ai_quota_exceeded || '抱歉，您的对话配额已耗尽，请等待重置后继续使用。'
                    TL.alert(app.languageData.ai_quota_alert || '您的AI对话配额已耗尽，请等待重置或升级账户')
                } else {
                    errorMessage = (app.languageData.ai_send_error || '抱歉，发送消息时发生错误') + ': ' + error
                    TL.alert(error)
                }
                
                if (isMobile) {
                    this.addMobileMessageToChat('system', errorMessage)
                } else {
                    this.addMessageToChat('system', errorMessage, false)
                }
                
                this.setLoadingState(false, isMobile)
            }
        )
    }

    /**
     * 删除对话（UI方法）
     */
    deleteConversationUI(conversationId) {
        // 检测是否为移动端
        const isMobile = isMobileScreen()
        
        if (isMobile) {
            // 移动端使用更友好的确认方式
            this.confirmDeleteConversationMobile(conversationId)
        } else {
            // 桌面端使用原有方式
            if (!confirm(app.languageData.ai_confirm_delete || '确定要删除这个对话吗？此操作无法撤销。')) {
                return
            }
            
            this.deleteConversation(conversationId,
                () => {
                    // 发送删除对话统计
                    this.parent_op.ga('AI_DeleteConversation')
                    // 直接刷新历史列表，用户看到对话消失就知道删除成功了
                    this.loadConversationHistory()
                },
                (error) => {
                    console.error('删除对话失败:', error)
                    TL.alert((app.languageData.ai_delete_failed || '删除对话失败') + ': ' + error)
                }
            )
        }
    }

    /**
     * 移动端删除对话确认
     */
    confirmDeleteConversationMobile(conversationId) {
        // 使用浏览器原生的确认对话框，在移动端体验更好
        if (confirm(app.languageData.ai_confirm_delete || '确定要删除这个对话吗？此操作无法撤销。')) {
            this.deleteConversation(conversationId,
                () => {
                    // 发送删除对话统计
                    this.parent_op.ga('AI_DeleteConversation')
                    // 直接刷新历史列表，用户看到对话消失就知道删除成功了
                    this.loadConversationHistory()
                },
                (error) => {
                    console.error('删除对话失败:', error)
                    TL.alert((app.languageData.ai_delete_failed || '删除对话失败') + ': ' + error)
                }
            )
        }
    }

    /**
     * 导出对话
     */
    exportConversation(conversationId) {
        this.getConversationDetail(conversationId,
            (conversation) => {
                const messages = conversation.messages || []
                
                if (messages.length === 0) {
                    TL.alert(app.languageData.ai_no_content_export || '没有对话内容可以导出')
                    return
                }
                
                // 发送导出对话统计
                this.parent_op.ga('AI_ExportConversation')
                
                const exportContent = messages.map(msg => 
                    `${msg.role === 'user' ? (app.languageData.ai_user || '用户') : (app.languageData.ai_name || '小薇')}: ${msg.content}`
                ).join('\n\n')
                
                const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' })
                const url = URL.createObjectURL(blob)
                
                const a = document.createElement('a')
                a.href = url
                a.download = `${conversation.title || (app.languageData.ai_conversation || '对话')}_${new Date().toLocaleDateString()}.txt`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                
                URL.revokeObjectURL(url)
            },
            (error) => {
                console.error('导出对话失败:', error)
                TL.alert((app.languageData.ai_export_failed || '导出对话失败') + ': ' + error)
            }
        )
    }

    /**
     * 刷新对话列表
     */
    refreshList() {
        this.loadConversationHistory()
    }
    
    refreshConversation() {
        if (this.currentConversationId) {
            this.openConversation(this.currentConversationId)
        }
    }

    /**
     * 删除所有对话
     */
    deleteAllConversations() {
        // 使用浏览器确认框
        if (!confirm(app.languageData.ai_confirm_delete_all || '确定要删除所有对话吗？此操作无法撤销，将清空您的所有对话历史。')) {
            return
        }

        // 如果没有对话，直接返回
        if (!this.conversations || this.conversations.length === 0) {
            TL.alert(app.languageData.ai_no_conversations_to_delete || '没有对话可以删除')
            return
        }

        // 显示删除进度
        const deleteCount = this.conversations.length
        let deletedCount = 0
        let failedCount = 0

        // 逐个删除对话
        const deletePromises = this.conversations.map(conversation => {
            return new Promise((resolve) => {
                this.deleteConversation(conversation.conversation_id,
                    () => {
                        deletedCount++
                        resolve()
                    },
                    (error) => {
                        console.error(`删除对话 ${conversation.conversation_id} 失败:`, error)
                        failedCount++
                        resolve()
                    }
                )
            })
        })

        // 等待所有删除操作完成
        Promise.all(deletePromises).then(() => {
            // 发送删除所有对话统计
            this.parent_op.ga('AI_DeleteAllConversations')
            
            // 清空本地对话列表
            this.conversations = []
            this.currentConversationId = null
            this.currentMessages = []
            
            // 刷新界面
            this.updateConversationListUI([])
            
            // 隐藏删除按钮
            $('#ai_delete_all_btn').hide()
            $('#ai_delete_all_btn_mobile').hide()
            
            // 清空消息区域，显示欢迎界面
            const isMobile = isMobileScreen()
            const messagesContainer = isMobile ? '#ai_messages_mobile' : '#ai_messages'
            
            $(messagesContainer).html(`
                <div class="text-center text-muted py-5">
                    <iconpark-icon name="star-one" class="fa-fw fa-3x mb-3 text-primary"></iconpark-icon>
                    <h5 class="text-muted">${app.languageData.ai_start_chat_greeting || '开始与智能小薇对话吧！'}</h5>
                    <p class="text-muted small">${app.languageData.ai_choose_conversation || '选择左侧的对话历史或创建新对话'}</p>
                </div>
            `)
            
            // 显示删除结果
            if (failedCount === 0) {
                TL.alert(`${app.languageData.ai_delete_all_success || '成功删除所有对话'} (${deletedCount}/${deleteCount})`)
            } else {
                TL.alert(`${app.languageData.ai_delete_partial_success || '部分删除成功'}: ${deletedCount}/${deleteCount}，${failedCount} 个对话删除失败`)
            }
        })
    }

    /**
     * 添加消息到聊天界面
     */
    addMessageToChat(role, content, isMobile = false) {
        const messagesElement = $('#ai_messages')
        
        // 清空欢迎消息
        if (messagesElement.find('.text-center.text-muted').length > 0) {
            messagesElement.empty()
        }
        
        const isUser = role === 'user'
        const isAssistant = role === 'assistant'
        const isSystem = role === 'system'
        
        // 获取用户信息
        const userAvatar = $('.user_saved_logo img').first().attr('src') || '/img/ico/logo-256x256.png'
        const userNickname = $('.user_saved_nickname').first().text() || (app.languageData.ai_user || '用户')
        
        let messageHtml
        
        if (isUser) {
            // 用户消息：微信风格，头像在右侧
            messageHtml = `
                <div class="d-flex justify-content-end align-items-start mb-3 ai-message">
                    <div class="d-flex flex-column align-items-end mr-2 wechat-message-container">
                        <small class="text-muted wechat-nickname">${userNickname}</small>
                        <div class="bg-msg-user p-3 wechat-bubble-user">
                            <div class="text-white message-content" style="line-height: 1.4; word-wrap: break-word; word-break: break-word; overflow-wrap: break-word;">
                                ${this.formatMessageContent(content)}
                            </div>
                        </div>
                    </div>
                    <div class="wechat-avatar">
                        <img src="${userAvatar}" class="rounded-circle w-100 h-100" style="object-fit: cover;" alt="${app.languageData.ai_user_avatar || '用户头像'}">
                    </div>
                </div>
            `
        } else if (isAssistant) {
            // AI消息：微信风格，头像在左侧
            messageHtml = `
                <div class="d-flex justify-content-start align-items-start mb-3 ai-message">
                    <div class="wechat-avatar mr-2">
                        <div class="rounded-circle d-flex align-items-center justify-content-center w-100 h-100 wechat-ai-avatar">
                            <iconpark-icon name="star-one" class="text-white" style="font-size: 20px;"></iconpark-icon>
                        </div>
                    </div>
                    <div class="d-flex flex-column align-items-start wechat-message-container">
                        <small class="text-muted wechat-nickname">${app.languageData.ai_name || '小薇'}</small>
                        <div class="bg-msg-ai p-3 wechat-bubble-ai">
                            <div class="text-white message-content" style="line-height: 1.4; word-wrap: break-word; word-break: break-word; overflow-wrap: break-word;">
                                ${this.formatMessageContent(content)}
                            </div>
                        </div>
                    </div>
                </div>
            `
        } else {
            // 系统消息：居中显示
            messageHtml = `
                <div class="d-flex justify-content-center mb-3 ai-message">
                    <div class="bg-msg-system px-3 py-2 wechat-bubble-system wechat-message-container system">
                        <div class="text-center text-dark message-content" style="font-size: 13px; line-height: 1.4; word-wrap: break-word; word-break: break-word; overflow-wrap: break-word;">
                            ${this.formatMessageContent(content)}
                        </div>
                    </div>
                </div>
            `
        }
        
        messagesElement.append(messageHtml)
        
        // 对新添加的代码块应用高亮和复制按钮
        setTimeout(() => {
            this.applyCodeHighlighting()
            this.addCopyButtonsToCodeBlocks(messagesElement)
        }, 50)
        
        this.scrollToBottom(false)
    }

    /**
     * 格式化消息内容
     */
    formatMessageContent(content) {
        // 使用 marked.js 解析 markdown
        if (typeof marked !== 'undefined') {
            // 配置 marked 选项
            marked.setOptions({
                breaks: true, // 支持 GFM 换行
                gfm: true, // 启用 GitHub Flavored Markdown
                tables: true, // 支持表格
                sanitize: false, // 不过滤 HTML（如果需要安全性，设为 true）
                smartLists: true, // 智能列表
                smartypants: true, // 智能标点
                langPrefix: 'language-', // 确保 marked.js 添加正确的语言类名
                // 不使用 highlight 函数，让 marked.js 生成标准的 <pre><code> 结构
                // 然后让 Prism.highlightAll() 处理高亮
            })
            
            return marked.parse(content)
        } else {
            // 降级处理：如果 marked.js 未加载，使用原有的简单替换
            return content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`(.*?)`/g, '<code>$1</code>')
                .replace(/\n/g, '<br>')
        }
    }
    
    /**
     * HTML 转义
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }
        return text.replace(/[&<>"']/g, m => map[m])
    }

    /**
     * 滚动到底部
     */
    scrollToBottom(isMobile = false) {
        const messagesElement = $('#ai_messages')
        
        // 使用原生JavaScript确保滚动正常工作
        if (messagesElement.length > 0) {
            const element = messagesElement[0]
            
            // 强制重新计算高度
            setTimeout(() => {
                try {
                    // 使用smooth滚动到底部
                    element.scrollTo({
                        top: element.scrollHeight,
                        behavior: 'smooth'
                    })
                } catch (e) {
                    // 如果smooth不支持，使用jQuery animate作为备选
                    messagesElement.animate({
                        scrollTop: element.scrollHeight
                    }, 300)
                }
            }, 50)
        }
    }

    /**
     * 设置加载状态
     */
    setLoadingState(loading, isMobile = false) {
        this.isLoading = loading
        
        const sendBtn = isMobile ? $('#ai_send_btn_mobile') : $('#ai_send_btn')
        const statusElement = isMobile ? $('#ai_chat_status_mobile') : $('#ai_chat_status')
        const messagesContainer = isMobile ? $('#ai_messages_mobile') : $('#ai_messages')
        
        if (loading) {
            sendBtn.prop('disabled', true).html('<div class="spinner-border spinner-border-sm"></div>')
            
            // 添加思考中的提示
            if (messagesContainer.find('.thinking-indicator').length === 0) {
                const thinkingHtml = isMobile ? this.createMobileThinkingIndicator() : this.createDesktopThinkingIndicator()
                messagesContainer.append(thinkingHtml)
                
                if (isMobile) {
                    if (messagesContainer.length > 0 && messagesContainer[0]) {
                        messagesContainer.scrollTop(messagesContainer[0].scrollHeight)
                    }
                } else {
                    this.scrollToBottom(false)
                }
            }
        } else {
            const inputElement = isMobile ? $('#ai_input_mobile') : $('#ai_input')
            sendBtn.prop('disabled', inputElement.val().trim() === '').html('<iconpark-icon name="arrow-turn-down-left" class="fa-fw"></iconpark-icon>')
            statusElement.text(app.languageData.ai_status_ready || '就绪')
            
            // 移除思考中的提示
            messagesContainer.find('.thinking-indicator').remove()
        }
    }

    /**
     * 自动调整文本框大小
     */
    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto'
        const newHeight = Math.min(textarea.scrollHeight, 120)
        textarea.style.height = newHeight + 'px'
        
        // 更新字符计数
        const length = textarea.value.length
        const isMobile = $(textarea).attr('id') === 'ai_input_mobile'
        
        if (isMobile) {
            $('#ai_char_count_mobile').text(`${length}/2000`)
            // 更新移动端发送按钮状态
            $('#ai_send_btn_mobile').prop('disabled', length === 0 || this.isLoading)
        } else {
            $('#ai_char_count').text(`${length}/2000`)
            // 更新桌面端发送按钮状态
            $('#ai_send_btn').prop('disabled', length === 0 || this.isLoading)
        }
    }

    /**
     * 创建桌面端思考指示器
     */
    createDesktopThinkingIndicator() {
        return `
            <div class="d-flex justify-content-start align-items-start mb-3 thinking-indicator">
                <div class="wechat-avatar mr-2">
                    <div class="rounded-circle d-flex align-items-center justify-content-center w-100 h-100 wechat-ai-avatar">
                        <iconpark-icon name="star-one" class="text-white" style="font-size: 20px;"></iconpark-icon>
                    </div>
                </div>
                <div class="d-flex flex-column align-items-start wechat-message-container">
                    <small class="text-muted wechat-nickname">小薇</small>
                    <div class="bg-msg-ai p-3 wechat-bubble-ai">
                        <div class="text-white" style="opacity: 0.8;">
                            <div class="typing-dots">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
    }

    /**
     * 创建移动端思考指示器
     */
    createMobileThinkingIndicator() {
        return `
            <div class="mb-3 mobile-message ai-message thinking-indicator">
                <div class="d-flex justify-content-start align-items-center mb-1">
                    <div class="wechat-avatar mr-2" style="width: 24px; height: 24px;">
                        <div class="rounded-circle d-flex align-items-center justify-content-center w-100 h-100 wechat-ai-avatar">
                            <iconpark-icon name="star-one" class="text-white" style="font-size: 12px;"></iconpark-icon>
                        </div>
                    </div>
                    <small class="text-muted wechat-nickname">小薇</small>
                </div>
                <div class="d-flex justify-content-start">
                    <div class="bg-msg-ai p-3 wechat-bubble-ai wechat-message-container">
                        <div class="text-white" style="opacity: 0.8;">
                            <div class="typing-dots">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
    }

    // 移动端相关方法
    sendQuickMessage(message) {
        if (!message || message.trim() === '') return
        
        // 设置输入框内容
        $('#ai_input_mobile').val(message)
        
        // 发送消息
        this.sendMessage(true)
    }

    updateCharCount(isMobile = false) {
        const inputElement = isMobile ? $('#ai_input_mobile') : $('#ai_input')
        const countElement = isMobile ? $('#ai_char_count_mobile') : $('#ai_char_count')
        const sendBtn = isMobile ? $('#ai_send_btn_mobile') : $('#ai_send_btn')
        const currentLength = inputElement.val().length
        const maxLength = inputElement.attr('maxlength') || 2000
        
        countElement.text(`${currentLength}/${maxLength}`)
        
        // 更新发送按钮状态
        sendBtn.prop('disabled', currentLength === 0 || this.isLoading)
        
        // 字符数接近限制时改变颜色
        if (currentLength > maxLength * 0.9) {
            countElement.addClass('text-warning')
        } else if (currentLength >= maxLength) {
            countElement.addClass('text-danger').removeClass('text-warning')
        } else {
            countElement.removeClass('text-warning text-danger')
        }
    }

    addMobileMessageToChat(role, content, showTimestamp = true) {
        const messagesContainer = $('#ai_messages_mobile')
        
        // 隐藏欢迎界面
        $('#ai_welcome_mobile').hide()
        
        // 创建消息HTML
        const messageHtml = this.createMobileMessageHTML({
            role: role,
            content: content,
            timestamp: showTimestamp ? new Date().toLocaleTimeString() : null
        })
        
        messagesContainer.append(messageHtml)
        
        // 对新添加的代码块应用高亮和复制按钮
        setTimeout(() => {
            this.applyCodeHighlighting()
            this.addCopyButtonsToCodeBlocks(messagesContainer)
        }, 10)
        
        // 滚动到底部
        if (messagesContainer.length > 0 && messagesContainer[0]) {
            messagesContainer.scrollTop(messagesContainer[0].scrollHeight)
        }
    }

    createMobileMessageHTML(message) {
        const isUser = message.role === 'user'
        const isSystem = message.role === 'system'
        const isAssistant = message.role === 'assistant'
        
        // 获取用户信息
        const userAvatar = $('.user_saved_logo img').first().attr('src') || '/img/ico/logo-256x256.png'
        const userNickname = $('.user_saved_nickname').first().text() || (app.languageData.ai_user || '用户')
        
        if (isUser) {
            // 用户消息：新布局，头像和名字在上方一行，消息在下方
            return `
                <div class="mb-3 mobile-message user-message">
                    <div class="d-flex justify-content-end align-items-center mb-1">
                        <small class="text-muted wechat-nickname mr-2">${userNickname}</small>
                        <div class="wechat-avatar" style="width: 24px; height: 24px;">
                            <img src="${userAvatar}" class="rounded-circle w-100 h-100" style="object-fit: cover;" alt="${app.languageData.ai_user_avatar || '用户头像'}">
                        </div>
                    </div>
                    <div class="d-flex justify-content-end">
                        <div class="bg-msg-user p-3 wechat-bubble-user wechat-message-container">
                            <div class="text-white message-content" style="line-height: 1.4; word-wrap: break-word; word-break: break-word; overflow-wrap: break-word;">
                                ${this.formatMessageContent(message.content)}
                            </div>
                        </div>
                    </div>
                </div>
            `
        } else if (isAssistant) {
            // AI消息：新布局，头像和名字在上方一行，消息在下方
            return `
                <div class="mb-3 mobile-message ai-message">
                    <div class="d-flex justify-content-start align-items-center mb-1">
                        <div class="wechat-avatar mr-2" style="width: 24px; height: 24px;">
                            <div class="rounded-circle d-flex align-items-center justify-content-center w-100 h-100 wechat-ai-avatar">
                                <iconpark-icon name="star-one" class="text-white" style="font-size: 12px;"></iconpark-icon>
                            </div>
                        </div>
                        <small class="text-muted wechat-nickname">${app.languageData.ai_name || '小薇'}</small>
                    </div>
                    <div class="d-flex justify-content-start">
                        <div class="bg-msg-ai p-3 wechat-bubble-ai wechat-message-container">
                            <div class="text-white message-content" style="line-height: 1.4; word-wrap: break-word; word-break: break-word; overflow-wrap: break-word;">
                                ${this.formatMessageContent(message.content)}
                            </div>
                        </div>
                    </div>
                </div>
            `
        } else {
            // 系统消息：宽度占满，更好的空间利用
            return `
                <div class="mb-3 mobile-message system-message">
                    <div class="bg-msg-system px-3 py-2 wechat-message-container system" style="width: 100%;">
                        <div class="text-center text-dark message-content" style="font-size: 13px; line-height: 1.4; word-wrap: break-word; word-break: break-word; overflow-wrap: break-word;">
                            ${this.formatMessageContent(message.content)}
                        </div>
                    </div>
                </div>
            `
        }
    }

    /**
     * 初始化配额显示
     */
    initQuotaDisplay() {
        // 获取用户状态并显示配额
        this.getStatus(
            (stats) => {
                this.updateUserStats(stats)
            },
            (error) => {
                console.error('获取AI配额状态失败:', error)
            }
        )
    }

    /**
     * 更新用户配额统计
     */
    updateUserStats(stats) {
        this.userStats = stats
        this.updateQuotaProgressBar()
        this.checkQuotaStatus()
    }

    /**
     * 更新配额进度条
     */
    updateQuotaProgressBar() {
        if (!this.userStats) return

        const remaining = this.userStats.token_remaining || 0
        const limit = this.userStats.token_limit || 4000
        const percentage = Math.max(0, Math.min(100, (remaining / limit) * 100))

        // 桌面端进度条
        const desktopIndicator = $('#ai_quota_indicator')
        const desktopProgress = $('#ai_quota_progress')

        // 移动端进度条
        const mobileIndicator = $('#ai_quota_indicator_mobile')
        const mobileProgress = $('#ai_quota_progress_mobile')

        // 显示进度条（如果元素存在）
        if (desktopIndicator.length > 0) {
            desktopIndicator.show()
            desktopProgress.css('width', percentage + '%').attr('aria-valuenow', percentage)
        }
        
        if (mobileIndicator.length > 0) {
            mobileIndicator.show()
            mobileProgress.css('width', percentage + '%').attr('aria-valuenow', percentage)
        }

        // 根据剩余配额调整颜色
        let progressClass = 'bg-success'
        if (percentage < 10) {
            progressClass = 'bg-danger'
        } else if (percentage < 30) {
            progressClass = 'bg-warning'
        }

        // 更新进度条颜色
        if (desktopProgress.length > 0) {
            desktopProgress.removeClass('bg-success bg-warning bg-danger').addClass(progressClass)
        }
        if (mobileProgress.length > 0) {
            mobileProgress.removeClass('bg-success bg-warning bg-danger').addClass(progressClass)
        }
    }

    /**
     * 检查配额状态
     */
    checkQuotaStatus() {
        if (!this.userStats) return

        const remaining = this.userStats.token_remaining || 0

        // 如果没有剩余配额，禁用发送功能并显示提示
        if (remaining <= 0) {
            this.disableAIFeatures()
        } else {
            this.enableAIFeatures()
        }
    }

    /**
     * 禁用AI功能（配额耗尽时）
     */
    disableAIFeatures() {
        // 禁用发送按钮
        $('#ai_send_btn, #ai_send_btn_mobile').prop('disabled', true)
        
        // 禁用输入框
        $('#ai_input, #ai_input_mobile').prop('disabled', true).attr('placeholder', app.languageData.ai_quota_exhausted || '配额已耗尽，请等待重置')
        
        // 显示配额耗尽提示
        const quotaMessage = app.languageData.ai_quota_exhausted_message || '您的对话配额已耗尽，请等待重置后继续使用。'
        
        // 在聊天界面显示系统消息
        const isMobile = isMobileScreen()
        if (isMobile) {
            this.addMobileMessageToChat('system', quotaMessage)
        } else {
            this.addMessageToChat('system', quotaMessage, false)
        }
    }

    /**
     * 启用AI功能（有配额时）
     */
    enableAIFeatures() {
        // 启用输入框
        $('#ai_input, #ai_input_mobile').prop('disabled', false).attr('placeholder', app.languageData.ai_input_placeholder || '输入您的问题...')
        
        // 更新发送按钮状态（基于输入内容）
        const desktopInput = $('#ai_input').val() || ''
        const mobileInput = $('#ai_input_mobile').val() || ''
        
        $('#ai_send_btn').prop('disabled', desktopInput.trim() === '' || this.isLoading)
        $('#ai_send_btn_mobile').prop('disabled', mobileInput.trim() === '' || this.isLoading)
    }

    /**
     * 检查是否可以发送消息
     */
    canSendMessage() {
        if (!this.userStats) return true // 如果没有配额数据，允许发送（让服务器处理）
        
        const remaining = this.userStats.token_remaining || 0
        return remaining > 0
    }


    /**
     * 应用代码语法高亮
     */
    applyCodeHighlighting() {
        const codeBlocks = document.querySelectorAll('.bg-msg-ai pre code')
        
        codeBlocks.forEach((codeBlock) => {
            // 检查是否已经高亮过了
            if (codeBlock.dataset.highlighted === 'true') {
                return
            }
            
            const code = codeBlock.textContent
            const language = this.detectLanguage(codeBlock)
            
            let highlightedCode = this.escapeHtml(code)
            
            // 语言映射
            const languageMap = {
                'py': 'python',
                'js': 'javascript', 
                'ts': 'typescript',
                'sh': 'bash',
                'shell': 'bash',
                'json': 'json',
                'css': 'css',
                'html': 'html',
                'sql': 'sql'
            }
            
            const actualLanguage = languageMap[language] || language
            
            switch (actualLanguage) {
                case 'python':
                    highlightedCode = this.highlightPython(highlightedCode)
                    break
                case 'javascript':
                case 'typescript':
                    highlightedCode = this.highlightJavaScript(highlightedCode)
                    break
                case 'bash':
                    highlightedCode = this.highlightBash(highlightedCode)
                    break
                case 'json':
                    highlightedCode = this.highlightJSON(highlightedCode)
                    break
                case 'css':
                    highlightedCode = this.highlightCSS(highlightedCode)
                    break
                case 'html':
                    highlightedCode = this.highlightHTML(highlightedCode)
                    break
                case 'sql':
                    highlightedCode = this.highlightSQL(highlightedCode)
                    break
                default:
                    highlightedCode = this.highlightGeneric(highlightedCode)
            }
            
            codeBlock.innerHTML = highlightedCode
            codeBlock.dataset.highlighted = 'true'
        })
    }

    /**
     * 检测代码语言
     */
    detectLanguage(codeBlock) {
        const className = codeBlock.className || ''
        const langMatch = className.match(/language-(\w+)/)
        return langMatch ? langMatch[1] : 'plaintext'
    }

    /**
     * Python 语法高亮
     */
    highlightPython(code) {
        // 按顺序应用高亮，避免重复匹配
        return code
            // 先处理字符串（三重引号）
            .replace(/("""[\s\S]*?""")/g, '<span class="token string">$1</span>')
            .replace(/('''[\s\S]*?''')/g, '<span class="token string">$1</span>')
            // 处理普通字符串
            .replace(/(["'])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="token string">$1$2$1</span>')
            // 处理注释
            .replace(/#[^<]*$/gm, '<span class="token comment">$&</span>')
            // 处理关键字
            .replace(/\b(import|from|def|class|if|else|elif|for|while|try|except|finally|return|print|with|as|lambda|yield|async|await|global|nonlocal|pass|break|continue|raise|assert|del)\b/g, '<span class="token keyword">$1</span>')
            // 处理布尔值和None
            .replace(/\b(True|False|None)\b/g, '<span class="token boolean">$1</span>')
            // 处理数字
            .replace(/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g, '<span class="token number">$&</span>')
            // 处理函数名
            .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g, '<span class="token function">$1</span>')
    }

    /**
     * JavaScript 语法高亮
     */
    highlightJavaScript(code) {
        return code
            // 处理字符串
            .replace(/(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="token string">$1$2$1</span>')
            // 处理注释
            .replace(/\/\/[^<]*$/gm, '<span class="token comment">$&</span>')
            .replace(/\/\*[\s\S]*?\*\//g, '<span class="token comment">$&</span>')
            // 处理关键字
            .replace(/\b(var|let|const|function|class|if|else|for|while|do|try|catch|finally|return|break|continue|switch|case|default|typeof|instanceof|new|this|super|extends|import|export|from|as|async|await)\b/g, '<span class="token keyword">$1</span>')
            // 处理布尔值
            .replace(/\b(true|false|null|undefined)\b/g, '<span class="token boolean">$1</span>')
            // 处理数字
            .replace(/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g, '<span class="token number">$&</span>')
            // 处理函数名
            .replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g, '<span class="token function">$1</span>')
    }

    /**
     * Bash 语法高亮
     */
    highlightBash(code) {
        return code
            // 处理字符串
            .replace(/(["'])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="token string">$1$2$1</span>')
            // 处理注释
            .replace(/#[^<]*$/gm, '<span class="token comment">$&</span>')
            // 处理关键字
            .replace(/\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|break|continue|echo|cd|ls|mkdir|rm|cp|mv|grep|sed|awk|sort|uniq|head|tail|cat|chmod|chown|pip|install)\b/g, '<span class="token keyword">$1</span>')
            // 处理变量
            .replace(/\$\w+/g, '<span class="token variable">$&</span>')
            .replace(/\$\{[^}]+\}/g, '<span class="token variable">$&</span>')
            // 处理选项参数
            .replace(/--?\w+/g, '<span class="token operator">$&</span>')
    }

    /**
     * JSON 语法高亮
     */
    highlightJSON(code) {
        return code
            // 处理字符串键和值
            .replace(/"([^"\\]|\\.)*"/g, '<span class="token string">$&</span>')
            // 处理数字
            .replace(/:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, ': <span class="token number">$1</span>')
            // 处理布尔值和null
            .replace(/:\s*(true|false|null)\b/g, ': <span class="token boolean">$1</span>')
            // 处理操作符
            .replace(/[{}[\],]/g, '<span class="token operator">$&</span>')
    }

    /**
     * CSS 语法高亮
     */
    highlightCSS(code) {
        return code
            // 处理选择器
            .replace(/^([^{]+)(?=\s*\{)/gm, '<span class="token selector">$1</span>')
            // 处理属性名
            .replace(/([a-zA-Z-]+)\s*:/g, '<span class="token property">$1</span>:')
            // 处理字符串
            .replace(/(["'])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="token string">$1$2$1</span>')
            // 处理注释
            .replace(/\/\*[\s\S]*?\*\//g, '<span class="token comment">$&</span>')
            // 处理数字和单位
            .replace(/\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|pt|pc|in|cm|mm|ex|ch|fr)?\b/g, '<span class="token number">$&</span>')
    }

    /**
     * HTML 语法高亮
     */
    highlightHTML(code) {
        return code
            // 处理标签
            .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, function(match, tagName) {
                return match.replace(new RegExp(tagName, 'g'), `<span class="token keyword">${tagName}</span>`)
            })
            // 处理属性值
            .replace(/="([^"]*)"/g, '="<span class="token string">$1</span>"')
            // 处理注释
            .replace(/<!--[\s\S]*?-->/g, '<span class="token comment">$&</span>')
    }

    /**
     * SQL 语法高亮
     */
    highlightSQL(code) {
        return code
            // 处理关键字
            .replace(/\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TABLE|INDEX|INTO|VALUES|SET|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|ORDER|BY|HAVING|LIMIT|DISTINCT|AS|AND|OR|NOT|NULL|TRUE|FALSE|IF|CASE|WHEN|THEN|ELSE|END)\b/gi, '<span class="token keyword">$1</span>')
            // 处理字符串
            .replace(/(["'])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="token string">$1$2$1</span>')
            // 处理注释
            .replace(/--[^<]*$/gm, '<span class="token comment">$&</span>')
            .replace(/\/\*[\s\S]*?\*\//g, '<span class="token comment">$&</span>')
            // 处理数字
            .replace(/\b\d+(?:\.\d+)?\b/g, '<span class="token number">$&</span>')
    }

    /**
     * 通用语法高亮
     */
    highlightGeneric(code) {
        return code
            // 处理字符串
            .replace(/(["'])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="token string">$1$2$1</span>')
            // 处理注释
            .replace(/#[^<]*$/gm, '<span class="token comment">$&</span>')
            .replace(/\/\/[^<]*$/gm, '<span class="token comment">$&</span>')
            // 处理数字
            .replace(/\b\d+(?:\.\d+)?\b/g, '<span class="token number">$&</span>')
    }


    /**
     * 为代码块添加复制按钮
     */
    addCopyButtonsToCodeBlocks(container) {
        const codeBlocks = container.find('pre:has(code)')
        
        codeBlocks.each((index, pre) => {
            const $pre = $(pre)
            
            // 检查是否已经添加了复制按钮
            if ($pre.find('.code-copy-btn').length > 0) {
                return
            }
            
            // 创建复制按钮
            const copyBtn = $(`
                <button class="code-copy-btn" title="${app.languageData.ai_copy_code || '复制代码'}">
                    <iconpark-icon name="copy" class="copy-icon"></iconpark-icon>
                    <iconpark-icon name="check" class="check-icon" style="display: none;"></iconpark-icon>
                </button>
            `)
            
            // 添加复制功能
            copyBtn.on('click', () => {
                const code = $pre.find('code').text()
                this.copyToClipboard(code, copyBtn)
            })
            
            // 设置相对定位并添加按钮
            $pre.css('position', 'relative')
            $pre.append(copyBtn)
        })
    }

    /**
     * 复制到剪贴板
     */
    copyToClipboard(text, button) {
        // 检查是否有 clipboard.js 库（项目中已有）
        if (typeof ClipboardJS !== 'undefined') {
            // 使用 clipboard.js
            try {
                navigator.clipboard.writeText(text).then(() => {
                    this.showCopySuccess(button)
                }).catch(() => {
                    // 降级到 clipboard.js
                    this.fallbackCopy(text, button)
                })
            } catch (e) {
                this.fallbackCopy(text, button)
            }
        } else {
            // 使用现代 clipboard API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => {
                    this.showCopySuccess(button)
                }).catch(() => {
                    this.fallbackCopy(text, button)
                })
            } else {
                this.fallbackCopy(text, button)
            }
        }
    }

    /**
     * 降级复制方法
     */
    fallbackCopy(text, button) {
        // 创建临时文本区域
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        
        try {
            const successful = document.execCommand('copy')
            if (successful) {
                this.showCopySuccess(button)
            } else {
                this.showCopyError(button)
            }
        } catch (e) {
            this.showCopyError(button)
        } finally {
            document.body.removeChild(textArea)
        }
    }

    /**
     * 显示复制成功状态
     */
    showCopySuccess(button) {
        const $btn = $(button)
        const copyIcon = $btn.find('.copy-icon')
        const checkIcon = $btn.find('.check-icon')
        
        // 切换图标
        copyIcon.hide()
        checkIcon.show()
        $btn.addClass('success')
        $btn.attr('title', app.languageData.ai_copy_success || '复制成功')
        
        // 显示成功提示
        if (typeof $.toast !== 'undefined') {
            $.toast({
                text: app.languageData.ai_copy_success || '复制成功',
                icon: 'success',
                showHideTransition: 'slide',
                allowToastClose: false,
                hideAfter: 2000,
                position: 'top-center'
            })
        }
        
        // 2秒后恢复
        setTimeout(() => {
            copyIcon.show()
            checkIcon.hide()
            $btn.removeClass('success')
            $btn.attr('title', app.languageData.ai_copy_code || '复制代码')
        }, 2000)
    }

    /**
     * 显示复制错误状态
     */
    showCopyError(button) {
        const $btn = $(button)
        $btn.addClass('error')
        $btn.attr('title', app.languageData.ai_copy_failed || '复制失败')
        
        // 显示错误提示
        if (typeof $.toast !== 'undefined') {
            $.toast({
                text: app.languageData.ai_copy_failed || '复制失败',
                icon: 'error',
                showHideTransition: 'slide',
                allowToastClose: false,
                hideAfter: 2000,
                position: 'top-center'
            })
        }
        
        // 1秒后恢复
        setTimeout(() => {
            $btn.removeClass('error')
            $btn.attr('title', app.languageData.ai_copy_code || '复制代码')
        }, 1000)
    }
}
