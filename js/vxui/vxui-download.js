class VXUIDownload {
    parent_op = null;
    abortController = null;
    isDownloading = false;

    init(parent_op) {
        this.parent_op = parent_op || {};
    }

    showModal() {
        const modal = document.getElementById('multipleDownloadModel');
        if (modal) {
            modal.classList.add('vx-modal-open');
            document.body.classList.add('vx-modal-body-open');
        }
    }

    closeModal() {
        // 如果正在下载，先取消下载
        if (this.isDownloading && this.abortController) {
            this.abortController.abort();
            this.abortController = null;
            this.isDownloading = false;
            this.append_download_info(this.t('multi_download_cancelled', '下载已取消'));
        }
        
        const modal = document.getElementById('multipleDownloadModel');
        if (modal) {
            modal.classList.remove('vx-modal-open');
            document.body.classList.remove('vx-modal-body-open');
        }
    }

    t(key, fallback) {
        try {
            if (typeof app !== 'undefined' && app && app.languageData && app.languageData[key] !== undefined) {
                return app.languageData[key];
            }
        } catch (e) { /* ignore */ }
        return fallback;
    }

    getToken() {
        if (this.parent_op && typeof this.parent_op.getToken === 'function') {
            return this.parent_op.getToken();
        }
        return this.parent_op ? this.parent_op.api_token : null;
    }

    parseSizeToBytes(value) {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        const str = String(value).trim();
        if (!str) return 0;
        if (/^\d+$/.test(str)) return parseInt(str, 10);

        const match = str.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i);
        if (!match) return 0;
        const num = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        if (!Number.isFinite(num)) return 0;

        const unitMap = {
            B: 1,
            KB: 1024,
            MB: 1024 * 1024,
            GB: 1024 * 1024 * 1024,
            TB: 1024 * 1024 * 1024 * 1024
        };
        return Math.round(num * (unitMap[unit] || 1));
    }

    calcTotalProgress(previousBytes, currentBytes, totalBytes, totalFiles, currentIndex) {
        if (totalBytes > 0) {
            return ((previousBytes + currentBytes) / totalBytes) * 100;
        }
        if (totalFiles > 0) {
            const step = currentBytes > 0 ? 0.5 : 0;
            return ((currentIndex + step) / totalFiles) * 100;
        }
        return 0;
    }

    async get_download_url(ukey) {
        try {
            const recaptcha = this.parent_op && typeof this.parent_op.recaptcha_do_async === 'function'
                ? await this.parent_op.recaptcha_do_async('download_req')
                : '';
            const response = await $.post(this.parent_op.api_file, {
                action: 'download_req',
                ukey: ukey,
                token: this.getToken(),
                captcha: recaptcha
            });

            if (response.status === 1) {
                return response.data;
            } else if (response.status === 3) {
                throw new Error(this.t('status_need_login', '需要登录'));
            } else {
                throw new Error(this.t('status_error_0', '请求失败'));
            }
        } catch (error) {
            throw error;
        }
    }

    async folder_download(select_data) {
        try {
            // 初始化 AbortController
            this.abortController = new AbortController();
            this.isDownloading = true;
            
            this.showModal();
            document.getElementById('multiple_download_prepare').style.display = 'block';
            document.getElementById('multiple_download_processing').style.display = 'none';

            this.init_folder_download_progress();

            const file_list = await this.folder_download_prepare(select_data);
            const hasFolder = file_list.some(file => file.path.includes('/'));

            const totalSize = file_list.reduce((acc, file) => acc + this.parseSizeToBytes(file.size), 0);
            let downloadedBytes = 0;
            const totalFiles = file_list.length;

            this.append_download_info(`${this.t('multi_download_start', '开始下载')} ${file_list.length} ${this.t('multi_download_files', '个文件')}, ${this.t('multi_download_count', '总大小')} ${bytetoconver(totalSize, true)}`);

            document.getElementById('multiple_download_prepare').style.display = 'none';
            document.getElementById('multiple_download_processing').style.display = 'block';

            if (hasFolder) {
                try {
                    const dirHandle = await window.showDirectoryPicker();
                    const hasPermission = await this.verifyDirectoryPermissions(dirHandle);

                    if (hasPermission) {
                        this.append_download_info(this.t('multi_download_start', '开始下载'));

                        for (let i = 0; i < file_list.length; i++) {
                            // 检查是否已取消
                            if (!this.isDownloading) {
                                throw new Error('cancelled');
                            }
                            
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
                                            .reduce((acc, f) => acc + this.parseSizeToBytes(f.size), 0);
                                        const totalProgress = this.calcTotalProgress(previousFilesBytes, receivedBytes, totalSize, totalFiles, i);
                                        $('#multiple_download_process-bar')
                                            .css('width', `${totalProgress}%`)
                                            .attr('aria-valuenow', totalProgress);
                                    },
                                    this.abortController.signal
                                );
                                downloadedBytes += this.parseSizeToBytes(file.size);
                            } catch (error) {
                                if (error.name === 'AbortError' || error.message === 'cancelled') {
                                    throw error; // 重新抛出取消错误
                                }
                                console.error(`Error downloading file ${file.path}:`, error);
                                this.append_download_info(`${this.t('multi_download_error', '下载失败')}: ${file.path} (${error.message})`);
                            }
                        }

                        const progressBar = $('#multiple_download_process-bar');
                        progressBar.css('width', '100%')
                            .removeClass('progress-bar-animated progress-bar-striped')
                            .addClass('bg-success')
                            .attr('aria-valuenow', 100);

                        this.append_download_info(this.t('multi_download_complete', '下载完成'));
                        this.isDownloading = false;
                        return;
                    }
                } catch (error) {
                    console.log('File System Access API not supported or permission denied, falling back to legacy download');
                    this.append_download_info(this.t('multi_download_legacy', '已切换到传统下载方式'));
                }
            }

            for (let i = 0; i < file_list.length; i++) {
                // 检查是否已取消
                if (!this.isDownloading) {
                    throw new Error('cancelled');
                }
                
                const file = file_list[i];
                try {
                    const downloadUrl = await this.get_download_url(file.ukey);

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
                                .reduce((acc, f) => acc + this.parseSizeToBytes(f.size), 0);
                            const totalProgress = this.calcTotalProgress(previousFilesBytes, receivedBytes, totalSize, totalFiles, i);
                            $('#multiple_download_process-bar')
                                .css('width', `${totalProgress}%`)
                                .attr('aria-valuenow', totalProgress);
                        },
                        this.abortController.signal
                    );

                    downloadedBytes += this.parseSizeToBytes(file.size);
                } catch (error) {
                    if (error.name === 'AbortError' || error.message === 'cancelled') {
                        throw error; // 重新抛出取消错误
                    }
                    this.append_download_info(`${this.t('multi_download_error', '下载失败')}: ${file.path} (${error.message})`);
                }
            }

            const progressBar = $('#multiple_download_process-bar');
            progressBar.css('width', '100%')
                .removeClass('progress-bar-animated progress-bar-striped')
                .addClass('bg-success')
                .attr('aria-valuenow', 100);

            this.append_download_info(this.t('multi_download_complete', '下载完成'));
            this.isDownloading = false;

        } catch (error) {
            this.isDownloading = false;
            if (error.name === 'AbortError' || error.message === 'cancelled') {
                // 用户取消下载，不显示错误
                return;
            }
            this.append_download_info(`${this.t('multi_download_error', '下载失败')}: ${error.message}`);
            if (this.parent_op && typeof this.parent_op.alert === 'function') {
                this.parent_op.alert(this.t('download_error_abort', '下载已中止'));
            }
        }
    }

    async legacyDownloadFile(url, fileName, originalPath, onProgress, signal) {
        const msgElement = this.appendProgressLine();

        try {
            const response = await fetch(url, { signal });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
            const reader = response.body.getReader();
            const chunks = [];
            let receivedLength = 0;

            this.updateProgressText(
                msgElement,
                `${this.t('multi_download_start', '开始下载')}: ${originalPath} (0/${bytetoconver(contentLength, true)}) ...`
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
                        `${this.t('multi_download_start', '开始下载')}: ${originalPath} (${bytetoconver(receivedLength, true)}/${bytetoconver(contentLength, true)}) ...`
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
                `${this.t('multi_download_finish', '下载完成')}: ${originalPath} (${bytetoconver(receivedLength, true)})`,
                'text-success'
            );

        } catch (error) {
            if (error.name === 'AbortError') {
                this.updateProgressText(
                    msgElement,
                    `${this.t('multi_download_cancelled', '下载已取消')}: ${originalPath}`,
                    'text-warning'
                );
            } else {
                this.updateProgressText(
                    msgElement,
                    `${this.t('multi_download_error', '下载失败')}:${originalPath} (${error.message})`,
                    'text-danger'
                );
            }
            throw error;
        }
    }

    async download_and_save_file(url, dirHandle, fileName, fullPath, onProgress, signal) {
        let msgElement = null;

        try {
            const response = await fetch(url, { signal });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
            const reader = response.body.getReader();
            const chunks = [];
            let receivedLength = 0;

            msgElement = this.appendProgressLine();
            this.updateProgressText(
                msgElement,
                `${this.t('multi_download_start', '开始下载')}: ${fullPath} (0/${bytetoconver(contentLength, true)}) ...`
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
                        `${this.t('multi_download_start', '开始下载')}: ${fullPath} (${bytetoconver(receivedLength, true)}/${bytetoconver(contentLength, true)}) ...`
                    );
                }
            }

            const blob = new Blob(chunks);
            const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();

            this.updateProgressText(
                msgElement,
                `${this.t('multi_download_finish', '下载完成')}: ${fullPath} (${bytetoconver(receivedLength, true)})`,
                'text-success'
            );

        } catch (error) {
            if (msgElement) {
                if (error.name === 'AbortError') {
                    this.updateProgressText(
                        msgElement,
                        `${this.t('multi_download_cancelled', '下载已取消')}: ${fullPath}`,
                        'text-warning'
                    );
                } else {
                    this.updateProgressText(
                        msgElement,
                        `${this.t('multi_download_error', '下载失败')}:${fullPath} (${error.message})`,
                        'text-danger'
                    );
                }
            }
            throw error;
        }
    }

    async verifyDirectoryPermissions(dirHandle) {
        try {
            const options = { mode: 'readwrite' };
            const verifyPermission = await dirHandle.queryPermission(options);

            if (verifyPermission === 'granted') {
                return true;
            }

            const permission = await dirHandle.requestPermission(options);
            return permission === 'granted';

        } catch (error) {
            console.error('Permission verification failed:', error);
            return false;
        }
    }

    async ensureDirectoryExists(rootDirHandle, dirPath) {
        const parts = dirPath.split('/');
        let currentHandle = rootDirHandle;

        for (const part of parts) {
            if (part) {
                try {
                    currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
                } catch (error) {
                    console.error(`Error creating directory ${part}:`, error);
                    throw new Error(`${this.t('folder_create_error', '创建文件夹失败')}: ${error.message}`);
                }
            }
        }

        return currentHandle;
    }

    async folder_download_prepare(select_data) {
        let file_list = [];
        for (let x in select_data) {
            if (select_data[x].type === 'dir') {
                try {
                    let response = await $.post(this.parent_op.api_mr, {
                        action: 'get_all_file',
                        token: this.getToken(),
                        mr_id: select_data[x].id
                    });

                    if (response.status === 1) {
                        // 直接使用 API 返回的数据，与旧版本保持一致
                        // API 返回格式: { ukey, size, path }
                        file_list.push(...response.data);
                    } else {
                        console.error('API returned error status:', response);
                    }
                } catch (error) {
                    console.error('jQuery post error:', error);
                }
            } else {
                const file = this.parent_op && typeof this.parent_op.getFileByUkey === 'function'
                    ? this.parent_op.getFileByUkey(select_data[x].id)
                    : null;
                if (file) {
                    file_list.push({
                        ukey: file.ukey,
                        size: file.filesize || file.fsize || file.size || 0,
                        path: file.fname || file.name || ''
                    });
                }
            }
        }
        return file_list;
    }

    appendProgressLine() {
        const infoArea = $('#multiple_download_info');
        const msgDiv = $('<div class="download-message mb-1"></div>');
        infoArea.prepend(msgDiv);
        infoArea.scrollTop(0);
        return msgDiv;
    }

    updateProgressText(element, message, className = '') {
        if (!element) return;
        const timestamp = new Date().toLocaleTimeString();
        element.attr('class', 'download-message mb-1 ' + className)
            .html(`[${timestamp}] ${message}`);
    }

    init_folder_download_progress() {
        const progressBar = $('#multiple_download_process-bar');
        progressBar.css('width', '0%')
            .removeClass('bg-success')
            .addClass('progress-bar-striped progress-bar-animated')
            .attr('aria-valuenow', 0);

        $('#multiple_download_info').empty();
    }

    append_download_info(message) {
        const msgElement = this.appendProgressLine();
        this.updateProgressText(msgElement, message);
    }
}

// 创建全局 VX_DOWNLOAD 实例
var VX_DOWNLOAD = new VXUIDownload();
