class download {
    // 分块下载常量设置
    CHUNK_SIZE = 8 * 1024 * 1024; // 默认块大小为8MB
    SMALL_FILE_THRESHOLD = this.CHUNK_SIZE * 3; // 小于3个块大小时使用直接下载
    MAX_CHUNK_RETRY = 3; // 单个块下载最大重试次数
    MAX_CONCURRENT_DOWNLOADS = 3; // 最大并行下载数
    
    parent_op = null
    download_queue = []
    download_queue_processing = false
    download_retry = 0
    download_retry_max = 10

    // 多线程下载相关属性
    chunks = []
    downloadSpeed = 0
    lastSpeedUpdate = 0
    downloadedBytes = 0
    threads = []
    chunkSize = 0
    totalSize = 0
    multiThreadActive = false
    lastTotalBytes = 0;
    numberOfChunks = 3;
    fastDownloadInProgress = false;

    init(parent_op) {
        this.parent_op = parent_op;
        this.resetMultiThreadStatus();
    }

    // Best-effort check for HTTP Range support without downloading the full file.
    // Returns true if the server responds with 206 for a 1-byte range request.
    async probeRangeSupport(url) {
        return new Promise((resolve) => {
            let resolved = false;
            const finish = (value) => {
                if (resolved) return;
                resolved = true;
                resolve(value);
            };

            try {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.responseType = 'arraybuffer';
                xhr.timeout = 5000;
                xhr.setRequestHeader('Range', 'bytes=0-0');

                xhr.onreadystatechange = () => {
                    // HEADERS_RECEIVED: status + headers are available; abort ASAP.
                    if (xhr.readyState === 2) {
                        const ok = xhr.status === 206;
                        try { xhr.abort(); } catch (e) { /* ignore */ }
                        finish(ok);
                    }
                };
                xhr.onerror = () => finish(false);
                xhr.ontimeout = () => finish(false);
                xhr.onabort = () => {
                    // If aborted before HEADERS_RECEIVED, treat as unsupported.
                    if (!resolved) finish(false);
                };

                xhr.send();
            } catch (e) {
                finish(false);
            }
        });
    }

    //
    resetMultiThreadStatus() {
        this.chunks = [];
        this.downloadSpeed = 0;
        this.lastSpeedUpdate = Date.now();
        this.downloadedBytes = 0;
        this.threads = [];
        this.chunkSize = 0;
        this.totalSize = 0;
        this.multiThreadActive = false;
    }

    // 启动单个文件下载
    single_start(url, filename) {
        var xhr = new XMLHttpRequest();
        xhr.addEventListener("progress", (evt) => {
            this.single_progress_on(evt, filename);
        }, false);
        xhr.addEventListener("error", (evt) => {
            if (this.download_retry < this.download_retry_max) {
                this.download_retry++;
                setTimeout(() => {
                    this.single_start(url, filename);
                }, 3000);
            } else {
                this.parent_op.alert(app.languageData.download_error_retry);
                this.single_reset();
                this.download_retry = 0;
            }
        }, false);
        xhr.addEventListener("timeout", (evt) => {
            if (this.download_retry < this.download_retry_max) {
                this.download_retry++;
                setTimeout(() => {
                    this.single_start(url, filename);
                }, 3000);
            } else {
                this.parent_op.alert(app.languageData.download_error_retry);
                this.single_reset();
                this.download_retry = 0;
            }
        }, false);
        xhr.addEventListener("abort", (evt) => {
            this.parent_op.alert(app.languageData.download_error_abort);
            this.single_reset();
        }, false);
        xhr.open("GET", url);
        xhr.onload = () => {
            this.single_complete(xhr, filename);
        };
        xhr.responseType = 'blob';
        xhr.send();
        $('.single_download_msg').html(app.languageData.download_preparing);
        $('.single_download_progress_bar').show();
        $('#btn_quick_download').attr('disabled', true);
    }

    // 单个文件下载完成处理
    single_complete(evt, filename) {
        this.download_retry = 0;
        let blob = new Blob([evt.response], {
            type: evt.response.type
        });
        if (window.navigator.msSaveOrOpenBlob) {
            navigator.msSaveBlob(blob, filename);
        } else {
            let link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = filename;
            link.click();
            window.URL.revokeObjectURL(link.href);
        }
        $('.single_download_msg').html(app.languageData.download_complete);
        $('.single_download_progress_bar_set').removeClass('progress-bar-animated');
        $('.single_download_progress_bar_set').removeClass('progress-bar-striped');
        this.single_reset();
        this.queue_run();
    }

