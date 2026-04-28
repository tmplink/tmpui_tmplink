const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://aura-share-beta.vercel.app/', { waitUntil: 'networkidle' });
  const data = await page.evaluate(async () => {
    const btns = Array.from(document.querySelectorAll('button, a'));
    const uploadBtn = btns.find(b => b.innerText.includes('上传'));
    if(!uploadBtn) return null;
    
    // get normal style
    const norm = window.getComputedStyle(uploadBtn).boxShadow;
    const normBg = window.getComputedStyle(uploadBtn).backgroundImage;
    
    // force hover by dispatching events or using playwright
    return { norm, normBg };
  });
  
  // Actually wait, I can use Playwright's hover
  await page.hover('text=上传');
  const hoverData = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a'));
    const uploadBtn = btns.find(b => b.innerText.includes('上传'));
    return {
      boxShadow: window.getComputedStyle(uploadBtn).boxShadow,
      backgroundImage: window.getComputedStyle(uploadBtn).backgroundImage,
      transform: window.getComputedStyle(uploadBtn).transform
    };
  });
  console.log(JSON.stringify(hoverData, null, 2));
  await browser.close();
})();
