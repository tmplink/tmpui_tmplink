/**
 * VXUI Core Framework
 * 新一代后台框架核心 - 无 Bootstrap 依赖
 * @author VXUI Team
 * @version 1.0.0
 */

'use strict';

/**
 * VXUI 核心类
 */
class VXUICore {
    constructor() {
        // 版本
        this.version = '1.0.0';
        
        // 当前模块
        this.currentModule = null;
        
        // 已注册的模块
        this.modules = new Map();
        
        // 侧边栏状态
        this.sidebarOpen = false;
        this.sidebarCollapsed = false;
        
        // 暗色模式
        this.darkMode = this.getDarkModePreference();
        
        // 已加载的模板
        this.loadedTemplates = new Map();
        
        // Toast 队列
        this.toastQueue = [];
        
        // 当前打开的模态框
        this.openModals = [];
        
        // 绑定方法
        this.init = this.init.bind(this);
    }
    
    /**
     * 初始化 VXUI
     */
    init() {
        console.log('[VXUI] Initializing VXUI Core v' + this.version);
        
        // 应用暗色模式
        this.applyDarkMode();
        
        // 监听系统主题变化
        this.listenSystemTheme();
        
        // 绑定全局事件
        this.bindGlobalEvents();
        
        // 初始化提示框容器
        this.initToastContainer();
        
        // 处理 URL 参数，加载对应模块
        this.handleRoute();
        
        // 构建语言
        if (typeof app !== 'undefined') {
            app.languageBuild();
        }
        
        console.log('[VXUI] Core initialized');
    }
    
    /**
     * 处理路由
     */
    handleRoute() {
        const params = this.getUrlParams();
        const module = params.module || 'filelist';
        const moduleParams = { ...params };
        delete moduleParams.module;
        
        this.navigate(module, moduleParams);
    }
    
    /**
     * 获取 URL 参数
     */
    getUrlParams() {
        const params = {};
        const searchParams = new URLSearchParams(window.location.search);
        
        // 从 tmpui_page 参数中获取
        const tmpuiPage = searchParams.get('tmpui_page');
        if (tmpuiPage) {
            const pageParams = new URLSearchParams(tmpuiPage.split('?')[1] || '');
            pageParams.forEach((value, key) => {
                params[key] = value;
            });
        }
        
        // 直接从 URL 获取
        searchParams.forEach((value, key) => {
            if (key !== 'tmpui_page') {
                params[key] = value;
            }
        });
        
        return params;
    }
    
    /**
     * 注册模块
     */
    registerModule(name, module) {
        this.modules.set(name, module);
        console.log(`[VXUI] Module registered: ${name}`);
    }
    
    /**
     * 导航到指定模块
     */
    navigate(moduleName, params = {}) {
        // photo 模块已整合到 filelist(album) 中：兼容旧入口
        if (moduleName === 'photo') {
            moduleName = 'filelist';
            params = { ...params, view: 'album' };
        }

        console.log(`[VXUI] Navigating to: ${moduleName}`, params);
        
        // 获取模块
        const module = this.modules.get(moduleName);
        if (!module) {
            console.error(`[VXUI] Module not found: ${moduleName}`);
            this.toastError(`模块 ${moduleName} 未找到`);
            return;
        }
        
        // 卸载当前模块
        if (this.currentModule && this.currentModule !== moduleName) {
            const currentMod = this.modules.get(this.currentModule);
            if (currentMod && typeof currentMod.destroy === 'function') {
                currentMod.destroy();
            }
        }
        
        // 更新当前模块
        this.currentModule = moduleName;
        
        // 更新导航状态
        this.updateNavState(moduleName, params);

        // 重置模块侧边栏区域（模块仅写入 dynamic 区）
        this.clearSidebarDynamic();
        
        // 加载模块模板
        this.loadModuleTemplate(moduleName, () => {
            // 初始化模块
            if (typeof module.init === 'function') {
                module.init(params);
            }
            
            // 更新 URL
            this.updateUrl(moduleName, params);
            
            // 构建语言
            if (typeof app !== 'undefined') {
                app.languageBuild();
            }
            
            // 关闭移动端侧边栏
            this.closeSidebar();
        });
    }
    
