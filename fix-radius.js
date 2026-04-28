const fs = require('fs');
let css = fs.readFileSync('css/sponsor.css', 'utf-8');

// Ensure all sponsor buttons are pill-shaped
if (!css.includes('body.sponsor-mode .vx-btn {')) {
    css += `\n/* Make all buttons pill-shaped to match Aura-Share */\nbody.sponsor-mode .vx-btn {\n    border-radius: 999px !important;\n}\n`;
}

css = css.replace(/border-radius:\s*99px;/g, 'border-radius: 999px;');

fs.writeFileSync('css/sponsor.css', css);
console.log('Fixed radius');
