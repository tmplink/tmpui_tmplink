const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://aura-share-beta.vercel.app/', { waitUntil: 'networkidle' });
  const btnStyle = await page.evaluate(() => {
    // We are looking for the primary button CSS. The image shows "开始上传".
    // Let's grab all button text and styles.
    const btns = Array.from(document.querySelectorAll('button, .btn, a'));
    return btns.map(b => ({
      text: b.innerText, 
      bg: window.getComputedStyle(b).background,
      br: window.getComputedStyle(b).borderRadius,
      shadow: window.getComputedStyle(b).boxShadow,
      color: window.getComputedStyle(b).color
    })).filter(b => b.text.includes('上传') || b.text.includes('确定'));
  });
  console.log(JSON.stringify(btnStyle, null, 2));
  await browser.close();
})();