    /**
     * 加载模块模板
     */
    loadModuleTemplate(moduleName, callback) {
        const templatePath = `/tpl/vxui/${moduleName}.html`;
        const container = document.getElementById('vx-module-container');
        
        if (!container) {
            console.error('[VXUI] Module container not found');
            return;
        }
        
        // 检查是否已缓存
        if (typeof app !== 'undefined' && typeof app.getFile === 'function') {
            const cachedContent = app.getFile(templatePath);
            if (cachedContent) {
                container.innerHTML = cachedContent;
                if (callback) callback();
                return;
            }
        }
        
        // 通过 AJAX 加载
        fetch(templatePath)
            .then(response => response.text())
            .then(html => {
                container.innerHTML = html;
                if (callback) callback();
            })
            .catch(error => {
                console.error(`[VXUI] Failed to load template: ${templatePath}`, error);
                this.toastError('加载模块失败');
            });
    }
    
    /**
     * 更新导航状态
     */
    updateNavState(moduleName, params = {}) {
        // 移除所有 active 状态
        document.querySelectorAll('.vx-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelectorAll('.vx-mobile-btn').forEach(item => {
            item.classList.remove('active');
        });
        
        // 添加当前模块的 active 状态
        document.querySelectorAll(`[data-module="${moduleName}"]`).forEach(item => item.classList.add('active'));

