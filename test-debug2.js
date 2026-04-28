const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://aura-share-beta.vercel.app/', { waitUntil: 'networkidle' });
  const data = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a'));
    const uploadBtn = btns.find(b => b.innerText.includes('上传'));
    if(!uploadBtn) return null;
    const style = window.getComputedStyle(uploadBtn);
    return {
      classes: uploadBtn.className,
      background: style.background,
      backgroundColor: style.backgroundColor, // sometimes background isn't parsed
      backgroundImage: style.backgroundImage,
      border: style.border,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      color: style.color,
      fontWeight: style.fontWeight,
      height: style.height,
      padding: style.padding,
      transition: style.transition
    };
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();
