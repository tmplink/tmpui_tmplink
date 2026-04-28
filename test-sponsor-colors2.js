const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://aura-share-beta.vercel.app/', { waitUntil: 'networkidle' });
  
  // Find all colored elements or style blocks which define CSS variables or something
  // Just dump out all CSS stylesheets from the page
  const css = await page.evaluate(() => {
    let output = '';
    for (let sheet of document.styleSheets) {
      try {
        for (let rule of sheet.cssRules) {
           if (rule.cssText.includes('--') || rule.cssText.includes('sponsor')) {
              output += rule.cssText + '\n';
           }
        }
      } catch (e) {}
    }
    return output;
  });
  
  require('fs').writeFileSync('aura-css.txt', css);
  await browser.close();
})();
