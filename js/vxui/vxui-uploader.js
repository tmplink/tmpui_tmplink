/**
 * VXUI Uploader Module
 * 专为 VXUI 设计的上传模块，支持文件列表内嵌进度显示
 * @version 1.0.0
 */
var VX_UPLOADER = VX_UPLOADER || {
    // 配置
    slice_size: 3 * 1024 * 1024, // 3MB per slice
    single_file_size: 50 * 1024 * 1024 * 1024, // 50GB max
    max_queue: 5, // 最大同时上传数
    max_threads: 5, // 单文件最大线程数

    // 状态
    initialized: false,
    upload_queue: [], // 待上传队列
    uploading: {}, // 正在上传的文件 { id: { file, status, progress, speed, ... } }
    upload_id_counter: 0,
    active_count: 0, // 当前上传中的数量

    // 存储信息
    storage: 0,
    storage_used: 0,
    private_storage_used: 0,

    // 上传设置
    upload_model: 1, // 默认3天
    upload_server: null,
    servers: [],
    serversLoading: false, // 服务器列表加载中
    serversLoaded: false, // 服务器列表已加载
    serversLoadCallbacks: [], // 等待服务器加载的回调队列
    prepare_sha1: false,
    skip_upload: false,

    // 速度统计
    speed_data: {},
    total_uploaded: 0,

    /**
     * 初始化上传模块
     */
    init() {
        if (this.initialized) return;
        
        console.log('[VX_UPLOADER] Initializing...');
        
        // 加载本地设置
        this.loadSettings();
        
        // 加载服务器列表
        this.loadServers();
        
        // 获取存储信息
        this.loadStorageInfo();
        
        this.initialized = true;
    },

    /**
     * 记录 UI 行为（event_ui）
     */
    trackUI(title) {
        try {
            if (!title) return;
            if (typeof VXUI !== 'undefined' && VXUI && typeof VXUI.trackUI === 'function') {
                VXUI.trackUI(title);
                return;
            }
            if (typeof TL !== 'undefined' && TL && typeof TL.ga === 'function') {
                TL.ga(title);
            }
        } catch (e) {
            // ignore
        }
    },

    /**
     * 加载本地保存的设置
     */
    loadSettings() {
        // 上传模式
        const storedModel = localStorage.getItem('app_upload_model');
        if (storedModel !== null) {
            this.upload_model = this.normalizeModel(Number(storedModel));
        }
        
        // 上传服务器
        const storedServer = localStorage.getItem('app_upload_server');
        if (storedServer !== null) {
            this.upload_server = storedServer;
        }
        
        // 秒传
        const quickUpload = localStorage.getItem('app_upload_quick');
        this.prepare_sha1 = quickUpload === '1';
    },

    /**
     * 加载服务器列表
     */
    loadServers() {
        const token = this.getToken();
        if (!token) {
            this.serversLoaded = true;
            this.serversLoading = false;
            return;
        }
        
        // 如果已经加载完成，不重复加载
        if (this.serversLoaded) return;
        
        // 如果正在加载中，不重复发起请求
        if (this.serversLoading) return;
        
        this.serversLoading = true;

        const api = this.getUploadApi();
        
        this.recaptchaDo('upload_request_select2', (captcha) => {
            $.post(api, {
                token: token,
                action: 'upload_request_select2',
                captcha: captcha
            }, (rsp) => {
                this.serversLoading = false;
                this.serversLoaded = true;
                
                if (rsp.status === 1 && rsp.data && rsp.data.servers) {
                    this.servers = rsp.data.servers;
                    
                    // 验证存储的服务器是否有效
                    if (this.upload_server) {
                        const valid = this.servers.some(s => s.url === this.upload_server);
                        if (!valid && this.servers.length > 0) {
                            this.upload_server = this.servers[0].url;
                        }
                    } else if (this.servers.length > 0) {
                        this.upload_server = this.servers[0].url;
                    }
                    
                    // 更新下拉框
                    this.updateServerSelect();
                }
                
                // 执行等待中的回调
                this.executeServersLoadCallbacks();
            }, 'json').fail(() => {
                this.serversLoading = false;
                this.serversLoaded = true;
                // 执行等待中的回调
                this.executeServersLoadCallbacks();
            });
        });
    },
    
    /**
     * 等待服务器列表加载完成
     */
    waitForServers(callback) {
        if (this.serversLoaded) {
            callback();
            return;
        }
        
        // 添加到回调队列
        this.serversLoadCallbacks.push(callback);
        
        // 如果还没有开始加载，启动加载
        if (!this.serversLoading) {
            this.loadServers();
        }
    },
    
    /**
     * 执行等待服务器加载的回调
     */
    executeServersLoadCallbacks() {
        const callbacks = this.serversLoadCallbacks.slice();
        this.serversLoadCallbacks = [];
        callbacks.forEach(cb => {
            try {
                cb();
            } catch (e) {
                console.error('[VX_UPLOADER] Server load callback error:', e);
            }
        });
    },

    /**
     * 加载存储信息
     */
    loadStorageInfo() {
        // 从 TL 获取存储信息
        if (typeof TL !== 'undefined') {
            this.storage = TL.storage || 0;
            this.storage_used = TL.storage_used || 0;
            this.private_storage_used = TL.private_storage_used || 0;
        }
    },

    /**
     * 打开上传模态框
     */
    openModal(mrid) {
        console.log('[VX_UPLOADER] openModal called, mrid:', mrid);
        
        if (!this.initialized) {
            this.init();
        }

        // 设置当前上传目录
        this.current_mrid = mrid || 0;
        
        // 更新模态框内容
        this.updateModalUI();
        
        // 显示模态框
        const modal = document.getElementById('vx-upload-modal');
        console.log('[VX_UPLOADER] modal element:', modal);
        
        if (modal) {
            modal.classList.add('vx-modal-open');
            document.body.classList.add('vx-modal-body-open');
        } else {
            console.error('[VX_UPLOADER] Modal element not found: vx-upload-modal');
        }
    },

    /**
     * 关闭上传模态框
     */
    closeModal() {
        const modal = document.getElementById('vx-upload-modal');
        if (modal) {
            modal.classList.remove('vx-modal-open');
            document.body.classList.remove('vx-modal-body-open');
        }
    },

    /**
     * 更新模态框 UI
     */
    updateModalUI() {
        // 更新有效期选择
        const modelSelect = document.getElementById('vx-upload-model');
        if (modelSelect) {
            modelSelect.value = String(this.upload_model);
        }
        
        // 更新有效期描述
        this.updateModelDescription(this.upload_model);
        
        // 更新服务器选择
        this.updateServerSelect();
        
        // 更新私有空间显示
        this.updateStorageLabel();
    },

    /**
     * 更新服务器下拉框
     */
    updateServerSelect() {
        const serverSelect = document.getElementById('vx-upload-server');
        if (!serverSelect || !this.servers.length) return;

        serverSelect.innerHTML = this.servers.map((s) => {
            // 老代码使用 servers[].title 作为显示文本
            const url = (s && typeof s === 'object') ? s.url : String(s || '');
            const label = (s && typeof s === 'object')
                ? (s.title || s.name || s.label || s.id || url)
                : url;
            const selected = url && url === this.upload_server;
            return `<option value="${this.escapeHtml(url)}" ${selected ? 'selected' : ''}>${this.escapeHtml(label)}</option>`;
        }).join('');
        
        // 非赞助者禁用服务器选择
        if (typeof TL !== 'undefined' && !TL.isSponsor) {
            serverSelect.disabled = true;
        }
    },

    /**
     * 更新存储标签
     */
    updateStorageLabel() {
        const remaining = Math.max(this.storage - this.private_storage_used, 0);
        const label = document.querySelector('#vx-upload-model option[value="99"]');
        if (label) {
            const baseText = this.getLang('modal_settings_upload_model99') || '永久保存';
            const leftText = this.getLang('upload_settings_private_left') || '剩余可用空间';
            label.textContent = `${baseText} (${leftText} ${this.formatSize(remaining)})`;
            
            // 空间不足时禁用
            if (remaining <= 0) {
                label.disabled = true;
            }
        }
    },

    /**
     * 处理有效期变更
     */
    onModelChange(value) {
        const normalized = this.normalizeModel(Number(value));
        
        // 检查私有空间
        if (normalized === 99 && this.private_storage_used >= this.storage) {
            VXUI.toastWarning('私有空间已用完');
            const select = document.getElementById('vx-upload-model');
            if (select) select.value = String(this.upload_model);
            return;
        }
        
        this.upload_model = normalized;
        localStorage.setItem('app_upload_model', normalized);
        
        // 更新描述文本
        this.updateModelDescription(normalized);
    },
    
    /**
     * 更新有效期描述
     */
    updateModelDescription(model) {
        const hint = document.querySelector('.vx-upload-setting-item:first-child .vx-upload-setting-hint');
        if (!hint) return;
        
        const descriptions = {
            0: this.getLang('modal_settings_upload_model1_des') || '这个文件在 24 后将被自动销毁。',
            1: this.getLang('modal_settings_upload_model2_des') || '将在有人下载时自动延长这个期限。',
            2: this.getLang('modal_settings_upload_model3_des') || '将在有人下载时自动延长这个期限。',
            99: this.getLang('modal_settings_upload_model99_des') || '文件将存入您的私有空间。'
        };
        
        hint.textContent = descriptions[model] || descriptions[0];
    },

    /**
     * 处理服务器变更
     */
    onServerChange(value) {
        this.upload_server = value;
        localStorage.setItem('app_upload_server', value);
    },

    /**
     * 选择文件
     */
    selectFiles() {
        const input = document.getElementById('vx-upload-file-input');
        if (input) {
            input.click();
        }
    },

    /**
     * 选择文件夹
     */
    selectFolder() {
        const input = document.getElementById('vx-upload-folder-input');
        if (input) {
            input.click();
        }
    },

    /**
     * 文件选择处理
     */
    onFilesSelected(input) {
        const files = input.files;
        if (!files || files.length === 0) return;
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.size > 0) {
                this.addToQueue({
                    file: file,
                    is_dir: false
                });
            }
        }
        
        // 清空 input
        input.value = '';
        
        // 关闭模态框并开始上传
        this.closeModal();
    },

    /**
     * 文件夹选择处理
     */
    onFolderSelected(input) {
        const files = input.files;
        if (!files || files.length === 0) return;
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.size > 0) {
                this.addToQueue({
                    file: file,
                    is_dir: true
                });
            }
        }
        
        // 清空 input
        input.value = '';
        
        // 关闭模态框并开始上传
        this.closeModal();
    },

    /**
     * 处理拖拽
     */
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;
        
        for (let i = 0; i < files.length; i++) {
            if (files[i].size > 0) {
                this.addToQueue({
                    file: files[i],
                    is_dir: false
                });
            }
        }
    },

    /**
     * 处理粘贴
     */
    handlePaste(e) {
        const items = e.clipboardData.items;
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file && file.size > 0) {
                    this.addToQueue({
                        file: file,
                        is_dir: false
                    });
                }
            }
        }
    },

    /**
     * 添加文件到队列
     */
    addToQueue(item) {
        const file = item.file;
        
        // 检查文件大小
        if (file.size > this.single_file_size) {
            VXUI.toastError(`${file.name}: 文件超出大小限制`);
            return;
        }
        
        // 检查私有空间
        if (this.upload_model === 99) {
            if (file.size > (this.storage - this.storage_used)) {
                VXUI.toastError(`${file.name}: 私有空间不足`);
                return;
            }
        }
        
        const id = ++this.upload_id_counter;
        
        // 创建上传任务
        const task = {
            id: id,
            file: file,
            filename: item.is_dir ? file.webkitRelativePath : file.name,
            is_dir: item.is_dir,
            model: this.upload_model,
            mrid: this.current_mrid || (typeof VX_FILELIST !== 'undefined' ? VX_FILELIST.mrid : 0),
            status: 'pending', // pending, preparing, uploading, merging, completed, failed
            progress: 0,
            uploaded: 0,
            speed: 0,
            error: null,
            ukey: null
        };
        
        this.upload_queue.push(task);
        
        // 在文件列表中显示上传项
        this.renderUploadRow(task);
        
        // 启动上传
        this.processQueue();
    },

    /**
     * 处理队列
     */
    processQueue() {
        // 检查是否可以开始新的上传
        if (this.active_count >= this.max_queue) return;
        if (this.upload_queue.length === 0) return;
        
        // 取出一个任务
        const task = this.upload_queue.shift();
        this.active_count++;
        this.uploading[task.id] = task;
        
        // 开始上传
        this.startUpload(task);
    },

    /**
     * 开始上传
     */
    startUpload(task) {
        const name = (task && task.filename) ? task.filename : 'file';
        this.trackUI(`vui_upload[${name}]`);
        task.status = 'preparing';
        this.updateUploadRow(task);
        
        // 计算 SHA1 (如果启用秒传)
        if (this.prepare_sha1) {
            this.calculateSHA1(task.file, task.id, (sha1) => {
                task.sha1 = sha1;
                this.requestUpload(task);
            });
        } else {
            task.sha1 = null;
            this.requestUpload(task);
        }
    },

    /**
     * 计算 SHA1
     */
    calculateSHA1(file, id, callback) {
        if (!window.FileReader || typeof CryptoJS === 'undefined') {
            callback(0);
            return;
        }
        
        const blockSize = 64 * 1024;
        const sha1 = CryptoJS.algo.SHA1.create();
        let currentBlock = 0;
        const totalBlocks = Math.ceil(file.size / blockSize);
        const reader = new FileReader();
        
        reader.onload = () => {
            const data = new Uint8Array(reader.result);
            sha1.update(CryptoJS.lib.WordArray.create(data));
            currentBlock++;
            
            // 更新进度
            const progress = Math.floor(currentBlock / totalBlocks * 30); // SHA1计算占30%
            const task = this.uploading[id];
            if (task) {
                task.progress = progress;
                this.updateUploadRow(task);
            }
            
            if (currentBlock < totalBlocks) {
                readNextBlock();
            } else {
                callback(sha1.finalize().toString());
            }
        };
        
        const readNextBlock = () => {
            const start = currentBlock * blockSize;
            const end = Math.min(start + blockSize, file.size);
            reader.readAsArrayBuffer(file.slice(start, end));
        };
        
        readNextBlock();
    },

    /**
     * 请求上传
     */
    requestUpload(task) {
        const token = this.getToken();
        const api = this.getUploadApi();
        
        this.recaptchaDo('upload_request_select2', (captcha) => {
            $.post(api, {
                token: token,
                action: 'upload_request_select2',
                filesize: task.file.size,
                captcha: captcha
            }, (rsp) => {
                if (rsp.status === 1) {
                    task.utoken = rsp.data.utoken;
                    this.uploadSlice(task);
                } else {
                    this.uploadFailed(task, '无法获取上传服务器');
                }
            }, 'json').fail(() => {
                this.uploadFailed(task, '网络错误');
            });
        });
    },

    /**
     * 分片上传
     */
    uploadSlice(task) {
        task.status = 'uploading';
        this.updateUploadRow(task);
        
        // 等待服务器列表加载完成
        this.waitForServers(() => {
            this.doUploadSlice(task);
        });
    },
    
    /**
     * 实际执行分片上传
     */
    doUploadSlice(task) {
        const server = this.upload_server || (this.servers.length > 0 ? this.servers[0].url : null);
        if (!server) {
            this.uploadFailed(task, '无可用服务器');
            return;
        }
        
        const api = server + '/app/upload_slice';
        const token = this.getToken();
        const uptoken = CryptoJS.SHA1(this.getUid() + task.filename + task.file.size + this.slice_size).toString();
        
        // 初始化分片跟踪
        task.slices = {
            total: Math.ceil(task.file.size / this.slice_size),
            uploaded: [],
            current: 0
        };
        
        this.prepareSlice(api, task, uptoken);
    },

    /**
     * 准备分片
     */
    prepareSlice(api, task, uptoken) {
        const token = this.getToken();
        
        $.post(api, {
            token: token,
            uptoken: uptoken,
            action: 'prepare',
            sha1: task.sha1 || 0,
            filename: task.filename,
            filesize: task.file.size,
            slice_size: this.slice_size,
            utoken: task.utoken,
            mr_id: task.mrid,
            model: task.model
        }, (rsp) => {
            switch (rsp.status) {
                case 1: // 上传完成（秒传）
                case 6:
                case 8:
                    task.ukey = rsp.data;
                    this.uploadComplete(task);
                    break;
                    
                case 2: // 等待其他分片
                    task.status = 'merging';
                    this.updateUploadRow(task);
                    setTimeout(() => this.prepareSlice(api, task, uptoken), 5000);
                    break;
                    
                case 3: // 继续上传
                    if (rsp.data && rsp.data.total > 0) {
                        task.slices.total = rsp.data.total;
                        task.slices.current = rsp.data.next;
                        
                        // 计算已上传进度
                        const uploaded = rsp.data.total - rsp.data.wait;
                        task.progress = 30 + Math.floor((uploaded / rsp.data.total) * 70);
                    }
                    this.uploadSliceData(api, task, uptoken, rsp.data);
                    break;
                    
                case 7: // 上传失败
                    this.uploadFailed(task, this.getErrorText(rsp.data));
                    break;
                    
                case 9: // 合并中
                    task.status = 'merging';
                    task.ukey = rsp.data;
                    this.updateUploadRow(task);
                    this.uploadComplete(task);
                    break;
                    
                default:
                    this.uploadFailed(task, `未知错误: ${rsp.status}`);
            }
        }, 'json').fail(() => {
            // 重试
            setTimeout(() => this.prepareSlice(api, task, uptoken), 3000);
        });
    },

    /**
     * 上传分片数据
     */
    uploadSliceData(api, task, uptoken, sliceInfo) {
        const index = sliceInfo.next;
        const blob = task.file.slice(index * this.slice_size, (index + 1) * this.slice_size);
        
        const xhr = new XMLHttpRequest();
        const fd = new FormData();
        
        fd.append('filedata', blob, 'slice');
        fd.append('uptoken', uptoken);
        fd.append('filename', task.filename);
        fd.append('index', index);
        fd.append('action', 'upload_slice');
        fd.append('slice_size', this.slice_size);
        
        // 上传进度
        xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
                const sliceProgress = evt.loaded / evt.total;
                const overallProgress = ((sliceInfo.total - sliceInfo.wait + sliceProgress) / sliceInfo.total);
                task.progress = 30 + Math.floor(overallProgress * 70);
                task.uploaded = (sliceInfo.total - sliceInfo.wait) * this.slice_size + evt.loaded;
                
                // 计算速度
                this.updateSpeed(task.id, evt.loaded);
                
                this.updateUploadRow(task);
            }
        };
        
        // 完成
        xhr.onload = () => {
            const rsp = JSON.parse(xhr.responseText);
            if (rsp.status === 5 || rsp.status === 1) {
                // 继续下一个分片或完成
                this.prepareSlice(api, task, uptoken);
            } else {
                this.prepareSlice(api, task, uptoken);
            }
        };
        
        // 错误
        xhr.onerror = () => {
            setTimeout(() => this.prepareSlice(api, task, uptoken), 3000);
        };
        
        xhr.open('POST', api);
        
        this.recaptchaDo('upload_slice', (captcha) => {
            fd.append('captcha', captcha);
            xhr.send(fd);
        });
    },

    /**
     * 上传完成
     */
    uploadComplete(task) {
        task.status = 'completed';
        task.progress = 100;
        this.updateUploadRow(task);
        
        // 清理
        delete this.uploading[task.id];
        this.active_count--;
        
        // 显示成功提示
        VXUI.toastSuccess(`${task.filename} 上传完成`);
        
        // 通知文件列表进行增量更新
        if (typeof VX_FILELIST !== 'undefined') {
            setTimeout(() => {
                // 移除上传行
                this.removeUploadRow(task.id);
                // 增量更新文件列表（而不是完全刷新）
                VX_FILELIST.onFileUploaded(task.mrid, task.ukey);
            }, 1000);
        }
        
        // 继续处理队列
        this.processQueue();
    },

    /**
     * 上传失败
     */
    uploadFailed(task, error) {
        task.status = 'failed';
        task.error = error;
        this.updateUploadRow(task);
        
        // 清理
        delete this.uploading[task.id];
        this.active_count--;
        
        VXUI.toastError(`${task.filename}: ${error}`);
        
        // 继续处理队列
        this.processQueue();
    },

    /**
     * 取消上传
     */
    cancelUpload(id) {
        const task = this.uploading[id];
        if (task) {
            task.status = 'cancelled';
            delete this.uploading[id];
            this.active_count--;
            this.removeUploadRow(id);
            this.processQueue();
        } else {
            // 从队列中移除
            const index = this.upload_queue.findIndex(t => t.id === id);
            if (index >= 0) {
                this.upload_queue.splice(index, 1);
                this.removeUploadRow(id);
            }
        }
    },

    /**
     * 将上传行置顶，方便观察进度
     */
    pinUploadRow(id) {
        const listBody = document.getElementById('vx-fl-list-body');
        if (!listBody) return;

        const row = document.getElementById(`vx-upload-row-${id}`);
        if (!row) return;

        if (listBody.firstChild === row) return;

        if (typeof listBody.prepend === 'function') {
            listBody.prepend(row);
        } else {
            listBody.insertBefore(row, listBody.firstChild);
        }
    },

    /**
     * 渲染上传行到文件列表
     */
    renderUploadRow(task) {
        const listBody = document.getElementById('vx-fl-list-body');
        if (!listBody) return;
        
        // 检查是否已存在
        if (document.getElementById(`vx-upload-row-${task.id}`)) return;
        
        // 当文件夹为空时，需要显示列表视图以便展示上传队列
        const listContainer = document.getElementById('vx-fl-list');
        const emptyContainer = document.getElementById('vx-fl-empty');
        if (listContainer && listContainer.style.display === 'none') {
            listContainer.style.display = '';
        }
        if (emptyContainer && emptyContainer.style.display !== 'none') {
            emptyContainer.style.display = 'none';
        }
        
        const row = document.createElement('div');
        row.className = 'vx-list-row vx-upload-row';
        row.id = `vx-upload-row-${task.id}`;
        row.dataset.uploadId = task.id;
        
        const iconInfo = this.getFileIcon(task.filename);
        const validityLabel = this.getValidityLabel(task.model);
        
        row.innerHTML = `
            <div class="vx-list-checkbox"></div>
            <div class="vx-list-name">
                <div class="vx-list-icon ${iconInfo.class}">
                    <iconpark-icon name="${iconInfo.icon}"></iconpark-icon>
                </div>
                <div class="vx-list-filename">
                    <span class="vx-upload-filename">${this.escapeHtml(task.filename)}</span>
                    <span class="vx-upload-validity">${validityLabel}</span>
                </div>
            </div>
            <div class="vx-list-size vx-upload-progress-cell">
                <div class="vx-upload-progress-info">
                    <span class="vx-upload-progress-text">准备中...</span>
                    <span class="vx-upload-progress-percent">0%</span>
                </div>
                <div class="vx-upload-progress-wrap">
                    <div class="vx-upload-progress-bar" style="width: 0%"></div>
                </div>
            </div>
            <div class="vx-list-date vx-hide-mobile vx-upload-status">
                <span class="vx-upload-status-text">${this.getStatusText(task.status)}</span>
            </div>
            <div class="vx-list-actions">
                <button class="vx-list-action-btn vx-action-danger" onclick="VX_UPLOADER.cancelUpload(${task.id})" title="取消">
                    <iconpark-icon name="circle-xmark"></iconpark-icon>
                </button>
            </div>
        `;

        // 插入到列表最顶部（高优先级显示上传进度，方便观察）
        if (typeof listBody.prepend === 'function') {
            listBody.prepend(row);
        } else {
            listBody.insertBefore(row, listBody.firstChild);
        }
    },

    /**
     * 更新上传行
     */
    updateUploadRow(task) {
        const row = document.getElementById(`vx-upload-row-${task.id}`);
        if (!row) return;
        
        const progressBar = row.querySelector('.vx-upload-progress-bar');
        const progressText = row.querySelector('.vx-upload-progress-text');
        const progressPercent = row.querySelector('.vx-upload-progress-percent');
        const statusText = row.querySelector('.vx-upload-status-text');
        
        if (progressBar) {
            progressBar.style.width = `${task.progress}%`;
        }

        if (progressPercent) {
            if (task.status === 'completed') {
                progressPercent.innerHTML = '<iconpark-icon name="check" style="font-size: 14px;"></iconpark-icon>';
            } else if (task.status === 'failed') {
                progressPercent.innerHTML = '<iconpark-icon name="xmark" style="font-size: 14px;"></iconpark-icon>';
            } else {
                progressPercent.textContent = `${task.progress}%`;
            }
        }
        
        if (progressText) {
            if (task.status === 'uploading') {
                const uploaded = this.formatSize(task.uploaded || 0);
                const total = this.formatSize(task.file.size);
                const speed = task.speed > 0 ? this.formatSize(task.speed) + '/s' : '';
                progressText.textContent = speed ? `${uploaded} / ${total} · ${speed}` : `${uploaded} / ${total}`;
            } else if (task.status === 'completed') {
                progressText.textContent = `已完成 · ${this.formatSize(task.file.size)}`;
            } else if (task.status === 'failed') {
                progressText.textContent = task.error || '上传失败';
            } else if (task.status === 'merging') {
                progressText.textContent = '正在合并文件...';
            } else {
                progressText.textContent = this.getStatusText(task.status);
            }
        }
        
        if (statusText) {
            statusText.textContent = this.getStatusText(task.status);
        }
        
        // 更新行样式
        row.classList.remove('uploading', 'completed', 'failed', 'preparing', 'merging');
        row.classList.add(task.status);
        
        // 完成后隐藏取消按钮
        const cancelBtn = row.querySelector('.vx-list-action-btn');
        if (cancelBtn && (task.status === 'completed' || task.status === 'failed')) {
            cancelBtn.style.display = 'none';
        }
    },

    /**
     * 移除上传行
     */
    removeUploadRow(id) {
        const row = document.getElementById(`vx-upload-row-${id}`);
        if (row) {
            row.classList.add('vx-upload-row-removing');
            setTimeout(() => {
                row.remove();
                // 检查列表是否为空（没有文件/文件夹行且没有其他上传行）
                this.checkAndRestoreEmptyState();
            }, 300);
        }
    },

    /**
     * 检查并恢复空状态（如果列表为空）
     */
    checkAndRestoreEmptyState() {
        const listBody = document.getElementById('vx-fl-list-body');
        if (!listBody) return;
        
        // 检查是否还有内容（文件/文件夹行或上传行）
        const hasContent = listBody.querySelector('.vx-list-row');
        if (hasContent) return;
        
        // 没有内容时，显示空状态
        const listContainer = document.getElementById('vx-fl-list');
        const emptyContainer = document.getElementById('vx-fl-empty');
        if (listContainer) listContainer.style.display = 'none';
        if (emptyContainer) emptyContainer.style.display = 'flex';
    },

    /**
     * 更新速度
     */
    updateSpeed(id, bytes) {
        const now = Date.now();
        if (!this.speed_data[id]) {
            this.speed_data[id] = { bytes: 0, time: now };
        }
        
        this.speed_data[id].bytes += bytes;
        this.total_uploaded += bytes;
        
        const elapsed = (now - this.speed_data[id].time) / 1000;
        if (elapsed >= 1) {
            const task = this.uploading[id];
            if (task) {
                task.speed = Math.floor(this.speed_data[id].bytes / elapsed);
            }
            this.speed_data[id] = { bytes: 0, time: now };
        }
    },

    // ==================== 工具方法 ====================

    getToken() {
        if (typeof TL !== 'undefined' && TL.api_token) {
            return TL.api_token;
        }
        return localStorage.getItem('app_token') || null;
    },

    getUid() {
        if (typeof TL !== 'undefined' && TL.uid) {
            return TL.uid;
        }
        return '';
    },

    getUploadApi() {
        if (typeof TL !== 'undefined' && TL.api_url_upload) {
            return TL.api_url_upload;
        }
        return '/api_v2/upload';
    },

    recaptchaDo(action, callback) {
        if (typeof TL !== 'undefined' && typeof TL.recaptcha_do === 'function') {
            TL.recaptcha_do(action, callback);
        } else {
            callback('');
        }
    },

    normalizeModel(model) {
        if (model === 3) return 2;
        const valid = [0, 1, 2, 99];
        return valid.includes(model) ? model : 0;
    },

    getValidityLabel(model) {
        const labels = {
            0: '24小时',
            1: '3天',
            2: '7天',
            99: '永久'
        };
        return labels[model] || labels[0];
    },

    getStatusText(status) {
        const texts = {
            pending: '等待中',
            preparing: '准备中',
            uploading: '上传中',
            merging: '合并中',
            completed: '已完成',
            failed: '失败',
            cancelled: '已取消'
        };
        return texts[status] || status;
    },

    getErrorText(code) {
        const errors = {
            2: '无效请求',
            3: '不能上传空文件',
            4: '文件超出大小限制',
            5: '超出每日上传限制',
            6: '没有上传权限',
            7: '私有空间不足',
            8: '无法分配存储空间',
            9: '无法获取节点信息',
            10: '文件名包含非法字符'
        };
        return errors[code] || `未知错误 (${code})`;
    },

    getFileIcon(filename) {
        const ext = (filename || '').split('.').pop().toLowerCase();
        
        if (typeof TL !== 'undefined' && typeof TL.fileicon === 'function') {
            const icon = TL.fileicon(ext);
            if (icon) {
                return { icon: icon, class: 'vx-icon-file' };
            }
        }
        
        const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
        const videoTypes = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'];
        const audioTypes = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
        
        if (imageTypes.includes(ext)) return { icon: 'file-image', class: 'vx-icon-image' };
        if (videoTypes.includes(ext)) return { icon: 'file-video', class: 'vx-icon-video' };
        if (audioTypes.includes(ext)) return { icon: 'file-music', class: 'vx-icon-audio' };
        
        return { icon: 'file-lines', class: 'vx-icon-file' };
    },

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    getLang(key) {
        if (typeof app !== 'undefined' && app.languageData && app.languageData[key]) {
            return app.languageData[key];
        }
        return null;
    },

    // ==================== CLI Upload Functions ====================

    /**
     * 打开 CLI 上传模态框
     */
    openCliModal() {
        this.trackUI('vui_cli_modal_open');
        
        const modal = document.getElementById('vx-cli-modal');
        if (!modal) {
            console.error('[VX_UPLOADER] CLI modal not found');
            return;
        }
        
        // 显示 Token
        this.updateCliToken();
        
        // 显示模态框
        modal.classList.add('vx-modal-open');
        document.body.classList.add('vx-modal-body-open');
    },

    /**
     * 关闭 CLI 上传模态框
     */
    closeCliModal() {
        const modal = document.getElementById('vx-cli-modal');
        if (modal) {
            modal.classList.remove('vx-modal-open');
            document.body.classList.remove('vx-modal-body-open');
        }
    },

    /**
     * 更新 CLI Token 显示
     */
    updateCliToken() {
        const tokenEl = document.getElementById('vx-cli-token');
        if (!tokenEl) return;
        
        // 获取 Token
        let token = '';
        if (typeof TL !== 'undefined' && TL.api_token) {
            token = TL.api_token;
        }
        
        if (token) {
            tokenEl.textContent = token;
        } else {
            tokenEl.textContent = this.getLang('status_need_login') || '请先登录';
        }
    },

    /**
     * 复制 CLI Token
     */
    async copyCliToken() {
        const tokenEl = document.getElementById('vx-cli-token');
        const copyBtn = document.getElementById('vx-cli-copy-btn');
        
        if (!tokenEl) return;
        
        const token = tokenEl.textContent;
        
        // 检查是否已登录
        if (typeof TL !== 'undefined' && TL.logined === 0) {
            if (typeof TL.alert === 'function') {
                TL.alert(this.getLang('status_need_login') || '请先登录');
            }
            return;
        }
        
        try {
            // 复制到剪贴板
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(token);
            } else {
                // 降级方案
                const textarea = document.createElement('textarea');
                textarea.value = token;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            
            // 更新按钮状态
            if (copyBtn) {
                copyBtn.classList.add('copied');
                const originalHtml = copyBtn.innerHTML;
                copyBtn.innerHTML = `<iconpark-icon name="circle-check"></iconpark-icon><span>${this.getLang('copy_ok') || '已复制'}</span>`;
                
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtn.innerHTML = originalHtml;
                }, 2000);
            }
            
            this.trackUI('vui_cli_token_copied');
        } catch (err) {
            console.error('[VX_UPLOADER] Failed to copy token:', err);
            if (typeof TL !== 'undefined' && typeof TL.alert === 'function') {
                TL.alert(this.getLang('copy_fail') || '复制失败，请手动复制');
            }
        }
    }
};

// 初始化
if (typeof VXUI !== 'undefined') {
    // 延迟初始化,等待TL加载完成
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => VX_UPLOADER.init(), 1000);
    });
}
