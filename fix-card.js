const fs = require('fs');
let css = fs.readFileSync('css/sponsor.css', 'utf-8');

// Also update .vx-surface elements if needed:
if (!css.includes('.vx-card {')) {
    css += `\n
body.sponsor-mode .vx-card {
    background: var(--vx-surface);
    border-color: var(--vx-border);
}
`;
}
fs.writeFileSync('css/sponsor.css', css);
console.log('Fixed cards');
