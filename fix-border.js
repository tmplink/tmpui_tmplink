const fs = require('fs');
let css = fs.readFileSync('css/sponsor.css', 'utf-8');

// Replace any remaining border-color: transparent with border: none
css = css.replace(/border-color:\s*transparent;/g, 'border: none;');

// Increase border-radius to 99px to make it pill-shaped like aura-share
css = css.replace(/body\.sponsor-mode \.vx-btn-primary \{/g, `body.sponsor-mode .vx-btn-primary {\n    border-radius: 99px;`);

// Specifically target .vx-btn-primary for the border remove to ensure it applies universally
if (!css.includes('border-radius: 99px')) {
    css += `\n\nbody.sponsor-mode .vx-btn-primary {\n    border: none;\n    border-radius: 99px;\n}\n`;
}

// Ensure the border removal wins out over default vxui border
css = css.replace(/border:\s*none;/g, 'border: none !important;');

fs.writeFileSync('css/sponsor.css', css);
console.log('Border and radius fixed.');
