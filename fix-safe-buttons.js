const fs = require('fs');
let css = fs.readFileSync('css/sponsor.css', 'utf-8');

if (!css.includes('/* Re-add explicit button classes for pill shape */')) {
    css += `\n\n/* Re-add explicit button classes for pill shape, omitting raw 'button' tag */
body.sponsor-mode .vx-btn,
body.sponsor-mode .vx-btn-primary,
body.sponsor-mode .vx-btn-secondary,
body.sponsor-mode .vx-btn-outline,
body.sponsor-mode .vx-btn-ghost,
body.sponsor-mode .vx-action-btn {
    border-radius: 999px !important;
}\n`;
}

fs.writeFileSync('css/sponsor.css', css);
console.log('Added safe button targeting for pill shapes.');
