/**
 * FileList API Module
 * 封装所有与后端交互的 API 调用
 * 仅依赖基本的 API 配置（从 TL 获取 token、api_url 等）
 */

const FileListAPI = {
    // 从 TL 获取的基本配置
    getToken: function() {
        return typeof TL !== 'undefined' ? TL.token : null;
    },
    
    getApiUrl: function() {
        return typeof TL !== 'undefined' ? TL.api_url : '';
    },
    
    // 获取文件夹 API 地址 (meetingroom)
    getApiMr: function() {
        return typeof TL !== 'undefined' ? TL.api_mr : (this.getApiUrl() + '/meetingroom');
    },
    
    // 获取文件 API 地址
    getApiFile: function() {
        return typeof TL !== 'undefined' ? TL.api_file : (this.getApiUrl() + '/file');
    },
    
    getSiteDomain: function() {
        return typeof TL !== 'undefined' ? TL.site_domain : window.location.host;
    },

    /**
     * 通用 API 请求方法
     * 使用 jQuery $.post 保持与 TL 系统一致的跨域行为
     */
    request: async function(apiEndpoint, data = {}) {
        const token = this.getToken();
        
        // 构建请求数据
        const requestData = {
            token: token || '',
            ...data
        };
        
        return new Promise((resolve, reject) => {
            // 使用 jQuery 的 $.post，与 TL 系统保持一致
            if (typeof $ !== 'undefined' && $.post) {
                $.post(apiEndpoint, requestData, (response) => {
                    // 如果返回的是字符串，尝试解析为 JSON
                    if (typeof response === 'string') {
                        try {
                            response = JSON.parse(response);
                        } catch (e) {}
                    }
                    resolve(response);
                }, 'json').fail((xhr, status, error) => {
                    console.error('FileListAPI Error:', error);
                    resolve({ status: -1, message: error || '请求失败' });
                });
            } else {
                // Fallback 到 fetch
                const formData = new FormData();
                for (let key in requestData) {
                    if (requestData.hasOwnProperty(key)) {
                        formData.append(key, requestData[key]);
                    }
                }
                
                fetch(apiEndpoint, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                })
                .then(res => res.json())
                .then(resolve)
                .catch(error => {
                    console.error('FileListAPI Error:', error);
                    resolve({ status: -1, message: error.message });
                });
            }
        });
    },

    /**
     * 获取文件夹详细信息
     */
    getFolderInfo: async function(mrid) {
        return await this.request(this.getApiMr(), { 
            action: 'details',
            mr_id: mrid 
        });
    },

    /**
     * 获取子文件夹列表
     */
    getSubFolders: async function(mrid) {
        return await this.request(this.getApiMr(), { 
            action: 'room_list',
            mr_id: mrid 
        });
    },

    /**
     * 获取文件列表
     */
    getFiles: async function(mrid, page = 0, sortBy = 'time', sortType = 'desc', photo = 0) {
        return await this.request(this.getApiMr(), {
            action: 'file_list_page',
            mr_id: mrid,
            page: page,
            sort_by: sortBy,
            sort_type: sortType,
            photo: photo
        });
    },

    /**
     * 获取文件夹统计信息
     */
    getFolderTotal: async function(mrid) {
        return await this.request(this.getApiMr(), {
            action: 'total',
            mr_id: mrid
        });
    },

    /**
     * 创建文件夹
     */
    createFolder: async function(parentId, name, model = 'private') {
        return await this.request(this.getApiMr(), {
            action: 'create',
            parent: parentId,
            name: name,
            model: model === 'public' ? 1 : 0
        });
    },

    /**
     * 重命名文件夹
     */
    renameFolder: async function(mrid, newName) {
        return await this.request(this.getApiMr(), {
            action: 'rename',
            mr_id: mrid,
            name: newName
        });
    },

    /**
     * 删除文件夹
     */
    deleteFolder: async function(mrid) {
        return await this.request(this.getApiMr(), { 
            action: 'remove',
            mr_id: mrid 
        });
    },

    /**
     * 批量删除文件夹
     */
    deleteFolders: async function(mrids) {
        const results = [];
        for (const mrid of mrids) {
            results.push(await this.deleteFolder(mrid));
        }
        return { status: 0, results };
    },

    /**
     * 从文件夹中删除文件
     */
    deleteFile: async function(ukey, mrid) {
        return await this.request(this.getApiMr(), { 
            action: 'file_del',
            mr_id: mrid || 0,
            ukey: ukey 
        });
    },

    /**
     * 批量删除文件
     */
    deleteFiles: async function(ukeys, mrid) {
        return await this.request(this.getApiMr(), { 
            action: 'file_del',
            mr_id: mrid || 0,
            ukey: Array.isArray(ukeys) ? ukeys.join(',') : ukeys 
        });
    },

    /**
     * 移动文件到文件夹
     */
    moveFiles: async function(ukeys, targetMrid, sourceMrid) {
        return await this.request(this.getApiMr(), {
            action: 'file_move',
            ukey: Array.isArray(ukeys) ? ukeys.join(',') : ukeys,
            mr_id: sourceMrid || 0,
            target: targetMrid
        });
    },

    /**
     * 移动文件夹
     */
    moveFolder: async function(mrid, targetMrid) {
        return await this.request(this.getApiMr(), {
            action: 'move',
            mr_id: mrid,
            target: targetMrid
        });
    },

    /**
     * 获取文件下载链接
     */
    getDownloadUrl: async function(ukey) {
        return await this.request(this.getApiFile(), { 
            action: 'download',
            ukey: ukey 
        });
    },

    /**
     * 重命名文件
     */
    renameFile: async function(ukey, newName) {
        return await this.request(this.getApiFile(), {
            action: 'rename',
            ukey: ukey,
            fname: newName
        });
    },

    /**
     * 修改文件时效
     */
    changeFileModel: async function(ukeys, model) {
        return await this.request(this.getApiFile(), {
            action: 'change_model',
            ukey: Array.isArray(ukeys) ? ukeys.join(',') : ukeys,
            model: model
        });
    },

    /**
     * 获取文件夹设置
     */
    getFolderSettings: async function(mrid) {
        return await this.request(this.getApiMr(), { 
            action: 'performance',
            mr_id: mrid 
        });
    },

    /**
     * 更新文件夹设置
     */
    updateFolderSettings: async function(settings) {
        return await this.request(this.getApiMr(), {
            action: 'performance_set',
            ...settings
        });
    },

    /**
     * 切换文件夹直链功能
     */
    toggleDirectLink: async function(mrid, enabled) {
        // 使用 direct API
        const apiDirect = typeof TL !== 'undefined' ? TL.api_direct : (this.getApiUrl() + '/direct');
        return await this.request(apiDirect, {
            action: 'dir_toggle',
            mr_id: mrid,
            enabled: enabled ? 1 : 0
        });
    },

    /**
     * 搜索文件
     */
    searchFiles: async function(mrid, keyword) {
        return await this.request(this.getApiMr(), {
            action: 'file_list_page',
            mr_id: mrid,
            search: keyword,
            page: 0
        });
    },

    /**
     * 获取面包屑路径
     */
    getBreadcrumb: async function(mrid) {
        return await this.request(this.getApiMr(), { 
            action: 'path',
            mr_id: mrid 
        });
    },

    /**
     * 设置文件夹模型（公开/私有）
     */
    setFolderModel: async function(mrid, model) {
        return await this.request(this.getApiMr(), {
            action: 'set_model',
            mr_id: mrid,
            model: model
        });
    }
};

// 导出模块
if (typeof window !== 'undefined') {
    window.FileListAPI = FileListAPI;
}
