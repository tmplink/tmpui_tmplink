/**
 * File Download Page Controller
 * 文件下载页面的完整控制器，使用 ES6 Class 语法
 * 
 * 职责：
 * - UI 初始化与视口适配
 * - 文件详情加载与展示
 * - 下载按钮事件处理
 * - 多线程分块下载
 * - 下载进度显示
 */

class FilePageController {
    // ========== 常量配置 ==========
    static CHUNK_SIZE = 8 * 1024 * 1024;           // 分块大小 8MB
    static SMALL_FILE_THRESHOLD = 8 * 1024 * 1024 * 3; // 小于 24MB 直接下载
    static MAX_CHUNK_RETRY = 3;                     // 单块最大重试次数
    static MAX_CONCURRENT_DOWNLOADS = 3;            // 最大并行下载数

    // ========== 实例属性 ==========
    constructor() {
        // 下载状态
        this.threads = [];
        this.chunks = [];
        this.totalSize = 0;
        this.downloadedBytes = 0;
        this.lastTotalBytes = 0;
        this.lastSpeedUpdate = 0;
        this.multiThreadActive = false;
        this.fastDownloadInProgress = false;
        this.speedInterval = null;

        // 文件信息
        this.currentFileDetails = null;
        this.currentDownloadUrl = null;
        this.currentCurlCommand = null;
        this.currentWgetCommand = null;

        // DOM 缓存
        this.$downloadBtn = null;
        this.$progressContainer = null;
        this.$progressFill = null;
        this.$downloadSpeed = null;
        this.$downloadProgress = null;
        this.$btnLabel = null;
    }

    // ========== 初始化 ==========
    
    init() {
        this.initViewport();
        this.initDOMCache();
        this.initPageClass();
        this.bindEvents();
        
        // 确保进度容器默认隐藏
        this.hideProgress();
        
        console.log('[FilePageController] Initialized');
    }

    initViewport() {
        const setVH = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };

        const updateCompact = () => {
            const root = document.querySelector('.file-screen');
            if (!root) return;
            const compact = window.innerHeight < 720 || window.innerWidth < 380;
            root.classList.toggle('is-compact', compact);
        };

        setVH();
        updateCompact();

