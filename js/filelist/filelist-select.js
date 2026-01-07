/**
 * FileList Select Module
 * 独立的批量选择功能，不依赖 BoxSelect
 */

const FileListSelect = {
    // 选中的项目
    selectedFiles: new Set(),      // 选中的文件 ukey
    selectedFolders: new Set(),    // 选中的文件夹 mr_id
    
    // 最后选中的节点（用于 shift 选择）
    lastSelectedNode: null,
    
    // 是否处于选择模式
    isSelectMode: false,

    /**
     * 初始化选择器
     */
    init: function() {
        this.clear();
        this.bindEvents();
    },

    /**
     * 绑定事件
     */
    bindEvents: function() {
        // 键盘事件 - 防止 shift 选择时的文本选中
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Shift') {
                document.body.style.userSelect = 'none';
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.key === 'Shift') {
                document.body.style.userSelect = '';
            }
        });
    },

    /**
     * 清空所有选择
     */
    clear: function() {
        this.selectedFiles.clear();
        this.selectedFolders.clear();
        this.lastSelectedNode = null;
        this.isSelectMode = false;
        
        // 清除视觉状态
        document.querySelectorAll('.fl-item-selected').forEach(el => {
            el.classList.remove('fl-item-selected');
        });
        document.querySelectorAll('.fl-checkbox.checked').forEach(el => {
            el.classList.remove('checked');
        });
        
        this.updateUI();
    },

    /**
     * 全选
     */
    selectAll: function() {
        this.isSelectMode = true;
        
        document.querySelectorAll('[data-fl-type]').forEach(el => {
            const type = el.dataset.flType;
            const id = el.dataset.flId;
            
            if (type === 'file') {
                this.selectedFiles.add(id);
            } else if (type === 'folder') {
                this.selectedFolders.add(id);
            }
            
            el.classList.add('fl-item-selected');
            const checkbox = el.querySelector('.fl-checkbox');
            if (checkbox) checkbox.classList.add('checked');
        });
        
        this.updateUI();
    },

    /**
     * 点击选择/取消选择
     */
    toggle: function(element, event) {
        if (!element) return;
        
        const type = element.dataset.flType;
        const id = element.dataset.flId;
        
        if (!type || !id) return;
        
        // Shift 点击 - 范围选择
        if (event && event.shiftKey && this.lastSelectedNode) {
            this.shiftSelect(element);
            return;
        }
        
        const set = type === 'file' ? this.selectedFiles : this.selectedFolders;
        
        if (set.has(id)) {
            // 取消选择
            set.delete(id);
            element.classList.remove('fl-item-selected');
            const checkbox = element.querySelector('.fl-checkbox');
            if (checkbox) checkbox.classList.remove('checked');
        } else {
            // 选择
            set.add(id);
            element.classList.add('fl-item-selected');
            const checkbox = element.querySelector('.fl-checkbox');
            if (checkbox) checkbox.classList.add('checked');
            this.isSelectMode = true;
        }
        
        this.lastSelectedNode = element;
        this.updateUI();
    },

    /**
     * Shift 范围选择
     */
    shiftSelect: function(endNode) {
        const allNodes = Array.from(document.querySelectorAll('[data-fl-type]'));
        const startIndex = allNodes.indexOf(this.lastSelectedNode);
        const endIndex = allNodes.indexOf(endNode);
        
        if (startIndex === -1 || endIndex === -1) return;
        
        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);
        
        for (let i = minIndex; i <= maxIndex; i++) {
            const el = allNodes[i];
            const type = el.dataset.flType;
            const id = el.dataset.flId;
            
            if (type === 'file') {
                this.selectedFiles.add(id);
            } else if (type === 'folder') {
                this.selectedFolders.add(id);
            }
            
            el.classList.add('fl-item-selected');
            const checkbox = el.querySelector('.fl-checkbox');
            if (checkbox) checkbox.classList.add('checked');
        }
        
        this.lastSelectedNode = endNode;
        this.updateUI();
    },

    /**
     * 获取选中数量
     */
    getCount: function() {
        return this.selectedFiles.size + this.selectedFolders.size;
    },

    /**
     * 获取选中的文件
     */
    getSelectedFiles: function() {
        return Array.from(this.selectedFiles);
    },

    /**
     * 获取选中的文件夹
     */
    getSelectedFolders: function() {
        return Array.from(this.selectedFolders);
    },

    /**
     * 是否有选中项
     */
    hasSelection: function() {
        return this.getCount() > 0;
    },

    /**
     * 是否选中了文件
     */
    hasFileSelection: function() {
        return this.selectedFiles.size > 0;
    },

    /**
     * 是否选中了文件夹
     */
    hasFolderSelection: function() {
        return this.selectedFolders.size > 0;
    },

    /**
     * 更新 UI 状态
     */
    updateUI: function() {
        const count = this.getCount();
        
        // 更新选中计数
        const countEl = document.getElementById('fl-selection-count');
        if (countEl) countEl.textContent = count;
        
        // 显示/隐藏选择栏
        const bar = document.getElementById('fl-selection-bar');
        if (bar) {
            if (count > 0) {
                bar.classList.add('active');
            } else {
                bar.classList.remove('active');
            }
        }
        
        // 显示/隐藏需要选中才显示的按钮
        document.querySelectorAll('.fl-needs-selection').forEach(el => {
            el.style.display = count > 0 ? '' : 'none';
        });
        
        // 触发自定义事件
        const event = new CustomEvent('filelist:selectionchange', {
            detail: {
                count: count,
                files: this.getSelectedFiles(),
                folders: this.getSelectedFolders()
            }
        });
        document.dispatchEvent(event);
    },

    /**
     * 获取选中项的详细信息（用于分享等操作）
     */
    getSelectionDetails: function(fileList, folderList) {
        const details = [];
        
        this.selectedFolders.forEach(mrid => {
            const folder = folderList.find(f => String(f.mr_id) === String(mrid));
            if (folder) {
                details.push({
                    type: 'folder',
                    id: mrid,
                    name: folder.name,
                    url: `https://${FileListAPI.getSiteDomain()}/room/${mrid}`
                });
            }
        });
        
        this.selectedFiles.forEach(ukey => {
            const file = fileList.find(f => f.ukey === ukey);
            if (file) {
                details.push({
                    type: 'file',
                    id: ukey,
                    name: file.fname,
                    url: `https://${FileListAPI.getSiteDomain()}/f/${ukey}`
                });
            }
        });
        
        return details;
    }
};

// 导出模块
if (typeof window !== 'undefined') {
    window.FileListSelect = FileListSelect;
}
