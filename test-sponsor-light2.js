const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://aura-share-beta.vercel.app/', { waitUntil: 'networkidle' });
  
  // Click theme toggle if it exists?
  const handles = await page.$$('button, a, div');
  for (let h of handles) {
      const text = await h.textContent();
      if (text && (text.includes('Light') || text.includes('Dark') || text.includes('Theme') || text.includes('日间') || text.includes('夜间') || text.includes('浅色') || text.includes('深色'))) {
          console.log("Found theme toggle:", text);
          await h.click();
          await page.waitForTimeout(1000);
      }
  }

  const css = await page.evaluate(() => {
    let output = '';
    for (let sheet of document.styleSheets) {
      try {
        for (let rule of sheet.cssRules) {
           if (rule.cssText.includes('light-theme') || rule.cssText.includes('[data-theme="light"]') || rule.cssText.includes('.light')) {
              output += rule.cssText + '\n';
           }
        }
      } catch (e) {}
    }
    return output;
  });
  console.log("Light theme CSS:", css);
  
  const rootVars = await page.evaluate(() => {
     let el = document.documentElement;
     return getComputedStyle(el).getPropertyValue('--bg');
  });
  console.log("Current body bg:", rootVars);

  await browser.close();
})();
