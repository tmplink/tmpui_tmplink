// @ts-check
const { test, expect } = require('@playwright/test');

const FILELIST_URL = '/?tmpui_page=/vx&module=filelist&view=list';

test.describe('Uploader Authentication Checks', () => {
  // 模拟未登录的访客环境（清空 storageState，避免使用 auth-setup 的结果）
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto(FILELIST_URL, { waitUntil: 'domcontentloaded' });
    
    // 确保已清除本地所有的 token 或可能残留的登录校验信息
    await page.evaluate(() => localStorage.clear());
    // 重新加载以确保是在完全无 localStorage 下进行页面初始化
    await page.reload({ waitUntil: 'domcontentloaded' });

    // 等待初始化完成或 VX_UPLOADER 加载完成
    await page.waitForFunction(() => typeof window.VX_UPLOADER !== 'undefined');
    
    // 简单等待 500ms 兜底渲染时间
    await page.waitForTimeout(500);

    // 设置 spy 以捕获 `VXUI.toastWarning` 被调用时的参数
    await page.evaluate(() => {
      window.__toastText = null;
      const originToastWarning = window.VXUI?.toastWarning;
      if (window.VXUI) {
        window.VXUI.toastWarning = function(msg) {
          window.__toastText = msg;
          if (originToastWarning) originToastWarning.call(window.VXUI, msg);
        };
      }
    });
  });

  test('Guest cannot open upload modal, shows login prompt', async ({ page }) => {
    // 访客尝试打开上传模态框
    await page.evaluate(() => {
      window.VX_UPLOADER.openModal(0);
    });

    // 检查是否输出了“请先登录”的 Toast 提示
    const toastMsg = await page.evaluate(() => window.__toastText);
    expect(toastMsg).toBeTruthy(); // 这里多语言文案可能不同，只要确实弹出了提示即可

    // 验证模态框是否未被加上打开的 class
    const classListStr = await page.evaluate(() => {
      const modal = document.getElementById('vx-upload-modal');
      return modal ? Array.from(modal.classList).join(' ') : '';
    });
    
    expect(classListStr).not.toContain('vx-modal-open');
  });

  test('Guest cannot add to queue via drag & drop (simulated payload)', async ({ page }) => {
    // 访客尝试通过代码级绕过弹窗直接把文件扔进队列
    await page.evaluate(() => {
      window.__toastText = null;
      window.VX_UPLOADER.addToQueue({
         file: new File([''], 'test.txt'),
         is_dir: false
      });
    });

    // 同样应触发登录提示
    const toastMsg = await page.evaluate(() => window.__toastText);
    expect(toastMsg).toBeTruthy();

    // 确认队列应当仍为空
    const queueLength = await page.evaluate(() => {
      return window.VX_UPLOADER.upload_queue.length;
    });

    expect(queueLength).toBe(0);
  });
  
  test('Guest cannot trigger system file picker', async ({ page }) => {
    // 尝试呼出原生文件选择器
    await page.evaluate(() => {
      window.__toastText = null;
      window.VX_UPLOADER.selectFiles();
    });

    const toastMsgFiles = await page.evaluate(() => window.__toastText);
    expect(toastMsgFiles).toBeTruthy();

    // 尝试呼出原生文件夹选择器
    await page.evaluate(() => {
      window.__toastText = null;
      window.VX_UPLOADER.selectFolder();
    });

    const toastMsgFolder = await page.evaluate(() => window.__toastText);
    expect(toastMsgFolder).toBeTruthy();
  });
});

test.describe('Uploader Server Loading Checks (Logged In)', () => {
  // 模拟已登录环境
  test.use({ storageState: 'tests/.auth/state.json' });

  test.beforeEach(async ({ page }) => {
    // 拦截 upload api 延迟返回，以制造 Loading 状态存续窗口
    await page.route('**/api_v2/upload**', async route => {
      // 延迟 1 秒后请求，创造观测 loading 图标的时间
      await new Promise(resolve => setTimeout(resolve, 1000));
      return route.continue();
    });

    await page.goto(FILELIST_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.VX_UPLOADER !== 'undefined');
    await page.waitForSelector('#vx-upload-modal', { state: 'attached' });
  });

  test('Shows loading spinner while uploading servers data is fetching', async ({ page }) => {
    // 强制清理可能缓存的服务器数据并重置加载状态，确保进入重新拉取流程
    await page.evaluate(() => {
      window.VX_UPLOADER.servers = [];
      window.VX_UPLOADER.serversLoaded = false;
      window.VX_UPLOADER.upload_server = '';
    });

    // 触发打开面板，预期将会发起网络请求（被 route 拦截并堵塞）
    await page.evaluate(() => {
      window.VX_UPLOADER.openModal(0);
    });

    // 此时应出现加载中的相关 DOM，找有 vxSpin 的 icon
    const loadingIconCount = await page.evaluate(() => {
      const modal = document.getElementById('vx-upload-modal');
      return modal?.querySelectorAll('.vx-loading-icon').length || 0;
    });

    // 至少应有一个正在 Loading 的区域（服务端点选择 tab）
    expect(loadingIconCount).toBeGreaterThan(0);
    
    // 如果想要更明确地断言下拉框是否被替换
    const loadingText = await page.evaluate(() => {
      const select = document.getElementById('vx-upload-server');
      return select ? select.innerHTML : '';
    });
    
    // 我们预期此时会有 <option disabled selected>加载中...</option> 之类的内容
    expect(loadingText).toContain('disabled');
  });
});

