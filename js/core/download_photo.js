class download_photo {
    activeDownloads = new Map();
    parent_op = null;

    init(parent_op) {
        this.parent_op = parent_op;
    }

    async download({ ukey, filename, ui }) {
        if (!ukey) {
            throw new Error('Missing ukey');
        }

        if (this.activeDownloads.has(ukey)) {
            return this.activeDownloads.get(ukey);
        }

        const task = this.performDownload({ ukey, filename, ui });
        this.activeDownloads.set(ukey, task);

        try {
            await task;
        } finally {
            this.activeDownloads.delete(ukey);
        }

        return true;
    }

    async performDownload({ ukey, filename, ui }) {
        if (ui && ui.onStart) {
            ui.onStart();
        }

        try {
            const url = await this.getDownloadUrl(ukey);
            await this.streamDownload(url, filename, ui);
            if (ui && ui.onComplete) {
                ui.onComplete();
            }
        } catch (error) {
            if (ui && ui.onError) {
                ui.onError(error);
            }
            throw error;
        }
    }

    async getDownloadUrl(ukey) {
        if (
            this.parent_op &&
            this.parent_op.download &&
            typeof this.parent_op.download.get_download_url === 'function'
        ) {
            return await this.parent_op.download.get_download_url(ukey);
        }
        throw new Error('Download service unavailable');
    }

    async streamDownload(url, filename, ui) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;

            if (ui && ui.onProgress) {
                ui.onProgress(received, contentLength);
            }
        }

        const blob = new Blob(chunks, {
            type: response.headers.get('content-type') || 'application/octet-stream'
        });
        this.triggerDownload(blob, filename);
    }

    triggerDownload(blob, filename) {
        const link = document.createElement('a');
        const url = window.URL.createObjectURL(blob);
        link.href = url;
        link.download = filename || 'photo';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }
}