    // 单个文件下载进度更新
    single_progress_on(evt) {
        $('.single_download_msg').html(app.languageData.download_progress + ' ' + bytetoconver(evt.loaded, true));
        $('.single_download_progress_bar_set').css('width', (evt.loaded / evt.total) * 100 + '%');
        $('.single_download_progress_bar_set').addClass('progress-bar-animated');
        $('.single_download_progress_bar_set').addClass('progress-bar-striped');
    }

    // 重置单个文件下载状态
    single_reset() {
        $('#btn_quick_download').removeAttr('disabled');
    }

    // 获取下载地址
    async get_download_url(ukey) {
        try {
            const recaptcha = await this.parent_op.recaptcha_do_async('download_req');
            const response = await $.post(this.parent_op.api_file, {
                action: 'download_req',
                ukey: ukey,
                token: this.parent_op.api_token,
                captcha: recaptcha
            });

            if (response.status === 1) {
                return response.data;
            } else if (response.status === 3) {
                throw new Error(app.languageData.status_need_login);
            } else {
                throw new Error(app.languageData.status_error_0);
            }
        } catch (error) {
            throw error;
        }
    }

    // 文件夹下载处理
    async folder_download(select_data) {
        try {
            // 准备文件列表并显示下载管理器
            $('#multipleDownloadModel').modal('show');
            $('#multiple_download_prepare').show();
            $('#multiple_download_processing').hide();

            // 初始化UI
            this.init_folder_download_progress();

            // 获取文件列表
            const file_list = await this.folder_download_prepare(select_data);

            // 检查是否包含文件夹结构
            const hasFolder = file_list.some(file => file.path.includes('/'));

            // 计算总文件大小
            const totalSize = file_list.reduce((acc, file) => acc + parseInt(file.size), 0);
            let downloadedBytes = 0;

            this.append_download_info(`${app.languageData.multi_download_start} ${file_list.length} ${app.languageData.multi_download_files}, ${app.languageData.multi_download_count} ${bytetoconver(totalSize, true)}`);

            $('#multiple_download_prepare').hide();
            $('#multiple_download_processing').show();

            // 如果包含文件夹结构，尝试使用 File System Access API
            if (hasFolder) {
                try {
                    const dirHandle = await window.showDirectoryPicker();
                    const hasPermission = await this.verifyDirectoryPermissions(dirHandle);

                    if (hasPermission) {
                        this.append_download_info(app.languageData.multi_download_start);

                        // 使用现代API下载文件夹结构
                        for (let i = 0; i < file_list.length; i++) {
                            const file = file_list[i];
                            try {
                                const downloadUrl = await this.get_download_url(file.ukey);
                                const dirPath = file.path.split('/').slice(0, -1).join('/');
                                const fileName = file.path.split('/').pop();
                                const targetDirHandle = dirPath ?
                                    await this.ensureDirectoryExists(dirHandle, dirPath) :
                                    dirHandle;

                                await this.download_and_save_file(
                                    downloadUrl,
                                    targetDirHandle,
                                    fileName,
                                    file.path,
                                    (receivedBytes) => {
                                        const previousFilesBytes = file_list
                                            .slice(0, i)
                                            .reduce((acc, f) => acc + parseInt(f.size), 0);
                                        const totalProgress = ((previousFilesBytes + receivedBytes) / totalSize) * 100;
                                        $('#multiple_download_process-bar')
                                            .css('width', `${totalProgress}%`)
                                            .attr('aria-valuenow', totalProgress);
                                    }
                                );
                                downloadedBytes += parseInt(file.size);
                            } catch (error) {
                                console.error(`Error downloading file ${file.path}:`, error);
                                this.append_download_info(`${app.languageData.multi_download_error}: ${file.path} (${error.message})`);
                            }
                        }

                        const progressBar = $('#multiple_download_process-bar');
                        progressBar.css('width', '100%')
                            .removeClass('progress-bar-animated progress-bar-striped')
                            .addClass('bg-success')
                            .attr('aria-valuenow', 100);

                        this.append_download_info(app.languageData.multi_download_complete);
                        return;
                    }
                } catch (error) {
                    console.log("File System Access API not supported or permission denied, falling back to legacy download");
                    this.append_download_info(app.languageData.multi_download_legacy);
                }
            }

            // 使用传统下载方式（无文件夹或现代API不可用时）
            for (let i = 0; i < file_list.length; i++) {
                const file = file_list[i];
                try {
                    const downloadUrl = await this.get_download_url(file.ukey);

                    // 转换文件夹路径为文件名（如果有文件夹）
                    const parts = file.path.split('/');
                    const fileName = parts.pop();
                    const folderPath = parts.length > 0 ? `[${parts.join('][')}]` : '';
                    const convertedFilename = folderPath + fileName;

                    await this.legacyDownloadFile(
                        downloadUrl,
                        convertedFilename,
                        file.path,
                        (receivedBytes) => {
                            const previousFilesBytes = file_list
                                .slice(0, i)
                                .reduce((acc, f) => acc + parseInt(f.size), 0);
                            const totalProgress = ((previousFilesBytes + receivedBytes) / totalSize) * 100;
                            $('#multiple_download_process-bar')
                                .css('width', `${totalProgress}%`)
                                .attr('aria-valuenow', totalProgress);
                        }
                    );

                    downloadedBytes += parseInt(file.size);
                } catch (error) {
                    this.append_download_info(`${app.languageData.multi_download_error}: ${file.path} (${error.message})`);
                }
            }

            const progressBar = $('#multiple_download_process-bar');
            progressBar.css('width', '100%')
                .removeClass('progress-bar-animated progress-bar-striped')
                .addClass('bg-success')
                .attr('aria-valuenow', 100);

            this.append_download_info(app.languageData.multi_download_complete);

        } catch (error) {
            this.append_download_info(`${app.languageData.multi_download_error}: ${error.message}`);
            this.parent_op.alert(app.languageData.download_error_abort);
        }
    }

