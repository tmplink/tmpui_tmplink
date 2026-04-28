const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://aura-share-beta.vercel.app/', { waitUntil: 'networkidle' });
  
  const buttons = await page.evaluate(() => {
    let mainBtn = document.querySelector('.button:not(.button-secondary):not(.button-ghost)');
    if (!mainBtn) mainBtn = document.querySelector('button');
    
    if (mainBtn) {
      let styles = window.getComputedStyle(mainBtn);
      return {
         background: styles.background,
         backgroundColor: styles.backgroundColor,
         color: styles.color,
         borderColor: styles.borderColor,
         boxShadow: styles.boxShadow,
         className: mainBtn.className
      }
    }
    return null;
  });
  console.log(buttons);

  await browser.close();
})();