        window.addEventListener('resize', () => { setVH(); updateCompact(); });
        window.addEventListener('orientationchange', () => { setVH(); updateCompact(); });
    }

    initPageClass() {
        document.documentElement.classList.add('file-page');
        document.body.classList.add('file-page');
    }

    initDOMCache() {
        this.$downloadBtn = document.getElementById('file_download_btn_fast');
        this.$progressContainer = document.getElementById('download_progress_container');
        this.$progressFill = document.getElementById('progress_thread_1');
        this.$downloadSpeed = document.getElementById('download_speed');
        this.$downloadProgress = document.getElementById('download_progress');
        this.$btnLabel = this.$downloadBtn?.querySelector('.download-btn-label');
    }

    bindEvents() {
        // 下载按钮点击事件由 tmplink.js 绑定（因涉及 API token/recaptcha）
        // 这里只处理 UI 层面的事件
    }

    // ========== 进度 UI 控制 ==========

    showProgress() {
        if (this.$progressContainer) {
            this.$progressContainer.style.display = 'flex';
            this.$progressContainer.classList.add('is-active');
        }
        if (this.$downloadBtn) {
            this.$downloadBtn.classList.add('download-btn-progress-active');
            this.$downloadBtn.setAttribute('aria-busy', 'true');
        }
    }

    hideProgress() {
        if (this.$progressContainer) {
            this.$progressContainer.style.display = 'none';
            this.$progressContainer.classList.remove('is-active');
        }
        if (this.$downloadBtn) {
            this.$downloadBtn.classList.remove('download-btn-progress-active', 'is-loading');
            this.$downloadBtn.removeAttribute('aria-busy');
        }
        if (this.$progressFill) {
            this.$progressFill.style.width = '0%';
            this.$progressFill.classList.remove('bg-warning');
        }
        this.updateSpeedDisplay(0);
        this.updateProgressDisplay(0, 0);
    }

    updateProgressFill(percent) {
        if (this.$progressFill) {
            this.$progressFill.style.width = `${percent}%`;
        }
    }

    updateSpeedDisplay(bytesPerSecond) {
        if (this.$downloadSpeed) {
            this.$downloadSpeed.textContent = `${this.formatBytes(bytesPerSecond)}/s`;
        }
    }

    updateProgressDisplay(loaded, total) {
        if (this.$downloadProgress) {
            this.$downloadProgress.textContent = `${this.formatBytes(loaded)} / ${this.formatBytes(total)}`;
        }
    }

    updateButtonText(text) {
        const $textEl = this.$downloadBtn?.querySelector('.download-btn-text');
        if ($textEl) {
            $textEl.innerHTML = text;
        }
    }

    setButtonLoading(isLoading) {
        if (this.$downloadBtn) {
            this.$downloadBtn.classList.toggle('is-loading', isLoading);
            this.$downloadBtn.disabled = isLoading;
        }
    }

    setProgressWarning(isWarning) {
        if (this.$progressFill) {
            this.$progressFill.classList.toggle('bg-warning', isWarning);
        }
    }

    // ========== 多线程下载核心 ==========

    async startMultiThreadDownload(url, filename) {
        if (this.fastDownloadInProgress) {
            console.warn('[FilePageController] Download already in progress');
            return false;
        }

        this.fastDownloadInProgress = true;

        try {
            // 获取文件大小
            console.log('[FilePageController] Fetching HEAD for:', url);
            const headResponse = await fetch(url, { method: 'HEAD' });
            console.log('[FilePageController] HEAD response status:', headResponse.status, 'ok:', headResponse.ok);
            
            if (!headResponse.ok) {
                console.log('[FilePageController] HEAD request failed, falling back');
                return this.fallbackDownload(url);
            }

            this.totalSize = parseInt(headResponse.headers.get('content-length'));
            console.log('[FilePageController] Content-Length:', this.totalSize);
            
            if (!Number.isFinite(this.totalSize) || this.totalSize <= 0) {
                console.log('[FilePageController] Invalid content-length, falling back');
                return this.fallbackDownload(url);
            }

            // 小文件直接下载
            if (this.totalSize < FilePageController.SMALL_FILE_THRESHOLD) {
                console.log(`[FilePageController] Small file (${this.formatBytes(this.totalSize)} < ${this.formatBytes(FilePageController.SMALL_FILE_THRESHOLD)}), using direct download`);
                return this.fallbackDownload(url);
            }

            // 服务器已确认支持 Range 请求，直接进行分片下载
            console.log('[FilePageController] Starting chunked download for', this.formatBytes(this.totalSize));

            // 计算分块
            const chunkSize = FilePageController.CHUNK_SIZE;
            const numberOfChunks = Math.ceil(this.totalSize / chunkSize);

            // 初始化下载状态
            this.initDownloadState(numberOfChunks);
            this.showProgress();

            // 创建下载任务
            const downloadTasks = Array.from({ length: numberOfChunks }, (_, i) => {
                const start = i * chunkSize;
                const end = i === numberOfChunks - 1 
                    ? this.totalSize - 1 
                    : Math.min(start + chunkSize - 1, this.totalSize - 1);
                return { index: i, start, end, expectedSize: end - start + 1 };
            });

            // 启动速度计算
            this.startSpeedCalculator();

            // 下载所有块
            const chunks = new Array(numberOfChunks);
            const queue = [...downloadTasks];
            const activeDownloads = [];

            while (queue.length > 0 || activeDownloads.length > 0) {
                while (activeDownloads.length < FilePageController.MAX_CONCURRENT_DOWNLOADS && queue.length > 0) {
                    const task = queue.shift();
                    const downloadPromise = this.downloadChunk(url, task.index, task.start, task.end, task.expectedSize)
                        .then(chunk => {
                            chunks[task.index] = chunk;
                            const idx = activeDownloads.indexOf(downloadPromise);
                            if (idx !== -1) activeDownloads.splice(idx, 1);
                            return chunk;
                        });
                    activeDownloads.push(downloadPromise);
                }
                if (activeDownloads.length > 0) {
                    await Promise.race(activeDownloads);
                }
            }

            // 验证完整性
            let totalReceived = 0;
            chunks.forEach((chunk, i) => {
                const task = downloadTasks[i];
                if (chunk.byteLength !== task.expectedSize) {
                    throw new Error(`Chunk ${i} size mismatch`);
                }
                totalReceived += chunk.byteLength;
            });

            if (totalReceived !== this.totalSize) {
                throw new Error(`Total size mismatch: expected ${this.totalSize}, got ${totalReceived}`);
            }

            // 合并并触发下载
            const blob = new Blob(chunks, { 
                type: headResponse.headers.get('content-type') || 'application/octet-stream' 
            });
            this.triggerBlobDownload(blob, filename);

            this.cleanupDownload();
            return true;

        } catch (error) {
            console.error('[FilePageController] Multi-thread download failed:', error);
            this.cleanupDownload();
            return this.fallbackDownload(url);
        } finally {
            this.fastDownloadInProgress = false;
        }
    }

    async probeRangeSupport(url) {
        return new Promise(resolve => {
            let resolved = false;
            const finish = (value, reason) => {
                if (resolved) return;
                resolved = true;
                console.log('[FilePageController] probeRangeSupport finish:', value, 'reason:', reason);
                resolve(value);
            };

            try {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.responseType = 'arraybuffer';
                xhr.timeout = 5000;
                xhr.setRequestHeader('Range', 'bytes=0-0');

                xhr.onreadystatechange = () => {
                    console.log('[FilePageController] probeRangeSupport readyState:', xhr.readyState, 'status:', xhr.status);
                    if (xhr.readyState === 2) {
                        const ok = xhr.status === 206;
                        try { xhr.abort(); } catch (e) { /* ignore */ }
                        finish(ok, `status=${xhr.status}`);
                    }
                };
                xhr.onerror = (e) => {
                    console.log('[FilePageController] probeRangeSupport onerror:', e);
                    finish(false, 'onerror');
                };
                xhr.ontimeout = () => {
                    console.log('[FilePageController] probeRangeSupport ontimeout');
                    finish(false, 'timeout');
                };
                xhr.onabort = () => { if (!resolved) finish(false); };
                xhr.send();
            } catch (e) {
                finish(false);
            }
        });
    }

    initDownloadState(numChunks) {
        this.chunks = [];
        this.downloadedBytes = 0;
        this.lastTotalBytes = 0;
        this.lastSpeedUpdate = Date.now();
        this.threads = new Array(numChunks).fill(null).map(() => ({ loaded: 0, hasWarning: false }));
        this.multiThreadActive = true;
    }

    downloadChunk(url, index, start, end, expectedSize, retryCount = 0) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            this.threads[index] = { ...this.threads[index], xhr, loaded: 0 };

            xhr.open('GET', url);
            xhr.responseType = 'arraybuffer';
            xhr.setRequestHeader('Range', `bytes=${start}-${end}`);

            xhr.onprogress = (event) => {
                if (this.multiThreadActive) {
                    this.updateChunkProgress(index, event.loaded);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 206) {
                    const chunk = xhr.response;
                    if (chunk.byteLength !== expectedSize) {
                        if (retryCount < FilePageController.MAX_CHUNK_RETRY) {
                            this.setChunkWarning(index, true);
                            setTimeout(() => {
                                this.downloadChunk(url, index, start, end, expectedSize, retryCount + 1)
                                    .then(resolve).catch(reject);
                            }, 1000);
                            return;
                        }
                        reject(new Error(`Chunk ${index} size mismatch after retries`));
                        return;
                    }
                    this.setChunkWarning(index, false);
                    resolve(chunk);
                } else {
                    this.retryOrReject(url, index, start, end, expectedSize, retryCount, resolve, reject, 
                        `HTTP ${xhr.status}`);
                }
            };

            xhr.onerror = () => this.retryOrReject(url, index, start, end, expectedSize, retryCount, resolve, reject, 'Network error');
            xhr.ontimeout = () => this.retryOrReject(url, index, start, end, expectedSize, retryCount, resolve, reject, 'Timeout');

            xhr.send();
        });
    }

    retryOrReject(url, index, start, end, expectedSize, retryCount, resolve, reject, reason) {
        if (retryCount < FilePageController.MAX_CHUNK_RETRY) {
            console.warn(`[FilePageController] Chunk ${index} failed (${reason}), retrying...`);
            this.setChunkWarning(index, true);
            setTimeout(() => {
                this.downloadChunk(url, index, start, end, expectedSize, retryCount + 1)
                    .then(resolve).catch(reject);
            }, 1000);
        } else {
            reject(new Error(`Chunk ${index} failed after ${FilePageController.MAX_CHUNK_RETRY} retries: ${reason}`));
        }
    }

    updateChunkProgress(index, loaded) {
        if (this.threads[index]) {
            this.threads[index].loaded = loaded;
        }

        this.downloadedBytes = this.threads.reduce((sum, t) => sum + (t?.loaded || 0), 0);
        const percent = (this.downloadedBytes / this.totalSize) * 100;

        this.updateProgressFill(percent);
        this.updateProgressDisplay(this.downloadedBytes, this.totalSize);

        // 检查是否有警告状态
        const hasWarning = this.threads.some(t => t?.hasWarning);
        this.setProgressWarning(hasWarning);
    }

    setChunkWarning(index, isWarning) {
        if (this.threads[index]) {
            this.threads[index].hasWarning = isWarning;
        }
        const hasAnyWarning = this.threads.some(t => t?.hasWarning);
        this.setProgressWarning(hasAnyWarning);
    }

    startSpeedCalculator() {
        this.lastSpeedUpdate = Date.now();
        this.lastTotalBytes = 0;

        this.speedInterval = setInterval(() => {
            if (!this.multiThreadActive) {
                clearInterval(this.speedInterval);
                return;
            }

            const now = Date.now();
            const timeDiff = (now - this.lastSpeedUpdate) / 1000;
            const bytesIncrement = this.downloadedBytes - this.lastTotalBytes;
            const speed = timeDiff > 0 ? bytesIncrement / timeDiff : 0;

            this.updateSpeedDisplay(speed);

            this.lastSpeedUpdate = now;
            this.lastTotalBytes = this.downloadedBytes;
        }, 1000);
    }

    triggerBlobDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    fallbackDownload(url) {
        console.log('[FilePageController] Falling back to direct download');
        window.location.href = url;
        this.cleanupDownload();
        return true;
    }

    cleanupDownload() {
        this.multiThreadActive = false;
        
        // 中止所有进行中的请求
        this.threads.forEach(t => {
            if (t?.xhr?.abort) {
                try { t.xhr.abort(); } catch (e) { /* ignore */ }
            }
        });

        // 清除速度计算定时器
        if (this.speedInterval) {
            clearInterval(this.speedInterval);
            this.speedInterval = null;
        }

        // 重置状态
        this.threads = [];
        this.chunks = [];
        this.downloadedBytes = 0;
        this.lastTotalBytes = 0;
        this.totalSize = 0;

        // 隐藏进度
        this.hideProgress();

        // 恢复按钮状态
        this.setButtonLoading(false);
        if (typeof app !== 'undefined' && app.languageData) {
            this.updateButtonText(app.languageData.file_btn_download_fast || '高速下载');
        }
    }

    abortDownload() {
        this.cleanupDownload();
    }

    // ========== 公共下载入口（供 tmplink.js 调用） ==========

    /**
     * 处理文件下载（需要先获取下载链接）
     * @param {Object} params - { ukey, filename, mode }
     * @param {Function} getDownloadUrl - 异步获取下载链接的函数
     */
    async handleDownload(params, getDownloadUrl) {
        const { filename, mode } = params;

        try {
            this.setButtonLoading(true);
            this.updateButtonText(app?.languageData?.download_preparing || '准备中...');

            const url = await getDownloadUrl();
            if (!url) {
                throw new Error('Failed to get download URL');
            }

            // 对于快速下载模式，直接尝试多线程下载
            // startMultiThreadDownload 内部会自行检测文件大小和 Range 支持，失败则自动回退
            if (mode === 'fast') {
                console.log('[FilePageController] Fast mode: attempting multi-thread download');
                // 立即恢复按钮状态，避免长时间显示 loading
                this.setButtonLoading(false);
                
                const success = await this.startMultiThreadDownload(url, filename);
                if (success) {
                    return true;
                }
                // startMultiThreadDownload 返回 false 或内部已触发 fallbackDownload
                // 如果到这里说明已经处理完毕
                return true;
            }

            // 小文件、普通模式或 HEAD 失败：直接下载
            window.location.href = url;
            setTimeout(() => {
                this.setButtonLoading(false);
                this.updateButtonText(app?.languageData?.file_btn_download_fast || '高速下载');
            }, 3000);

            return true;

        } catch (error) {
            console.error('[FilePageController] Download failed:', error);
            this.cleanupDownload();
            throw error;
        }
    }

    /**
     * 直接使用已知 URL 下载（跳过 API 请求）
     * @param {string} url - 下载链接
     * @param {string} filename - 文件名
     * @param {string} mode - 'fast' | 'normal'
     */
    async startDirectDownload(url, filename, mode = 'fast') {
        try {
            this.setButtonLoading(true);
            this.updateButtonText('<img src="/img/loading-outline.svg" style="height:1.2em"/>');

            if (mode === 'fast') {
                const headResponse = await fetch(url, { method: 'HEAD' });
                if (headResponse.ok) {
                    const fileSize = parseInt(headResponse.headers.get('content-length'));
                    if (Number.isFinite(fileSize) && fileSize >= FilePageController.SMALL_FILE_THRESHOLD) {
                        await this.startMultiThreadDownload(url, filename);
                        return true;
                    }
                }
            }

            window.location.href = url;
            setTimeout(() => {
                this.setButtonLoading(false);
                this.updateButtonText(app?.languageData?.file_btn_download_fast || '高速下载');
            }, 3000);

            return true;

        } catch (error) {
            console.error('[FilePageController] Direct download failed:', error);
            this.cleanupDownload();
            window.location.href = url; // 回退
            return true;
        }
    }

    // ========== 工具方法 ==========

    formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// ========== 全局实例 ==========
const filePage = new FilePageController();

// DOM Ready 后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => filePage.init());
} else {
    filePage.init();
}

// 暴露给全局
window.filePage = filePage;
window.FilePageController = FilePageController;
