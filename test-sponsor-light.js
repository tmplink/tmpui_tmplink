const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ colorScheme: 'light' });
  const page = await context.newPage();
  await page.goto('https://aura-share-beta.vercel.app/', { waitUntil: 'networkidle' });
  
  const css = await page.evaluate(() => {
    let output = '';
    for (let sheet of document.styleSheets) {
      try {
        for (let rule of sheet.cssRules) {
           if (rule.cssText.includes(':root') || rule.cssText.includes('light')) {
              output += rule.cssText + '\n';
           }
        }
      } catch (e) {}
    }
    return output;
  });
  console.log(css);
  await browser.close();
})();
