const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://aura-share-beta.vercel.app/', { waitUntil: 'networkidle' });
  const data = await page.evaluate(() => {
    // try to find root variables or whatever style sponsor-mode has
    const styles = getComputedStyle(document.body);
    const vars = [
      '--sponsor-gold', '--sponsor-gold-strong', '--sponsor-gold-soft', 
      '--sponsor-glow', '--sponsor-border', '--sponsor-text', '--sponsor-gradient',
      '--vx-primary', '--vx-primary-hover', '--vx-primary-light', '--vx-primary-alpha'
    ];
    const res = {};
    vars.forEach(v => {
      res[v] = styles.getPropertyValue(v).trim();
    });
    
    // Also try checking the primary button colors if it's set on aura-share-beta root
    const rootStyles = getComputedStyle(document.documentElement);
    vars.forEach(v => {
      if(!res[v]) res[v] = rootStyles.getPropertyValue(v).trim();
    });
    
    return res;
  });
  console.log(JSON.stringify(data, null, 2));
  
  // Actually, maybe I need to check body class or switch to sponsor mode if there is one on aura-share-beta
  await page.evaluate(() => {
    document.body.classList.add('sponsor-mode');
  });
  
  const sponsorData = await page.evaluate(() => {
    const styles = getComputedStyle(document.body);
    const vars = [
      '--sponsor-gold', '--sponsor-gold-strong', '--sponsor-gold-soft', 
      '--sponsor-glow', '--sponsor-border', '--sponsor-text', '--sponsor-gradient',
      '--vx-primary', '--vx-primary-hover'
    ];
    const res = {};
    vars.forEach(v => {
      res[v] = styles.getPropertyValue(v).trim();
    });
    return res;
  });
  console.log("After adding sponsor-mode:", JSON.stringify(sponsorData, null, 2));

  // Let's also grab css text related to sponsor or root variables
  const cssRules = [];
  try {
     for (const sheet of document.styleSheets) {
       try {
         for (const rule of sheet.cssRules) {
           if (rule.selectorText && (rule.selectorText.includes('.sponsor-mode') || rule.selectorText.includes(':root'))) {
               cssRules.push(rule.cssText);
           }
         }
       } catch(e){}
     }
  } catch(e) {}
  
  console.log("CSS Rules:", cssRules.slice(0, 10).join('\n'));
  await browser.close();
})();
