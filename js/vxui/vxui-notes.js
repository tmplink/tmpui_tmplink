/**
 * VXUI Notes (密记) Module
 * 密记管理模块 - 基于新 VXUI 框架
 * @version 1.0.0
 */

'use strict';

const VX_NOTES = {
    // 状态
    notesList: [],
    currentNote: null,
    isEditing: false,
    searchKeyword: '',
    
    /**
     * 初始化模块
     */
    init(params = {}) {
        console.log('[VX_NOTES] Initializing...', params);
        
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
        
        // 加载数据
        this.load();
        
        // 如果有指定的笔记 ID，打开它
        if (params.id) {
            this.openNote(params.id);
        }
    },
    
    /**
     * 销毁模块
     */
    destroy() {
        console.log('[VX_NOTES] Destroying...');
        this.unbindEvents();
    },
    
    /**
     * 重置状态
     */
    resetState() {
        this.notesList = [];
        this.currentNote = null;
        this.isEditing = false;
        this.searchKeyword = '';
    },
    
    /**
     * 更新侧边栏
     */
    updateSidebar() {
        const sidebarDynamic = document.getElementById('vx-sidebar-dynamic');
        if (!sidebarDynamic) return;
        
        sidebarDynamic.innerHTML = `
            <div class="vx-nav-section">
                <div class="vx-nav-title" data-tpl="notes_actions">操作</div>
                <a href="javascript:;" class="vx-nav-item" onclick="VX_NOTES.createNote()">
                    <iconpark-icon name="circle-plus"></iconpark-icon>
                    <span class="vx-nav-item-text" data-tpl="notes_new">新建密记</span>
                </a>
                <a href="javascript:;" class="vx-nav-item" onclick="VX_NOTES.refresh()">
                    <iconpark-icon name="rotate"></iconpark-icon>
                    <span class="vx-nav-item-text" data-tpl="album_refresh">刷新</span>
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
        // 自动保存
        this._autoSaveHandler = VXUI.debounce(() => {
            if (this.isEditing && this.currentNote) {
                this.saveNote(true);
            }
        }, 3000);
    },
    
    /**
     * 解绑事件
     */
    unbindEvents() {
        // 清理
    },
    
    /**
     * 加载数据
     */
    load() {
        this.showLoading();
        
        if (typeof TL === 'undefined' || typeof NOTES === 'undefined') {
            this.hideLoading();
            this.showEmpty();
            return;
        }
        
        this.fetchData().then(() => {
            this.hideLoading();
            this.render();
        }).catch(error => {
            console.error('[VX_NOTES] Load error:', error);
            this.hideLoading();
            VXUI.toastError('加载失败');
        });
    },
    
    /**
     * 获取数据
     */
    fetchData() {
        return new Promise((resolve, reject) => {
            $.post(TL.api_notes, {
                action: 'list',
                token: TL.api_token
            }, (rsp) => {
                if (rsp.status === 1) {
                    this.notesList = rsp.data || [];
                }
                resolve();
            }).fail(reject);
        });
    },
    
    /**
     * 渲染列表
     */
    render() {
        const container = document.getElementById('vx-notes-list');
        if (!container) return;
        
        // 过滤搜索结果
        let filteredList = this.notesList;
        if (this.searchKeyword) {
            const keyword = this.searchKeyword.toLowerCase();
            filteredList = this.notesList.filter(note => 
                (note.notes_title || '').toLowerCase().includes(keyword) ||
                (note.notes_content || '').toLowerCase().includes(keyword)
            );
        }
        
        if (filteredList.length === 0) {
            if (this.searchKeyword) {
                container.innerHTML = `
                    <div class="vx-empty">
                        <div class="vx-empty-icon">
                            <iconpark-icon name="search"></iconpark-icon>
                        </div>
                        <h3 class="vx-empty-title">未找到匹配的密记</h3>
                        <p class="vx-empty-text">尝试其他关键词</p>
                    </div>
                `;
            } else {
                this.showEmpty();
            }
            return;
        }
        
        let html = '';
        filteredList.forEach(note => {
            html += this.renderItem(note);
        });
        
        container.innerHTML = html;
        
        // 显示内容
        document.getElementById('vx-notes-content')?.classList.remove('vx-hidden');
        document.getElementById('vx-notes-empty')?.classList.add('vx-hidden');
        
        // 更新统计
        this.updateStats();
    },
    
    /**
     * 渲染项目
     */
    renderItem(note) {
        const title = note.notes_title || '无标题';
        const preview = this.getContentPreview(note.notes_content || '');
        const updateTime = VXUI.formatDate(note.notes_updatetime);
        const isActive = this.currentNote && this.currentNote.notes_id === note.notes_id;
        
        return `
            <div class="vx-notes-item ${isActive ? 'active' : ''}" 
                data-id="${note.notes_id}"
                onclick="VX_NOTES.openNote(${note.notes_id})">
                <div class="vx-notes-item-header">
                    <h4 class="vx-notes-item-title">${title}</h4>
                    <span class="vx-notes-item-time">${updateTime}</span>
                </div>
                <p class="vx-notes-item-preview">${preview}</p>
                <div class="vx-notes-item-actions">
                    <button class="vx-btn-icon" onclick="event.stopPropagation(); VX_NOTES.deleteNote(${note.notes_id})" 
                        data-vx-tooltip="删除">
                        <iconpark-icon name="trash"></iconpark-icon>
                    </button>
                </div>
            </div>
        `;
    },
    
    /**
     * 获取内容预览
     */
    getContentPreview(content) {
        // 移除 HTML 标签
        const text = content.replace(/<[^>]+>/g, ' ').trim();
        // 截取前 100 个字符
        return text.length > 100 ? text.substring(0, 100) + '...' : text;
    },
    
    /**
     * 搜索
     */
    search(keyword) {
        this.searchKeyword = keyword;
        this.render();
    },
    
    /**
     * 打开笔记
     */
    openNote(id) {
        // 保存当前笔记
        if (this.isEditing && this.currentNote) {
            this.saveNote(true);
        }
        
        // 查找笔记
        const note = this.notesList.find(n => n.notes_id === id);
        if (!note) {
            VXUI.toastError('密记不存在');
            return;
        }
        
        this.currentNote = note;
        this.isEditing = false;
        
        // 更新 URL
        VXUI.updateUrl('notes', { id: id });
        
        // 显示编辑器
        this.showEditor();
        
        // 更新列表选中状态
        this.updateListSelection();
    },
    
    /**
     * 显示编辑器
     */
    showEditor() {
        const editor = document.getElementById('vx-notes-editor');
        const placeholder = document.getElementById('vx-notes-placeholder');
        
        if (editor) editor.classList.remove('vx-hidden');
        if (placeholder) placeholder.classList.add('vx-hidden');
        
        // 填充内容
        const titleInput = document.getElementById('vx-notes-title');
        const contentEditor = document.getElementById('vx-notes-content-editor');
        
        if (titleInput) {
            titleInput.value = this.currentNote?.notes_title || '';
        }
        if (contentEditor) {
            contentEditor.innerHTML = this.currentNote?.notes_content || '';
        }
        
        // 聚焦
        titleInput?.focus();
    },
    
    /**
     * 隐藏编辑器
     */
    hideEditor() {
        const editor = document.getElementById('vx-notes-editor');
        const placeholder = document.getElementById('vx-notes-placeholder');
        
        if (editor) editor.classList.add('vx-hidden');
        if (placeholder) placeholder.classList.remove('vx-hidden');
        
        this.currentNote = null;
        this.isEditing = false;
        this.updateListSelection();
    },
    
    /**
     * 更新列表选中状态
     */
    updateListSelection() {
        document.querySelectorAll('.vx-notes-item').forEach(item => {
            const id = parseInt(item.dataset.id);
            item.classList.toggle('active', this.currentNote && this.currentNote.notes_id === id);
        });
    },
    
    /**
     * 新建笔记
     */
    createNote() {
        // 保存当前笔记
        if (this.isEditing && this.currentNote) {
            this.saveNote(true);
        }
        
        if (typeof TL === 'undefined') return;
        
        $.post(TL.api_notes, {
            action: 'create',
            token: TL.api_token,
            title: '新密记',
            content: ''
        }, (rsp) => {
            if (rsp.status === 1) {
                VXUI.toastSuccess('创建成功');
                // 重新加载列表
                this.load();
                // 打开新笔记
                setTimeout(() => {
                    if (rsp.data && rsp.data.notes_id) {
                        this.openNote(rsp.data.notes_id);
                    }
                }, 500);
            } else {
                VXUI.toastError(rsp.message || '创建失败');
            }
        });
    },
    
    /**
     * 保存笔记
     */
    saveNote(silent = false) {
        if (!this.currentNote) return;
        
        const titleInput = document.getElementById('vx-notes-title');
        const contentEditor = document.getElementById('vx-notes-content-editor');
        
        const title = titleInput?.value || '无标题';
        const content = contentEditor?.innerHTML || '';
        
        if (typeof TL === 'undefined') return;
        
        $.post(TL.api_notes, {
            action: 'update',
            token: TL.api_token,
            notes_id: this.currentNote.notes_id,
            title: title,
            content: content
        }, (rsp) => {
            if (rsp.status === 1) {
                // 更新本地数据
                this.currentNote.notes_title = title;
                this.currentNote.notes_content = content;
                this.currentNote.notes_updatetime = Math.floor(Date.now() / 1000);
                
                // 更新列表显示
                this.render();
                
                if (!silent) {
                    VXUI.toastSuccess('保存成功');
                }
            } else if (!silent) {
                VXUI.toastError(rsp.message || '保存失败');
            }
        });
    },
    
    /**
     * 删除笔记
     */
    deleteNote(id) {
        VXUI.confirm({
            title: '删除确认',
            message: '确定要删除这条密记吗？删除后无法恢复。',
            confirmClass: 'vx-btn-danger',
            onConfirm: () => {
                this.doDelete(id);
            }
        });
    },
    
    /**
     * 执行删除
     */
    doDelete(id) {
        if (typeof TL === 'undefined') return;
        
        $.post(TL.api_notes, {
            action: 'delete',
            token: TL.api_token,
            notes_id: id
        }, (rsp) => {
            if (rsp.status === 1) {
                VXUI.toastSuccess('删除成功');
                
                // 如果删除的是当前笔记，关闭编辑器
                if (this.currentNote && this.currentNote.notes_id === id) {
                    this.hideEditor();
                }
                
                // 重新加载
                this.load();
            } else {
                VXUI.toastError(rsp.message || '删除失败');
            }
        });
    },
    
    /**
     * 内容变化处理
     */
    onContentChange() {
        this.isEditing = true;
        this._autoSaveHandler?.();
    },
    
    /**
     * 刷新
     */
    refresh() {
        this.load();
    },
    
    // ==================== UI Helpers ====================
    
    /**
     * 显示加载状态
     */
    showLoading() {
        const loading = document.getElementById('vx-notes-loading');
        const content = document.getElementById('vx-notes-content');
        const empty = document.getElementById('vx-notes-empty');
        
        if (loading) loading.classList.remove('vx-hidden');
        if (content) content.classList.add('vx-hidden');
        if (empty) empty.classList.add('vx-hidden');
    },
    
    /**
     * 隐藏加载状态
     */
    hideLoading() {
        const loading = document.getElementById('vx-notes-loading');
        if (loading) loading.classList.add('vx-hidden');
    },
    
    /**
     * 显示空状态
     */
    showEmpty() {
        const content = document.getElementById('vx-notes-content');
        const empty = document.getElementById('vx-notes-empty');
        
        if (content) content.classList.add('vx-hidden');
        if (empty) empty.classList.remove('vx-hidden');
    },
    
    /**
     * 更新统计
     */
    updateStats() {
        const countEl = document.getElementById('vx-notes-count');
        if (countEl) {
            countEl.textContent = this.notesList.length;
        }
    }
};

// 注册模块
if (typeof VXUI !== 'undefined') {
    VXUI.registerModule('notes', VX_NOTES);
}
