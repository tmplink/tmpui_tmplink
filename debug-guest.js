const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto('http://localhost:3939/?tmpui_page=/vx&module=filelist&view=list', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.VX_UPLOADER !== 'undefined');
  const res = await page.evaluate(() => {
    try {
      window.VX_UPLOADER.openModal(0);
      return 'CALLED';
    } catch(e) {
      return e.message;
    }
  });
  console.log(res);
  await browser.close();
})();
