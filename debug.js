const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState: 'tests/.auth/state.json' });
  const page = await context.newPage();
  page.on('request', req => console.log('REQ:', req.url(), req.method()));
  await page.goto('http://localhost:3939/?tmpui_page=/vx&module=filelist&view=list', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.VX_UPLOADER !== 'undefined');
  await page.evaluate(() => {
    window.VX_UPLOADER.servers = [];
    window.VX_UPLOADER.serversLoaded = false;
    window.VX_UPLOADER.upload_server = '';
    window.VX_UPLOADER.openModal(0);
  });
  await page.waitForTimeout(500);
  const html = await page.evaluate(() => document.getElementById('vx-upload-server-tabs')?.innerHTML);
  console.log('HTML:', html);
  await browser.close();
})();
