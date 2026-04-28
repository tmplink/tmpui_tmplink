const fs = require('fs');
let css = fs.readFileSync('css/sponsor.css', 'utf-8');

// Make specific buttons that were collateral damage inside cards normal again
if (!css.includes('/* Restore vx-copy-style-card shape */')) {
    css += `\n/* Restore vx-copy-style-card shape */\nbody.sponsor-mode .vx-copy-style-card {\n    border-radius: var(--vx-radius) !important;\n}\n`;
}

fs.writeFileSync('css/sponsor.css', css);
console.log('Restored specific UI elements affected by excessive targeting.');