    async legacyDownloadFile(url, fileName, originalPath, onProgress) {
        const msgElement = this.appendProgressLine();

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const contentLength = parseInt(response.headers.get('content-length') || '0');
            const reader = response.body.getReader();
            const chunks = [];
            let receivedLength = 0;

            this.updateProgressText(
                msgElement,
                `${app.languageData.multi_download_start}: ${originalPath} (0/${bytetoconver(contentLength, true)}) ...`
            );

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                receivedLength += value.length;

                if (onProgress) {
                    onProgress(receivedLength);
                }

                if (contentLength && msgElement) {
                    this.updateProgressText(
                        msgElement,
                        `${app.languageData.multi_download_start}: ${originalPath} (${bytetoconver(receivedLength, true)}/${bytetoconver(contentLength, true)}) ...`
                    );
                }
            }

            const blob = new Blob(chunks);
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = fileName;
            link.click();
            window.URL.revokeObjectURL(link.href);

            this.updateProgressText(
                msgElement,
                `${app.languageData.multi_download_finish}: ${originalPath} (${bytetoconver(receivedLength, true)})`,
                'text-success'
            );

        } catch (error) {
            this.updateProgressText(
                msgElement,
                `${app.languageData.multi_download_error}:${originalPath} (${error.message})`,
                'text-danger'
            );
            throw error;
        }
    }

    // 下载并保存单个文件
    async download_and_save_file(url, dirHandle, fileName, fullPath, onProgress) {
        let msgElement = null;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const contentLength = parseInt(response.headers.get('content-length') || '0');
            const reader = response.body.getReader();
            const chunks = [];
            let receivedLength = 0;

            msgElement = this.appendProgressLine();
            this.updateProgressText(
                msgElement,
                `${app.languageData.multi_download_start}: ${fullPath} (0/${bytetoconver(contentLength, true)}) ...`
            );

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                receivedLength += value.length;

                if (onProgress) {
                    onProgress(receivedLength);
                }

                if (contentLength && msgElement) {
                    this.updateProgressText(
                        msgElement,
                        `${app.languageData.multi_download_start}: ${fullPath} (${bytetoconver(receivedLength, true)}/${bytetoconver(contentLength, true)}) ...`
                    );
                }
            }

            try {
                const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(new Blob(chunks));
                await writable.close();

                if (msgElement) {
                    this.updateProgressText(
                        msgElement,
                        `${app.languageData.multi_download_finish}: ${fullPath} (${bytetoconver(receivedLength, true)})`,
                        'text-success'
                    );
                }
            } catch (fileError) {
                throw new Error(`${app.languageData.file_write_error || '文件写入失败'}: ${fileError.message}`);
            }

        } catch (error) {
            if (msgElement) {
                this.updateProgressText(
                    msgElement,
                    `${app.languageData.multi_download_error}:${fullPath} (${error.message})`,
                    'text-danger'
                );
            }
            throw error;
        }
    }

    // 验证目录权限
    async verifyDirectoryPermissions(dirHandle) {
        try {
            const options = { mode: 'readwrite' };

            // 先检查是否已有权限
            const verifyPermission = await dirHandle.queryPermission(options);

            if (verifyPermission === 'granted') {
                return true;
            }

            // 如果没有权限，请求权限
            const permission = await dirHandle.requestPermission(options);
            return permission === 'granted';

        } catch (error) {
            console.error('Permission verification failed:', error);
            return false;
        }
    }

    // 创建目录结构
    async ensureDirectoryExists(rootDirHandle, dirPath) {
        const parts = dirPath.split('/');

        let currentHandle = rootDirHandle;

        for (const part of parts) {
            if (part) {
                try {
                    currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
                } catch (error) {
                    console.error(`Error creating directory ${part}:`, error);
                    throw new Error(`${app.languageData.folder_create_error || '创建文件夹失败'}: ${error.message}`);
                }
            }
        }

        return currentHandle;
    }

    // 处理选中的文件信息
    async folder_download_prepare(select_data) {
        let file_list = [];
        for (let x in select_data) {
            if (select_data[x].type === 'dir') {
                try {
                    let response = await $.post(this.parent_op.api_mr, {
                        action: 'get_all_file',
                        token: this.parent_op.api_token,
                        mr_id: select_data[x].id
                    });

                    if (response.status === 1) {
                        file_list.push(...response.data);
                    } else {
                        console.error('API returned error status:', response);
                    }
                } catch (error) {
                    console.error('jQuery post error:', error);
                }
            } else {
                this.parent_op.dir.file_list.forEach((item) => {
                    if (item.ukey === select_data[x].id) {
                        file_list.push({
                            ukey: item.ukey,
                            size: item.filesize,
                            path: item.fname
                        });
                    }
                });
            }
        }
        return file_list;
    }

    // 添加进度行并返回元素引用
    appendProgressLine() {
        const infoArea = $('#multiple_download_info');
        const msgDiv = $('<div class="download-message mb-1"></div>');
        infoArea.prepend(msgDiv);
        infoArea.scrollTop(0);
        return msgDiv;
    }

    // 更新进度文本
    updateProgressText(element, message, className = '') {
        if (!element) return;
        const timestamp = new Date().toLocaleTimeString();
        element.attr('class', 'download-message mb-1 ' + className)
            .html(`[${timestamp}] ${message}`);
    }

    // 初始化下载进度UI
    init_folder_download_progress() {
        const progressBar = $('#multiple_download_process-bar');
        progressBar.css('width', '0%')
            .removeClass('bg-success')
            .addClass('progress-bar-striped progress-bar-animated')
            .attr('aria-valuenow', 0);

        $('#multiple_download_info').empty();
    }

    // 添加普通信息
    append_download_info(message) {
        const timestamp = new Date().toLocaleTimeString();
        const msgElement = this.appendProgressLine();
        this.updateProgressText(msgElement, message);
    }

    // 新增文件下载处理方法
    async handleFileDownload(params, uiCallbacks) {
        const {
            updateButtonText,
            updateButtonState,
            updateButtonClass,
            showError
        } = uiCallbacks;

        let downloadBtnText = app.languageData.file_btn_download;

        try {
            updateButtonClass('btn-success', 'btn-azure');
            const loadingText = app.languageData.download_preparing || app.languageData.download_loading || '...';
            updateButtonText(loadingText);
            updateButtonState(true);

            const downloadUrl = await this.getDownloadUrl(params.ukey);

            if (downloadUrl) {
                if (params.mode === 'fast') {
                    downloadBtnText = app.languageData.file_btn_download_fast;
                    try {
                        // 获取文件大小以决定使用哪种下载方式
                        const headResponse = await fetch(downloadUrl, { method: 'HEAD' });
                        if (!headResponse.ok) {
                            // 无法获取文件信息：回退普通下载
                            window.location.href = downloadUrl;
                        } else {
                            const fileSize = parseInt(headResponse.headers.get('content-length'));

                            // 无法可靠获取文件大小：回退普通下载
                            if (!Number.isFinite(fileSize) || fileSize <= 0) {
                                window.location.href = downloadUrl;
                            } else if (fileSize < this.SMALL_FILE_THRESHOLD) {
                                // 小文件使用浏览器直接下载
                                console.log(`Small file detected (${this.formatBytes(fileSize)}), using direct download`);
                                window.location.href = downloadUrl;
                            } else {
                                // 大文件：尝试分块下载（内部会再次确认 Range 支持，不支持则回退）
                                await this.startMultiThreadDownload(downloadUrl, params.filename);
                            }
                        }
                    } catch (error) {
                        console.error('Fast download failed, falling back to normal download:', error);
                        // 回退普通下载，避免误报“网络不稳定”
                        window.location.href = downloadUrl;
                        // 还原按钮状态
                        updateButtonClass('btn-azure', 'btn-success');
                        updateButtonText(downloadBtnText);
                        updateButtonState(false);
                        return true;
                    }
                } else {
                    // 普通下载模式
                    window.location.href = downloadUrl;
                }

                setTimeout(() => {
                    updateButtonClass('btn-azure', 'btn-success');
                    updateButtonText(downloadBtnText);
                    updateButtonState(false);
                }, 3000);

                return true;
            }
        } catch (error) {
            showError(app.languageData.status_file_2 || '下载请求失败');
            // 还原按钮状态
            updateButtonClass('btn-azure', 'btn-success');
            updateButtonText(downloadBtnText);
            updateButtonState(false);
            return false;
        }
    }

    // 新增多线程下载相关方法
    async startMultiThreadDownload(url, filename) {
        try {
            // Prevent accidental re-entry (e.g. double click / duplicate handlers)
            if (this.fastDownloadInProgress) {
                return false;
            }
            this.fastDownloadInProgress = true;

            const headResponse = await fetch(url, { method: 'HEAD' });
            if (!headResponse.ok) {
                // 无法获取文件信息：回退普通下载
                window.location.href = url;
                return true;
            }
    
            this.totalSize = parseInt(headResponse.headers.get('content-length'));
            if (!Number.isFinite(this.totalSize) || this.totalSize <= 0) {
                // 无法可靠获取大小：回退普通下载
                window.location.href = url;
                return true;
            }
    
            // 小文件使用浏览器直接下载
            if (this.totalSize < this.SMALL_FILE_THRESHOLD) {
                console.log(`Small file detected (${this.formatBytes(this.totalSize)}), using direct download`);
                window.location.href = url;
                return true;
            }

            // 检查服务器是否支持 Range（分块下载依赖 206 Partial Content）
            const acceptRanges = (headResponse.headers.get('accept-ranges') || '').toLowerCase();
            if (acceptRanges && acceptRanges !== 'bytes') {
                window.location.href = url;
                return true;
            }
            // 如果头信息未明确声明，做一次 1-byte 探测请求
            if (!acceptRanges) {
                const rangeOk = await this.probeRangeSupport(url);
                if (!rangeOk) {
                    window.location.href = url;
                    return true;
                }
            }
    
            // 使用固定块大小计算需要的块数
            this.chunkSize = this.CHUNK_SIZE; // 使用固定的32MB块大小
            const numberOfChunks = Math.ceil(this.totalSize / this.chunkSize);
            
            // 初始化多线程下载，最多显示3个进度条
            this.initMultiThreadDownload(numberOfChunks);
    
            // 进度条初始化与可见性
            const $progressContainer = $('#download_progress_container');
            const $fastButton = $('#file_download_btn_fast');

            if ($fastButton.length) {
                $fastButton.addClass('download-btn-progress-active').attr('aria-busy', 'true');
            }
            
            // 显示进度容器
            if ($progressContainer.length) {
                $progressContainer.addClass('is-active').show();
            }
            
            // 重置进度条
            $('#progress_thread_1').css('width', '0%').removeClass('bg-warning');
    
            // 创建下载任务数组，包含每个块的详细信息
            const downloadTasks = Array.from({ length: numberOfChunks }, (_, i) => {
                const start = i * this.chunkSize;
                const end = i === numberOfChunks - 1 ? 
                    this.totalSize - 1 : 
                    Math.min(start + this.chunkSize - 1, this.totalSize - 1);
                const expectedSize = end - start + 1;
                
                return {
                    index: i,
                    start,
                    end,
                    expectedSize
                };
            });
    
            // 启动速度计算
            this.startSpeedCalculator();
    
            // 创建结果数组，用于存储下载的块
            const chunks = new Array(numberOfChunks);
            
            // 创建下载队列
            const queue = [...downloadTasks];
            const activeDownloads = [];
            
            // 处理队列，确保同时只有指定数量的下载任务
            while (queue.length > 0 || activeDownloads.length > 0) {
                // 填充活跃下载任务，直到达到最大并行数或队列为空
                while (activeDownloads.length < this.MAX_CONCURRENT_DOWNLOADS && queue.length > 0) {
                    const task = queue.shift();
                    const downloadPromise = this.downloadChunk(url, task.index, task.start, task.end, task.expectedSize)
                        .then(chunk => {
                            // 保存下载完成的块
                            chunks[task.index] = chunk;
                            // 从活跃下载列表中移除
                            const index = activeDownloads.indexOf(downloadPromise);
                            if (index !== -1) {
                                activeDownloads.splice(index, 1);
                            }
                            return chunk;
                        });
                    
                    activeDownloads.push(downloadPromise);
                }
                
                // 如果活跃下载任务达到最大数量，等待其中一个完成
                if (activeDownloads.length > 0) {
                    await Promise.race(activeDownloads);
                }
            }
    
            // 验证所有块的完整性
            let totalBytesReceived = 0;
            chunks.forEach((chunk, index) => {
                const task = downloadTasks[index];
                if (chunk.byteLength !== task.expectedSize) {
                    throw new Error(`Chunk ${index} size mismatch: expected ${task.expectedSize}, got ${chunk.byteLength}`);
                }
                totalBytesReceived += chunk.byteLength;
            });
    
            // 验证总大小
            if (totalBytesReceived !== this.totalSize) {
                throw new Error(`Total size mismatch: expected ${this.totalSize}, got ${totalBytesReceived}`);
            }
    
            // 按正确顺序合并块
            const blob = new Blob(chunks, { type: headResponse.headers.get('content-type') || 'application/octet-stream' });
            
            // 触发下载
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
    
            this.cleanupMultiThreadDownload();
            return true;
        } catch (error) {
            console.error('Multi-thread download failed:', error);
            this.cleanupMultiThreadDownload();

            // 分块下载失败（含 Range 不支持/大小不一致等）：回退普通下载，避免误报“网络不稳定”
            try {
                window.location.href = url;
                return true;
            } catch (e) {
                // 如果回退也异常，则仍抛出让上层处理
                throw error;
            }
        } finally {
            this.fastDownloadInProgress = false;
        }
    }
    

    // 获取下载链接的方法
    async getDownloadUrl(ukey) {
        try {
            const recaptcha = await this.parent_op.recaptcha_do_async('download_req');
            const response = await $.post(this.parent_op.api_file, {
                action: 'download_req',
                ukey: ukey,
                token: this.parent_op.api_token,
                captcha: recaptcha
            });

            if (response.status === 1) {
                return response.data;
            }
            throw new Error('Download request failed');
        } catch (error) {
            throw error;
        }
    }

    initMultiThreadDownload(numChunks = 3) {           // <— allow dynamic chunk count
        this.numberOfChunks = numChunks;
        this.chunks = [];
        this.downloadSpeed = 0;
        this.lastSpeedUpdate = Date.now();
        this.downloadedBytes = 0;
        this.threads = new Array(numChunks).fill(null).map(() => ({ loaded: 0 }));
        this.multiThreadActive = true;
    }

    downloadChunk(url, index, start, end, expectedSize, retryCount = 0) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            this.threads[index] = xhr;
            this.threads[index].loaded = 0;
            
            xhr.open('GET', url);
            xhr.responseType = 'arraybuffer';
            xhr.setRequestHeader('Range', `bytes=${start}-${end}`);
            
            xhr.onprogress = (event) => {
                if (this.multiThreadActive) {
                    this.updateChunkProgress(index, event.loaded, end - start + 1);
                }
            };
            
            xhr.onload = () => {
                if (xhr.status === 206) {
                    const chunk = xhr.response;
                    if (chunk.byteLength !== expectedSize) {
                        // 块大小不匹配，尝试重试
                        if (retryCount < this.MAX_CHUNK_RETRY) {
                            console.warn(`Chunk ${index} size mismatch, retrying (${retryCount+1}/${this.MAX_CHUNK_RETRY})...`);
                            // 更新UI显示重试信息
                            this.setChunkWarningStatus(index, true);
                            setTimeout(() => {
                                this.downloadChunk(url, index, start, end, expectedSize, retryCount + 1)
                                    .then(resolve)
                                    .catch(reject);
                            }, 1000); // 延迟1秒重试
                        } else {
                            reject(new Error(`Chunk ${index} size mismatch after ${this.MAX_CHUNK_RETRY} retries: expected ${expectedSize}, got ${chunk.byteLength}`));
                        }
                        return;
                    }
                    // 下载成功，恢复正常UI
                    this.setChunkWarningStatus(index, false);
                    resolve(chunk);
                } else {
                    // HTTP错误，尝试重试
                    if (retryCount < this.MAX_CHUNK_RETRY) {
                        console.warn(`Chunk ${index} failed with status ${xhr.status}, retrying (${retryCount+1}/${this.MAX_CHUNK_RETRY})...`);
                        // 更新UI显示重试信息
                        this.setChunkWarningStatus(index, true);
                        setTimeout(() => {
                            this.downloadChunk(url, index, start, end, expectedSize, retryCount + 1)
                                .then(resolve)
                                .catch(reject);
                        }, 1000); // 延迟1秒重试
                    } else {
                        reject(new Error(`Chunk ${index} download failed with status ${xhr.status} after ${this.MAX_CHUNK_RETRY} retries`));
                    }
                }
            };
            
            xhr.onerror = () => {
                // 网络错误，尝试重试
                if (retryCount < this.MAX_CHUNK_RETRY) {
                    console.warn(`Chunk ${index} network error, retrying (${retryCount+1}/${this.MAX_CHUNK_RETRY})...`);
                    // 更新UI显示重试信息
                    this.setChunkWarningStatus(index, true);
                    setTimeout(() => {
                        this.downloadChunk(url, index, start, end, expectedSize, retryCount + 1)
                            .then(resolve)
                            .catch(reject);
                    }, 1000); // 延迟1秒重试
                } else {
                    reject(new Error(`Chunk ${index} download failed after ${this.MAX_CHUNK_RETRY} retries due to network errors`));
                }
            };
            
            xhr.ontimeout = () => {
                // 超时错误，尝试重试
                if (retryCount < this.MAX_CHUNK_RETRY) {
                    console.warn(`Chunk ${index} timeout, retrying (${retryCount+1}/${this.MAX_CHUNK_RETRY})...`);
                    // 更新UI显示重试信息
                    this.setChunkWarningStatus(index, true);
                    setTimeout(() => {
                        this.downloadChunk(url, index, start, end, expectedSize, retryCount + 1)
                            .then(resolve)
                            .catch(reject);
                    }, 1000); // 延迟1秒重试
                } else {
                    reject(new Error(`Chunk ${index} download timed out after ${this.MAX_CHUNK_RETRY} retries`));
                }
            };
            
            xhr.send();
        });
    }

    updateChunkProgress(index, loaded, total) {
        // 更新当前线程的已下载量
        this.threads[index].loaded = loaded;

        // 计算新的总下载量
        this.downloadedBytes = this.threads.map(thread =>
            thread ? thread.loaded || 0 : 0
        ).reduce((a, b) => a + b, 0);

        // 计算总体下载进度百分比
        const totalProgress = (this.downloadedBytes / this.totalSize) * 100;
        
        // 更新单一进度条
        $('#progress_thread_1').css('width', `${totalProgress}%`);

        const $progressContainer = $('#download_progress_container');
        if ($progressContainer.length && !$progressContainer.hasClass('is-active')) {
            $progressContainer.addClass('is-active');
            // 隐藏按钮文字，避免与进度信息重叠
            $('#file_download_btn_fast .download-btn-label').addClass('is-hidden');
        }
        
        // 如果当前块有错误，设置进度条为警告状态
        if (this.threads[index].hasWarning) {
            $('#progress_thread_1').addClass('bg-warning');
        } else {
            // 检查是否所有块都没有警告状态
            const hasAnyWarning = this.threads.some(thread => thread && thread.hasWarning);
            if (!hasAnyWarning) {
                $('#progress_thread_1').removeClass('bg-warning');
            }
        }

        // 更新总进度显示
        $('#download_progress').text(
            `${this.formatBytes(this.downloadedBytes)} / ${this.formatBytes(this.totalSize)}`
        );
    }

    startSpeedCalculator() {
        this.lastSpeedUpdate = Date.now();
        this.lastTotalBytes = 0;

        const speedInterval = setInterval(() => {
            if (!this.multiThreadActive) {
                clearInterval(speedInterval);
                return;
            }

            const now = Date.now();
            const timeDiff = (now - this.lastSpeedUpdate) / 1000;

            // 计算这个时间段的速度
            const bytesIncrement = this.downloadedBytes - this.lastTotalBytes;
            const currentSpeed = bytesIncrement / timeDiff;

            // 更新显示
            $('#download_speed').text(`${this.formatBytes(currentSpeed)}/s`);

            // 更新基准值
            this.lastSpeedUpdate = now;
            this.lastTotalBytes = this.downloadedBytes;
        }, 1000);
    }

    checkDownloadCompletion(filename) {
        if (!this.chunks.every(chunk => chunk)) return;

        // 合并所有块并触发下载
        const blob = new Blob(this.chunks);
        const downloadUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        // 更新下载按钮状态
        $('#file_download_btn_fast')
            .removeClass('btn-azure')
            .addClass('btn-success')
            .prop('disabled', false);

        // Only update the label text; do not destroy progress DOM
        const $label = $('#file_download_btn_fast').find('.download-btn-label');
        if ($label.length) {
            $label.html(app.languageData.file_btn_download_fast);
        }

        this.cleanupMultiThreadDownload();
    }

    cleanupMultiThreadDownload() {
        this.multiThreadActive = false;
        this.threads.forEach(xhr => xhr && xhr.abort && xhr.abort());
        const $progressContainer = $('#download_progress_container');
        const $fastButton = $('#file_download_btn_fast');

        if ($progressContainer.length) {
            $progressContainer.removeClass('is-active').hide();
        }

        if ($fastButton.length) {
            $fastButton.removeClass('download-btn-progress-active is-loading').removeAttr('aria-busy');
        }

        $('#file_download_btn_fast .download-btn-label').removeClass('is-hidden');
        
        // 重置进度条
        $('#progress_thread_1')
            .removeClass('bg-warning')
            .css('width', '0%');

        $('#download_speed').text('0 KB/s');
        $('#download_progress').text('0 MB / 0 MB');
        
        // 清空数据
        this.chunks = [];
        this.threads = [];
        this.downloadedBytes = 0;
        this.lastTotalBytes = 0;
        
        // 重置下载按钮状态
        $('#file_download_btn_fast')
            .removeClass('btn-azure')
            .addClass('btn-success')
            .prop('disabled', false);

        // Only update the label text; do not destroy progress DOM
        const $label = $('#file_download_btn_fast').find('.download-btn-label');
        if ($label.length) {
            $label.html(app.languageData.file_btn_download_fast || '快速下载');
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 辅助方法：设置块的警告状态
    setChunkWarningStatus(index, isWarning) {
        // 记录警告状态
        if (this.threads[index]) {
            this.threads[index].hasWarning = isWarning;
        }
        
        // 使用单一进度条，根据所有块的警告状态决定是否显示警告
        if (isWarning) {
            // 有任何一个块出错，都显示警告状态
            $('#progress_thread_1').addClass('bg-warning');
        } else {
            // 检查是否所有块都没有警告状态
            const hasAnyWarning = this.threads.some(thread => thread && thread.hasWarning);
            if (!hasAnyWarning) {
                $('#progress_thread_1').removeClass('bg-warning');
            }
        }
    }
    
    abortMultiThreadDownload() {
        this.cleanupMultiThreadDownload();
    }
    
    // 直接使用已知的下载链接开始下载，避免重复请求API
    async startDirectDownload(params, uiCallbacks) {
        const {
            updateButtonText,
            updateButtonState,
            updateButtonClass,
            showError
        } = uiCallbacks;

        let downloadBtnText = params.mode === 'fast' ? 
            app.languageData.file_btn_download_fast : 
            app.languageData.file_btn_download;

        try {
            updateButtonClass('btn-success', 'btn-azure');
            const loadingText = app.languageData.download_preparing || app.languageData.download_loading || '...';
            updateButtonText(loadingText);
            updateButtonState(true);

            if (params.url) {
                if (params.mode === 'fast') {
                    try {
                        // 获取文件大小以决定使用哪种下载方式
                        const headResponse = await fetch(params.url, { method: 'HEAD' });
                        if (!headResponse.ok) {
                            // 无法获取文件信息：回退普通下载
                            window.location.href = params.url;
                        } else {
                            const fileSize = parseInt(headResponse.headers.get('content-length'));

                            // 无法可靠获取文件大小：回退普通下载
                            if (!Number.isFinite(fileSize) || fileSize <= 0) {
                                window.location.href = params.url;
                            } else if (fileSize < this.SMALL_FILE_THRESHOLD) {
                                // 小文件使用浏览器直接下载
                                console.log(`Small file detected (${this.formatBytes(fileSize)}), using direct download`);
                                window.location.href = params.url;
                            } else {
                                // 大文件使用分块下载（内部会确认 Range 支持，不支持则回退）
                                await this.startMultiThreadDownload(params.url, params.filename);
                            }
                        }
                    } catch (error) {
                        console.error('Fast download failed, falling back to normal download:', error);
                        // 回退普通下载，避免误报“网络不稳定”
                        window.location.href = params.url;
                        // 还原按钮状态
                        updateButtonClass('btn-azure', 'btn-success');
                        updateButtonText(downloadBtnText);
                        updateButtonState(false);
                        return true;
                    }
                } else {
                    // 普通下载模式
                    window.location.href = params.url;
                }

                setTimeout(() => {
                    updateButtonClass('btn-azure', 'btn-success');
                    updateButtonText(downloadBtnText);
                    updateButtonState(false);
                }, 3000);

                return true;
            } else {
                throw new Error('No download URL provided');
            }
        } catch (error) {
            showError(app.languageData.status_file_2 || '下载请求失败');
            // 还原按钮状态
            updateButtonClass('btn-azure', 'btn-success');
            updateButtonText(downloadBtnText);
            updateButtonState(false);
            return false;
        }
    }
}
