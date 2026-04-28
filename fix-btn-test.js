const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const css = fs.readFileSync('css/sponsor.css', 'utf8');
  const vxuiCss = fs.readFileSync('css/vxui/vxui.css', 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`
    <html>
      <head>
        <style>
          ${vxuiCss}
          ${css}
          body { background: #fdfbf7; padding: 50px; font-family: sans-serif; display: flex; justify-content: center; }
        </style>
      </head>
      <body class="sponsor-mode">
        <button class="vx-btn vx-btn-primary">
          <svg style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;margin-right:2px"><polyline points="20 6 9 17 4 12"></polyline></svg>
          确定
        </button>
      </body>
    </html>
  `);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-button.png' });
  await browser.close();
})();
