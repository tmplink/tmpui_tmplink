/**
 * pwa_user.js — PWA 前台模块
 * 运行在浏览器主线程，负责：
 *   1. 注册并维护 Service Worker (/pwa.js)
 *   2. 接收 SW 的版本更新通知，以居中弹窗形式软提示用户（不强制 reload）
 *   3. 定时向 SW 发送 CHECK_UPDATE 心跳，确保长期停留的 tab 也能感知更新
 *
 * 所有样式内联注入，无外部 CSS 依赖。兼顾移动端与深色模式。
 */
'use strict';

(function () {
  if (!('serviceWorker' in navigator)) return;

  /* ─────────────────────────────────────────
   * 样式注入（全屏遮罩 + 居中弹窗 + 动画）
   * ───────────────────────────────────────── */
  const _injectStyles = () => {
    const el = document.createElement('style');
    el.id = 'pwa-user-styles';
    el.textContent = `
      /* ── 基础字体 ─────────────────────────── */
      #pwa-update-overlay, #pwa-update-overlay * {
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display",
                     "Segoe UI", Roboto, Arial, sans-serif;
        box-sizing: border-box;
      }

      /* ── 全屏遮罩 ─────────────────────────── */
      #pwa-update-overlay {
        position: fixed; inset: 0; z-index: 2147483647;
        display: flex; align-items: center; justify-content: center;
        padding: 24px 16px;
        background: rgba(15,23,42,0.28);
        opacity: 0;
        transition: opacity .30s ease;
        pointer-events: none;
      }
      #pwa-update-overlay.pwa-overlay-in {
        opacity: 1;
        pointer-events: auto;
      }

      /* ── 轻量化卡片 ──────────────────────── */
      #pwa-update-overlay .pwa-card {
        position: relative;
        width: 100%; max-width: 320px;
        border-radius: 24px;
        padding: 30px 22px 22px;
        text-align: center;
        background: #f8f9fc;
        border: 1px solid #e7ebf4;
        box-shadow: 0 14px 36px rgba(22,28,45,0.14);

        transform: translateY(28px) scale(0.93);
        transition: transform .40s cubic-bezier(.34,1.44,.64,1), opacity .30s ease;
        opacity: 0;
      }
      #pwa-update-overlay.pwa-overlay-in .pwa-card {
        transform: translateY(0) scale(1);
        opacity: 1;
      }

      /* 轻量化风格：关闭装饰层 */
      #pwa-update-overlay .pwa-card::before {
        content: none;
      }

      #pwa-update-overlay .pwa-card::after {
        content: none;
      }

      /* 确保卡片内容在高光/rim 层之上 */
      #pwa-update-overlay .pwa-card > * {
        position: relative;
        z-index: 1;
      }

      /* ── 图标 ─────────────────────────────── */
      #pwa-update-overlay .pwa-icon {
        width: 60px; height: 60px;
        border-radius: 16px;
        margin: 0 auto 20px;
        display: flex; align-items: center; justify-content: center;
        font-size: 27px; line-height: 1;
        background: #eef2f8;
        border: 1px solid #e1e7f2;
        box-shadow: 0 4px 12px rgba(22,28,45,0.08);
      }

      /* ── 标题 ─────────────────────────────── */
      #pwa-update-overlay .pwa-title {
        font-size: 17px; font-weight: 700;
        color: #2d3145;
        margin: 0 0 18px;
        letter-spacing: -0.3px;
        line-height: 1.3;
      }

      /* ── 立即刷新按钮 ────────────────────── */
      #pwa-update-overlay .pwa-btn-reload {
        display: block; width: 100%;
        padding: 14px 0;
        border-radius: 16px;
        border: 0.5px solid rgba(80,110,255,0.40);
        background: linear-gradient(
          175deg,
          rgba(112,140,255,0.95) 0%,
          rgba(60,90,252,0.98) 100%
        );
        color: #fff;
        font-size: 15px; font-weight: 600;
        letter-spacing: 0.1px;
        cursor: pointer;
        -webkit-appearance: none;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.30),
          0 6px 20px rgba(60,90,252,0.30);
        transition: opacity .15s, transform .12s;
      }
      #pwa-update-overlay .pwa-btn-reload:hover  { opacity: 0.88; }
      #pwa-update-overlay .pwa-btn-reload:active { transform: scale(.97); }

      /* ── 稍后按钮 ─────────────────────────── */
      #pwa-update-overlay .pwa-btn-later {
        display: block; width: 100%;
        margin-top: 6px;
        padding: 10px 0;
        border: none; background: transparent;
        color: #8e95a8;
        font-size: 14px;
        cursor: pointer;
        -webkit-appearance: none;
        transition: color .15s;
      }
      #pwa-update-overlay .pwa-btn-later:hover { color: #6f778d; }

      /* ── 深色模式 ─────────────────────────── */
      @media (prefers-color-scheme: dark) {
        #pwa-update-overlay {
          background: rgba(0,0,0,0.50);
        }
        #pwa-update-overlay .pwa-card {
          background: #1f2432;
          border-color: #2f3548;
          box-shadow:
            0 20px 52px rgba(0,0,0,0.52),
            0 4px 10px rgba(0,0,0,0.26);
        }
        #pwa-update-overlay .pwa-card::before {
          content: none;
        }
        #pwa-update-overlay .pwa-card::after {
          content: none;
        }
        #pwa-update-overlay .pwa-icon {
          background: #2a3142;
          border-color: #394157;
          box-shadow: 0 4px 12px rgba(0,0,0,0.22);
        }
        #pwa-update-overlay .pwa-title { color: #e8ecff; }
        #pwa-update-overlay .pwa-btn-reload {
          background: linear-gradient(
            175deg,
            rgba(120,148,255,0.92) 0%,
            rgba(68,98,255,0.97) 100%
          );
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.20),
            0 6px 20px rgba(68,98,255,0.34);
        }
        #pwa-update-overlay .pwa-btn-later { color: #8e95ad; }
        #pwa-update-overlay .pwa-btn-later:hover { color: #b6bdd6; }
      }

      /* ── 移动端 ───────────────────────────── */
      @media (max-width: 420px) {
        #pwa-update-overlay .pwa-card {
          max-width: 100%;
          border-radius: 20px;
          padding: 26px 18px 18px;
        }
        #pwa-update-overlay .pwa-icon {
          width: 54px; height: 54px;
          border-radius: 14px;
          font-size: 24px;
        }
      }
    `;
    document.head.appendChild(el);
  };

  /* ─────────────────────────────────────────
   * 多语言文案（内置，覆盖全球主要语言）
   * ───────────────────────────────────────── */
  const _t = (() => {
    // 优先精确匹配 zh-TW/zh-HK 等繁体，其余按主语言码匹配
    const full = (navigator.language || 'en').toLowerCase();
    const main = full.split('-')[0];
    const map = {
      // 中文简体
      'zh':    { title: '发现新版本',           desc: '应用程序已更新，刷新后立即生效。',                         reload: '立即刷新',    later: '稍后再说' },
      // 中文繁体（台湾 / 香港）
      'zh-tw': { title: '發現新版本',           desc: '應用程式已更新，重新整理後立即生效。',                     reload: '立即重新整理', later: '稍後再說' },
      'zh-hk': { title: '發現新版本',           desc: '應用程式已更新，重新整理後即時生效。',                     reload: '立即重新整理', later: '稍後再說' },
      // 日语
      'ja':    { title: '新バージョン利用可能', desc: 'アプリが更新されました。\n再読み込みして最新版を適用してください。', reload: '今すぐ更新', later: 'あとで' },
      // 韩语
      'ko':    { title: '새 버전 사용 가능',    desc: '앱이 업데이트되었습니다.\n새로고침하면 바로 적용됩니다.',           reload: '지금 새로고침', later: '나중에' },
      // 法语
      'fr':    { title: 'Nouvelle version',    desc: "L'application a été mise à jour.\nActualisez pour appliquer les changements.", reload: 'Actualiser', later: 'Plus tard' },
      // 德语
      'de':    { title: 'Neue Version',        desc: 'Die App wurde aktualisiert.\nSeite neu laden, um die Änderungen anzuwenden.', reload: 'Jetzt neu laden', later: 'Später' },
      // 西班牙语
      'es':    { title: 'Nueva versión',       desc: 'La aplicación ha sido actualizada.\nRecargue para aplicar los cambios.',  reload: 'Recargar ahora', later: 'Más tarde' },
      // 葡萄牙语
      'pt':    { title: 'Nova versão',         desc: 'O aplicativo foi atualizado.\nAtualize a página para aplicar as mudanças.', reload: 'Atualizar agora', later: 'Mais tarde' },
      // 俄语
      'ru':    { title: 'Доступна новая версия', desc: 'Приложение обновлено.\nОбновите страницу, чтобы применить изменения.',  reload: 'Обновить сейчас', later: 'Позже' },
      // 阿拉伯语
      'ar':    { title: 'إصدار جديد متاح',     desc: 'تم تحديث التطبيق.\nأعد تحميل الصفحة لتطبيق التغييرات.',              reload: 'إعادة التحميل', later: 'لاحقاً' },
      // 意大利语
      'it':    { title: 'Nuova versione',      desc: "L'app è stata aggiornata.\nRicarica per applicare le modifiche.",        reload: 'Ricarica ora', later: 'Più tardi' },
      // 荷兰语
      'nl':    { title: 'Nieuwe versie',       desc: 'De app is bijgewerkt.\nHerlaad de pagina om de wijzigingen toe te passen.', reload: 'Nu herladen', later: 'Later' },
      // 波兰语
      'pl':    { title: 'Nowa wersja',         desc: 'Aplikacja została zaktualizowana.\nOdśwież, aby zastosować zmiany.',     reload: 'Odśwież teraz', later: 'Później' },
      // 土耳其语
      'tr':    { title: 'Yeni sürüm mevcut',   desc: 'Uygulama güncellendi.\nDeğişiklikleri uygulamak için sayfayı yenileyin.', reload: 'Şimdi yenile', later: 'Sonra' },
      // 泰语
      'th':    { title: 'มีเวอร์ชันใหม่',       desc: 'แอปพลิเคชันได้รับการอัปเดต\nรีเฟรชหน้าเพื่อใช้การเปลี่ยนแปลง',        reload: 'รีเฟรชเดี๋ยวนี้', later: 'ภายหลัง' },
      // 越南语
      'vi':    { title: 'Phiên bản mới',       desc: 'Ứng dụng đã được cập nhật.\nTải lại để áp dụng thay đổi.',             reload: 'Tải lại ngay', later: 'Để sau' },
      // 印尼语 / 马来语
      'id':    { title: 'Versi baru tersedia', desc: 'Aplikasi telah diperbarui.\nMuat ulang untuk menerapkan perubahan.',     reload: 'Muat ulang', later: 'Nanti' },
      'ms':    { title: 'Versi baharu',        desc: 'Aplikasi telah dikemas kini.\nMuat semula untuk menerapkan perubahan.',  reload: 'Muat semula', later: 'Kemudian' },
      // 印地语
      'hi':    { title: 'नया संस्करण उपलब्ध', desc: 'ऐप अपडेट हो गया है।\nबदलाव लागू करने के लिए पुनः लोड करें।',          reload: 'अभी रीलोड करें', later: 'बाद में' },
    };
    // 先尝试完整语言标签（适配繁体等变体），再回退到主语言码，最后兜底英文
    return map[full] || map[main] || { title: 'New version available', desc: 'The app has been updated.\nRefresh to get the latest version.', reload: 'Reload now', later: 'Later' };
  })();

  /* ─────────────────────────────────────────
   * 展示弹窗
   * ───────────────────────────────────────── */
  let _visible = false;

  const _showBar = () => {
    if (_visible) return;
    _visible = true;

    const overlay = document.createElement('div');
    overlay.id = 'pwa-update-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', _t.title);

    overlay.innerHTML =
      '<div class="pwa-card">' +
        '<div class="pwa-icon">✨</div>' +
        '<p class="pwa-title">' + _t.title + '</p>' +
        '<button class="pwa-btn-reload">' + _t.reload + '</button>' +
        '<button class="pwa-btn-later">' + _t.later + '</button>' +
      '</div>';

    document.body.appendChild(overlay);

    // 强制重绘后触发淡入 + 弹出动画
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { overlay.classList.add('pwa-overlay-in'); });
    });

    const _dismiss = () => {
      overlay.classList.remove('pwa-overlay-in');
      overlay.addEventListener('transitionend', () => {
        overlay.remove();
        _visible = false;
      }, { once: true });
    };

    overlay.querySelector('.pwa-btn-reload').addEventListener('click', () => {
      window.location.reload();
    });
    overlay.querySelector('.pwa-btn-later').addEventListener('click', _dismiss);
    // 点击遮罩背景也可关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) _dismiss();
    });
  };

  /* ─────────────────────────────────────────
   * 接收 SW 消息
   * 尽早注册监听器，防止 SW 在注册完成后立即广播而页面未能接收
   * ───────────────────────────────────────── */
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'UPDATE_AVAILABLE') {
      _showBar();
    }
  });

  /* ─────────────────────────────────────────
   * 注册 SW + 定时心跳
   * ───────────────────────────────────────── */
  const _init = () => {
    _injectStyles();

    navigator.serviceWorker.register('/pwa.js')
      .then((registration) => {
        console.log('[PWA] SW registered:', registration.scope);

        // 每 60 秒通知 SW 检查一次版本（满足长时间停留的 tab）
        setInterval(() => {
          const sw = registration.active || registration.installing || registration.waiting;
          if (sw) {
            sw.postMessage({ type: 'CHECK_UPDATE', url: window.location.href });
          }
        }, 60 * 1000);
      })
      .catch((err) => {
        console.warn('[PWA] SW registration failed:', err);
      });
  };

  if (document.readyState === 'complete') {
    _init();
  } else {
    window.addEventListener('load', _init, { once: true });
  }

  /* ── 测试用命令：在控制台执行 pwaTest() 可直接弹出更新弹窗 ── */
  window.pwaTest = () => {
    _visible = false; // 重置幂等锁，允许重复弹出
    _showBar();
  };
})();
