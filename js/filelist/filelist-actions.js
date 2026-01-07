/**
 * FileList Actions Module
 * 处理文件和文件夹的各种操作（下载、删除、移动、分享等）
 */

const FileListActions = {
    /**
     * 下载单个文件
     */
    downloadFile: async function(ukey) {
        try {
            const result = await FileListAPI.getDownloadUrl(ukey);
            if (result.status === 0 && result.data && result.data.url) {
                window.open(result.data.url, '_blank');
            } else {
                FileListUI.showError(result.message || '获取下载链接失败');
            }
        } catch (error) {
            console.error('Download error:', error);
            FileListUI.showError('下载失败');
        }
    },

    /**
     * 下载选中的文件
     */
    downloadSelected: async function() {
        const files = FileListSelect.getSelectedFiles();
        if (files.length === 0) {
            FileListUI.showWarning('请先选择要下载的文件');
            return;
        }
        
        // 如果只有一个文件，直接下载
        if (files.length === 1) {
            await this.downloadFile(files[0]);
            return;
        }
        
        // 多个文件，尝试批量下载
        // 这里可以调用打包下载的 API，或逐个下载
        for (const ukey of files) {
            await this.downloadFile(ukey);
        }
    },

    /**
     * 下载文件夹内所有文件
     */
    downloadAll: async function(fileList) {
        if (!fileList || fileList.length === 0) {
            FileListUI.showWarning('没有可下载的文件');
            return;
        }
        
        for (const file of fileList) {
            await this.downloadFile(file.ukey);
        }
    },

    /**
     * 删除单个文件
     */
    deleteFile: async function(ukey, skipConfirm = false) {
        if (!skipConfirm && !this.confirmDelete()) {
            return false;
        }
        
        try {
            const result = await FileListAPI.deleteFile(ukey);
            if (result.status === 0) {
                FileListUI.showSuccess('删除成功');
                return true;
            } else {
                FileListUI.showError(result.message || '删除失败');
                return false;
            }
        } catch (error) {
            console.error('Delete error:', error);
            FileListUI.showError('删除失败');
            return false;
        }
    },

    /**
     * 删除单个文件夹
     */
    deleteFolder: async function(mrid, skipConfirm = false) {
        if (!skipConfirm && !this.confirmDelete()) {
            return false;
        }
        
        try {
            const result = await FileListAPI.deleteFolder(mrid);
            if (result.status === 0) {
                FileListUI.showSuccess('删除成功');
                return true;
            } else {
                FileListUI.showError(result.message || '删除失败');
                return false;
            }
        } catch (error) {
            console.error('Delete error:', error);
            FileListUI.showError('删除失败');
            return false;
        }
    },

    /**
     * 删除选中的项目
     */
    deleteSelected: async function() {
        const files = FileListSelect.getSelectedFiles();
        const folders = FileListSelect.getSelectedFolders();
        
        if (files.length === 0 && folders.length === 0) {
            FileListUI.showWarning('请先选择要删除的项目');
            return false;
        }
        
        if (!this.confirmDelete()) {
            return false;
        }
        
        let success = true;
        
        // 删除文件
        if (files.length > 0) {
            const result = await FileListAPI.deleteFiles(files);
            if (result.status !== 0) {
                success = false;
            }
        }
        
        // 删除文件夹
        if (folders.length > 0) {
            const result = await FileListAPI.deleteFolders(folders);
            if (result.status !== 0) {
                success = false;
            }
        }
        
        if (success) {
            FileListUI.showSuccess('删除成功');
            FileListSelect.clear();
        }
        
        return success;
    },

    /**
     * 确认删除
     */
    confirmDelete: function() {
        const lang = (typeof app !== 'undefined' && app.languageData) ? app.languageData : {};
        return confirm(lang.confirm_delete || '确定要删除吗？');
    },

    /**
     * 分享单个文件
     */
    shareFile: async function(ukey, fileName) {
        const domain = FileListAPI.getSiteDomain();
        const url = `https://${domain}/f/${ukey}`;
        const text = fileName ? `📄 ${fileName}\n${url}` : url;
        
        await this.copyToClipboard(text);
        FileListUI.showSuccess('链接已复制');
    },

    /**
     * 分享单个文件夹
     */
    shareFolder: async function(mrid, folderName) {
        const domain = FileListAPI.getSiteDomain();
        const url = `https://${domain}/room/${mrid}`;
        const text = folderName ? `📂 ${folderName}\n${url}` : url;
        
        await this.copyToClipboard(text);
        FileListUI.showSuccess('链接已复制');
    },

    /**
     * 分享选中的项目
     */
    shareSelected: async function(fileList, folderList) {
        const details = FileListSelect.getSelectionDetails(fileList, folderList);
        
        if (details.length === 0) {
            FileListUI.showWarning('请先选择要分享的项目');
            return;
        }
        
        let text = '';
        details.forEach(item => {
            const icon = item.type === 'folder' ? '📂' : '📄';
            text += `${icon} ${item.name}\n${item.url}\n\n`;
        });
        
        await this.copyToClipboard(text.trim());
        FileListUI.showSuccess('链接已复制');
    },

    /**
     * 移动选中的项目
     */
    moveSelected: function() {
        const files = FileListSelect.getSelectedFiles();
        const folders = FileListSelect.getSelectedFolders();
        
        if (files.length === 0 && folders.length === 0) {
            FileListUI.showWarning('请先选择要移动的项目');
            return;
        }
        
        // 显示移动对话框
        FileListUI.showMoveModal(files, folders);
    },

    /**
     * 执行移动操作
     */
    doMove: async function(targetMrid) {
        const files = FileListSelect.getSelectedFiles();
        const folders = FileListSelect.getSelectedFolders();
        
        let success = true;
        
        // 移动文件
        if (files.length > 0) {
            const result = await FileListAPI.moveFiles(files, targetMrid);
            if (result.status !== 0) {
                success = false;
            }
        }
        
        // 移动文件夹
        for (const mrid of folders) {
            const result = await FileListAPI.moveFolder(mrid, targetMrid);
            if (result.status !== 0) {
                success = false;
            }
        }
        
        if (success) {
            FileListUI.showSuccess('移动成功');
            FileListSelect.clear();
            FileListUI.hideMoveModal();
        }
        
        return success;
    },

    /**
     * 创建文件夹
     */
    createFolder: async function(parentId, name, model = 'private') {
        if (!name || name.trim() === '') {
            FileListUI.showWarning('请输入文件夹名称');
            return false;
        }
        
        try {
            const result = await FileListAPI.createFolder(parentId, name.trim(), model);
            if (result.status === 0) {
                FileListUI.showSuccess('创建成功');
                return true;
            } else {
                FileListUI.showError(result.message || '创建失败');
                return false;
            }
        } catch (error) {
            console.error('Create folder error:', error);
            FileListUI.showError('创建失败');
            return false;
        }
    },

    /**
     * 重命名文件夹
     */
    renameFolder: async function(mrid, newName) {
        if (!newName || newName.trim() === '') {
            FileListUI.showWarning('请输入新名称');
            return false;
        }
        
        try {
            const result = await FileListAPI.renameFolder(mrid, newName.trim());
            if (result.status === 0) {
                FileListUI.showSuccess('重命名成功');
                return true;
            } else {
                FileListUI.showError(result.message || '重命名失败');
                return false;
            }
        } catch (error) {
            console.error('Rename error:', error);
            FileListUI.showError('重命名失败');
            return false;
        }
    },

    /**
     * 重命名文件
     */
    renameFile: async function(ukey, newName) {
        if (!newName || newName.trim() === '') {
            FileListUI.showWarning('请输入新名称');
            return false;
        }
        
        try {
            const result = await FileListAPI.renameFile(ukey, newName.trim());
            if (result.status === 0) {
                FileListUI.showSuccess('重命名成功');
                return true;
            } else {
                FileListUI.showError(result.message || '重命名失败');
                return false;
            }
        } catch (error) {
            console.error('Rename error:', error);
            FileListUI.showError('重命名失败');
            return false;
        }
    },

    /**
     * 修改文件时效
     */
    changeFileModel: async function(ukeys, model) {
        try {
            const result = await FileListAPI.changeFileModel(ukeys, model);
            if (result.status === 0) {
                FileListUI.showSuccess('修改成功');
                return true;
            } else {
                FileListUI.showError(result.message || '修改失败');
                return false;
            }
        } catch (error) {
            console.error('Change model error:', error);
            FileListUI.showError('修改失败');
            return false;
        }
    },

    /**
     * 修改选中文件的有效期
     * @param {string} model - 有效期值：1, 7, 30, 99(永久)
     */
    changeExpiry: async function(model) {
        const files = FileListSelect.getSelectedFiles();
        
        if (files.length === 0) {
            FileListUI.showWarning('请先选择要修改的文件');
            return false;
        }
        
        const success = await this.changeFileModel(files, model);
        if (success) {
            FileListSelect.clear();
            // 刷新当前文件列表
            if (typeof FILELIST !== 'undefined' && FILELIST.refresh) {
                FILELIST.refresh();
            }
        }
        return success;
    },

    /**
     * 复制到剪贴板
     */
    copyToClipboard: async function(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback for older browsers
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            return true;
        } catch (error) {
            console.error('Copy error:', error);
            return false;
        }
    }
};

// 导出模块
if (typeof window !== 'undefined') {
    window.FileListActions = FileListActions;
}
