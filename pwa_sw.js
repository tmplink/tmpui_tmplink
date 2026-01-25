const CACHE_NAME = "static-cache";

self.addEventListener("install", installEvent => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 清理旧的缓存
          if (cacheName !== CACHE_NAME) {
            console.log('删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // 确保新的 Service Worker 立即接管页面
  self.clients.claim();
});

// 监听消息事件，支持手动清除缓存
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        console.log('手动清除静态资源缓存');
        // 通知页面缓存已清除
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({type: 'CACHE_CLEARED'});
          });
        });
      })
    );
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  // 导航请求失败时显示离线页面
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(getOfflineHTML(), {
          headers: { 'Content-Type': 'text/html' }
        });
      })
    );
    return;
  }

  const url = new URL(event.request.url);
  const path = url.pathname;
  
  // 只对特定静态资源进行 SW 缓存，其他文件遵循浏览器缓存规则
  if (shouldCache(path)) {
    event.respondWith(
      caches.match(event.request).then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(response => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        }).catch(() => {
          // 如果网络请求失败，尝试从缓存中获取
          return caches.match(event.request);
        });
      })
    );
  }
  // 对于其他文件，不拦截请求，让浏览器按照 HTTP 缓存头处理
});


function shouldCache(path) {
  // 排除 index.html 和根路径
  if (path === '/' || path.toLowerCase().endsWith('/index.html')) {
    return false;
  }

  const cacheableExtensions = [
    // HTML
    '.html',
    // CSS & JS
    '.css', '.js',
    // Images
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
    // Fonts
    '.woff', '.woff2', '.ttf', '.otf', '.eot',
    // JSON 
    '.json',
  ];
  return cacheableExtensions.some(ext => path.toLowerCase().endsWith(ext));
}

function getOfflineHTML() {
  // 多语言内容
  const translations = {
    'zh': {
      lang: 'zh-CN',
      title: '当前已离线',
      offline: '离线',
      message: '请检查您的网络连接，然后重试。',
      retry: '重试'
    },
    'en': {
      lang: 'en',
      title: 'Offline',
      offline: 'Offline',
      message: 'Please check your network connection and try again.',
      retry: 'Retry'
    },
    'ja': {
      lang: 'ja',
      title: 'オフライン',
      offline: 'オフライン',
      message: 'ネットワーク接続を確認して、再試行してください。',
      retry: '再試行'
    },
    'es': {
      lang: 'es',
      title: 'Desconectado',
      offline: 'Desconectado',
      message: 'Por favor, compruebe su conexión de red y vuelva a intentarlo.',
      retry: 'Reintentar'
    },
    'fr': {
      lang: 'fr',
      title: 'Hors ligne',
      offline: 'Hors ligne',
      message: 'Veuillez vérifier votre connexion réseau et réessayer.',
      retry: 'Réessayer'
    }
  };

  // 获取浏览器语言
  let lang = 'en';
  if (typeof navigator !== 'undefined' && navigator.language) {
    lang = navigator.language.split('-')[0];
  } else if (self && self.navigator && self.navigator.language) {
    lang = self.navigator.language.split('-')[0];
  }
  let t = translations[lang] || translations['en'];

  return `
    <!DOCTYPE html>
    <html lang="${t.lang}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${t.title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background-color: #f8f9fa;
          color: #3c4858;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          text-align: center;
          padding: 20px;
          box-sizing: border-box;
        }
        .container {
          max-width: 400px;
        }
        h1 {
          font-size: 24px;
          margin-bottom: 10px;
        }
        p {
          font-size: 16px;
          margin-bottom: 20px;
        }
        .retry-btn {
          background-color: #506efa;
          color: #ffffff;
          border: none;
          padding: 12px 24px;
          border-radius: 5px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.3s ease;
          -webkit-appearance: none;
        }
        .retry-btn:hover {
          background-color: #3759f9;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${t.offline}</h1>
        <p>${t.message}</p>
        <button class="retry-btn" onclick="location.reload()">${t.retry}</button>
      </div>
    </body>
    </html>
  `;
}