        // filelist 模块：同一模块下区分 list/album 入口
        if (moduleName === 'filelist') {
            const view = (params && params.view) ? String(params.view) : (localStorage.getItem('vx_view_mode') || 'list');
            document.querySelectorAll('[data-module="filelist"][data-view]').forEach(item => {
                const itemView = item.getAttribute('data-view');
                if (itemView && itemView !== view) {
                    item.classList.remove('active');
                }
            });
            document.querySelectorAll(`[data-module="filelist"][data-view="${view}"]`).forEach(item => item.classList.add('active'));
        }
    }

    /**
     * 清空模块动态侧边栏区域，并恢复静态导航可见性
     */
    clearSidebarDynamic() {
        const sidebarStatic = document.getElementById('vx-sidebar-static');
        const sidebarDynamic = document.getElementById('vx-sidebar-dynamic');
        const divider = document.getElementById('vx-sidebar-divider');

        if (sidebarStatic) {
            sidebarStatic.style.display = '';
        }
        if (sidebarDynamic) {
            sidebarDynamic.innerHTML = '';
        }
        if (divider) {
            divider.style.display = 'none';
        }
    }

    /**
     * 从 template 渲染模块动态侧边栏（仅模块特定操作区）
     */
    setSidebarDynamicFromTemplate(templateId) {
        const tpl = document.getElementById(templateId);
        const sidebarDynamic = document.getElementById('vx-sidebar-dynamic');
        const divider = document.getElementById('vx-sidebar-divider');
        if (!tpl || !sidebarDynamic) return;

        const content = tpl.content ? tpl.content.cloneNode(true) : tpl.cloneNode(true);
        sidebarDynamic.innerHTML = '';
        sidebarDynamic.appendChild(content);

        const hasContent = sidebarDynamic.textContent && sidebarDynamic.textContent.trim().length > 0;
        if (divider) {
            divider.style.display = hasContent ? '' : 'none';
        }

        if (typeof app !== 'undefined') {
            app.languageBuild();
        }
    }

    /**
     * 根据 dynamic 是否为空刷新分割线显示
     */
    refreshSidebarDivider() {
        const sidebarDynamic = document.getElementById('vx-sidebar-dynamic');
        const divider = document.getElementById('vx-sidebar-divider');
        if (!sidebarDynamic || !divider) return;
        const hasContent = sidebarDynamic.textContent && sidebarDynamic.textContent.trim().length > 0;
        divider.style.display = hasContent ? '' : 'none';
    }
    
    /**
     * 更新 URL
     */
    updateUrl(moduleName, params) {
        const url = new URL(window.location.href);
        const baseUrl = url.origin + url.pathname;
        
        // 构建正确的 URL 参数格式
        let queryParams = `tmpui_page=/vx&module=${moduleName}`;
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null && value !== '') {
                queryParams += `&${key}=${encodeURIComponent(value)}`;
            }
        }
        
        const newUrl = `${baseUrl}?${queryParams}`;
        window.history.replaceState({}, '', newUrl);
    }
    
    /**
     * 绑定全局事件
     */
    bindGlobalEvents() {
        // ESC 键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeTopModal();
            }
        });
        
        // 窗口大小变化
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                this.closeSidebar();
            }
        });
        
        // 点击侧边栏外部关闭
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('vx-sidebar');
            const toggleBtn = document.querySelector('[onclick*="toggleSidebar"]');
            const openBtn = document.querySelector('[onclick*="openSidebar"]');
            
            if (this.sidebarOpen && 
                sidebar && 
                !sidebar.contains(e.target) && 
                (!toggleBtn || !toggleBtn.contains(e.target)) &&
                (!openBtn || !openBtn.contains(e.target))) {
                this.closeSidebar();
            }
        });
    }
    
    // ==================== 侧边栏控制 ====================
    
    /**
     * 打开侧边栏
     */
    openSidebar() {
        this.sidebarOpen = true;
        const layout = document.getElementById('vx-layout');
        if (layout) {
            layout.classList.add('sidebar-open');
        }
    }
    
    /**
     * 关闭侧边栏
     */
    closeSidebar() {
        this.sidebarOpen = false;
        const layout = document.getElementById('vx-layout');
        if (layout) {
            layout.classList.remove('sidebar-open');
        }
    }
    
    /**
     * 切换侧边栏
     */
    toggleSidebar() {
        if (window.innerWidth <= 768) {
            if (this.sidebarOpen) {
                this.closeSidebar();
            } else {
                this.openSidebar();
            }
        } else {
            this.sidebarCollapsed = !this.sidebarCollapsed;
            const layout = document.getElementById('vx-layout');
            if (layout) {
                layout.classList.toggle('sidebar-collapsed', this.sidebarCollapsed);
            }
        }
    }
    
    // ==================== 暗色模式 ====================
    
    /**
     * 获取暗色模式偏好
     */
    getDarkModePreference() {
        // 始终跟随系统主题
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    /**
     * 监听系统主题变化
     */
    listenSystemTheme() {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const callback = (e) => {
            this.darkMode = e.matches;
            this.applyDarkMode();
            
            // 同步更新主题色
            if (typeof TL !== 'undefined' && typeof TL.setThemeColor === 'function') {
                TL.setThemeColor();
            }
        };
        
        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', callback);
        } else if (typeof media.addListener === 'function') {
            // 兼容旧版浏览器
            media.addListener(callback);
        }
    }
    
    /**
     * 应用暗色模式
     */
    applyDarkMode() {
        if (this.darkMode) {
            document.documentElement.classList.add('vx-dark');
        } else {
            document.documentElement.classList.remove('vx-dark');
        }
    }
    
    /**
     * 切换暗色模式
     */
    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        localStorage.setItem('vxui-dark-mode', this.darkMode);
        this.applyDarkMode();
    }
    
    // ==================== Toast 提示 ====================
    
    /**
     * 初始化 Toast 容器
     */
    initToastContainer() {
        if (!document.getElementById('vx-toast-container')) {
            const container = document.createElement('div');
            container.id = 'vx-toast-container';
            container.className = 'vx-toast-container';
            document.body.appendChild(container);
        }
    }
    
    /**
     * 显示 Toast
     */
    toast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('vx-toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `vx-toast vx-toast-${type}`;
        
        const icons = {
            success: 'check-circle',
            error: 'x-circle',
            warning: 'warning-circle',
            info: 'info-circle'
        };
        
        toast.innerHTML = `
            <iconpark-icon name="${icons[type] || 'info-circle'}" class="vx-toast-icon"></iconpark-icon>
            <span class="vx-toast-message">${message}</span>
            <button class="vx-toast-close" onclick="this.parentElement.remove()">
                <iconpark-icon name="close"></iconpark-icon>
            </button>
        `;
        
        container.appendChild(toast);
        
        // 触发动画
        requestAnimationFrame(() => {
            toast.classList.add('vx-toast-show');
        });
        
        // 自动移除
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.remove('vx-toast-show');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
    }
    
    /**
     * 成功提示
     */
    toastSuccess(message, duration = 3000) {
        this.toast(message, 'success', duration);
    }
    
    /**
     * 错误提示
     */
    toastError(message, duration = 4000) {
        this.toast(message, 'error', duration);
    }
    
    /**
     * 警告提示
     */
    toastWarning(message, duration = 3500) {
        this.toast(message, 'warning', duration);
    }
    
    /**
     * 信息提示
     */
    toastInfo(message, duration = 3000) {
        this.toast(message, 'info', duration);
    }
    
    // ==================== Modal 模态框 ====================
    
    /**
     * 打开模态框
     */
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        modal.classList.add('vx-modal-open');
        document.body.classList.add('vx-modal-body-open');
        this.openModals.push(modalId);
        
        // 聚焦第一个输入框
        const firstInput = modal.querySelector('input, textarea, select');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }
    
    /**
     * 关闭模态框
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        modal.classList.remove('vx-modal-open');
        this.openModals = this.openModals.filter(id => id !== modalId);
        
        if (this.openModals.length === 0) {
            document.body.classList.remove('vx-modal-body-open');
        }
    }
    
    /**
     * 关闭顶层模态框
     */
    closeTopModal() {
        if (this.openModals.length > 0) {
            const topModalId = this.openModals[this.openModals.length - 1];
            this.closeModal(topModalId);
        }
    }
    
    /**
     * 创建确认对话框
     */
    confirm(options) {
        const {
            title = '确认',
            message = '确定要执行此操作吗？',
            confirmText = '确定',
            cancelText = '取消',
            confirmClass = 'vx-btn-primary',
            onConfirm = () => {},
            onCancel = () => {}
        } = options;
        
        // 创建模态框
        const modalId = 'vx-confirm-modal-' + Date.now();
        const modal = document.createElement('div');
        modal.className = 'vx-modal';
        modal.id = modalId;
        
        modal.innerHTML = `
            <div class="vx-modal-overlay" onclick="VXUI.closeModal('${modalId}')"></div>
            <div class="vx-modal-container vx-modal-sm">
                <div class="vx-modal-header">
                    <h3 class="vx-modal-title">${title}</h3>
                    <button class="vx-modal-close" onclick="VXUI.closeModal('${modalId}')">
                        <iconpark-icon name="close"></iconpark-icon>
                    </button>
                </div>
                <div class="vx-modal-body">
                    <p>${message}</p>
                </div>
                <div class="vx-modal-footer">
                    <button class="vx-btn vx-btn-secondary" id="${modalId}-cancel">${cancelText}</button>
                    <button class="vx-btn ${confirmClass}" id="${modalId}-confirm">${confirmText}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 绑定事件
        document.getElementById(`${modalId}-cancel`).onclick = () => {
            this.closeModal(modalId);
            setTimeout(() => modal.remove(), 300);
            onCancel();
        };
        
        document.getElementById(`${modalId}-confirm`).onclick = () => {
            this.closeModal(modalId);
            setTimeout(() => modal.remove(), 300);
            onConfirm();
        };
        
        // 打开模态框
        setTimeout(() => this.openModal(modalId), 10);
    }
    
    /**
     * 创建输入对话框
     */
    prompt(options) {
        const {
            title = '输入',
            message = '',
            placeholder = '',
            defaultValue = '',
            confirmText = '确定',
            cancelText = '取消',
            onConfirm = () => {},
            onCancel = () => {}
        } = options;
        
        const modalId = 'vx-prompt-modal-' + Date.now();
        const modal = document.createElement('div');
        modal.className = 'vx-modal';
        modal.id = modalId;
        
        modal.innerHTML = `
            <div class="vx-modal-overlay" onclick="VXUI.closeModal('${modalId}')"></div>
            <div class="vx-modal-container vx-modal-sm">
                <div class="vx-modal-header">
                    <h3 class="vx-modal-title">${title}</h3>
                    <button class="vx-modal-close" onclick="VXUI.closeModal('${modalId}')">
                        <iconpark-icon name="close"></iconpark-icon>
                    </button>
                </div>
                <div class="vx-modal-body">
                    ${message ? `<p class="vx-mb-md">${message}</p>` : ''}
                    <input type="text" class="vx-input" id="${modalId}-input" 
                        placeholder="${placeholder}" value="${defaultValue}">
                </div>
                <div class="vx-modal-footer">
                    <button class="vx-btn vx-btn-secondary" id="${modalId}-cancel">${cancelText}</button>
                    <button class="vx-btn vx-btn-primary" id="${modalId}-confirm">${confirmText}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const input = document.getElementById(`${modalId}-input`);
        
        // 绑定事件
        document.getElementById(`${modalId}-cancel`).onclick = () => {
            this.closeModal(modalId);
            setTimeout(() => modal.remove(), 300);
            onCancel();
        };
        
        document.getElementById(`${modalId}-confirm`).onclick = () => {
            const value = input.value;
            this.closeModal(modalId);
            setTimeout(() => modal.remove(), 300);
            onConfirm(value);
        };
        
        // 回车确认
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                document.getElementById(`${modalId}-confirm`).click();
            }
        };
        
        // 打开模态框
        setTimeout(() => this.openModal(modalId), 10);
    }
    
    // ==================== 工具方法 ====================
    
    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * 格式化日期
     */
    formatDate(timestamp) {
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diff = now - date;
        
        // 小于 1 分钟
        if (diff < 60000) {
            return '刚刚';
        }
        
        // 小于 1 小时
        if (diff < 3600000) {
            return Math.floor(diff / 60000) + ' 分钟前';
        }
        
        // 小于 24 小时
        if (diff < 86400000) {
            return Math.floor(diff / 3600000) + ' 小时前';
        }
        
        // 小于 30 天
        if (diff < 2592000000) {
            return Math.floor(diff / 86400000) + ' 天前';
        }
        
        // 其他情况显示完整日期
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }
    
    /**
     * 复制到剪贴板
     */
    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.toastSuccess('已复制到剪贴板');
            }).catch(() => {
                this.fallbackCopy(text);
            });
        } else {
            this.fallbackCopy(text);
        }
    }
    
    /**
     * 降级复制方法
     */
    fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            this.toastSuccess('已复制到剪贴板');
        } catch (err) {
            this.toastError('复制失败');
        }
        document.body.removeChild(textarea);
    }
    
    /**
     * 防抖函数
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * 节流函数
     */
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * 获取文件图标
     */
    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const iconMap = {
            // 图片
            'jpg': 'image',
            'jpeg': 'image',
            'png': 'image',
            'gif': 'image',
            'webp': 'image',
            'svg': 'image',
            'bmp': 'image',
            // 视频
            'mp4': 'video',
            'mkv': 'video',
            'avi': 'video',
            'mov': 'video',
            'wmv': 'video',
            'flv': 'video',
            // 音频
            'mp3': 'music',
            'wav': 'music',
            'flac': 'music',
            'aac': 'music',
            'ogg': 'music',
            // 文档
            'pdf': 'file-pdf',
            'doc': 'file-word',
            'docx': 'file-word',
            'xls': 'file-excel',
            'xlsx': 'file-excel',
            'ppt': 'file-powerpoint',
            'pptx': 'file-powerpoint',
            'txt': 'file-text',
            'md': 'file-text',
            // 压缩包
            'zip': 'file-zip',
            'rar': 'file-zip',
            '7z': 'file-zip',
            'tar': 'file-zip',
            'gz': 'file-zip',
            // 代码
            'js': 'code',
            'ts': 'code',
            'html': 'code',
            'css': 'code',
            'json': 'code',
            'xml': 'code',
            'py': 'code',
            'java': 'code',
            'php': 'code',
            // 可执行文件
            'exe': 'file-apps',
            'app': 'file-apps',
            'dmg': 'file-apps',
            'apk': 'file-apps'
        };
        
        return iconMap[ext] || 'file';
    }
    
    /**
     * 判断是否为图片
     */
    isImage(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
    }
    
    /**
     * 判断是否为视频
     */
    isVideo(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        return ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext);
    }
    
    /**
     * 判断是否为音频
     */
    isAudio(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        return ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext);
    }
    
    /**
     * 判断是否为移动端
     */
    isMobile() {
        return window.innerWidth <= 768;
    }
}

// 创建全局实例
const VXUI = new VXUICore();

// 暴露到 window 对象
if (typeof window !== 'undefined') {
    window.VXUI = VXUI;
}
