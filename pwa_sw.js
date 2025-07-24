// Service Worker 自动卸载脚本
// 此文件用于彻底移除已安装的 Service Worker

self.addEventListener('install', (event) => {
    // 跳过等待，立即激活
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            // 清除所有缓存
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        return caches.delete(cacheName);
                    })
                );
            }),
            // 卸载此 Service Worker
            self.registration.unregister().then(() => {
                // 通知所有客户端刷新以移除 Service Worker 控制
                return self.clients.matchAll().then((clients) => {
                    return Promise.all(
                        clients.map((client) => {
                            if (client.url && client.navigate) {
                                return client.navigate(client.url);
                            }
                        })
                    );
                });
            })
        ])
    );
});

// 不处理任何请求，让所有请求直接通过网络
self.addEventListener('fetch', (event) => {
    // 不拦截任何请求
});