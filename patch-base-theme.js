const fs = require('fs');

let css = fs.readFileSync('css/sponsor.css', 'utf-8');

// Update light mode variables
css = css.replace(/body\.sponsor-mode\s*\{/, `body.sponsor-mode {
    /* Override VXUI base colors to warm/neutral (remove bluish tint) */
    --vx-primary: var(--sponsor-gold-strong);
    --vx-primary-hover: var(--sponsor-gold);
    --vx-primary-light: var(--sponsor-gold-soft);
    --vx-primary-alpha: rgba(200, 169, 124, 0.08);
    
    --vx-bg: #fdfbf7;
    --vx-bg-secondary: #f4f1ea;
    --vx-surface: #ffffff;
    --vx-surface-hover: #fcfaf6;
    --vx-surface-active: #f4f1ea;
    
    --vx-border: #e8e3d9;
    --vx-border-hover: #d5cec0;
    
    --vx-text: #2d2620;
    --vx-text-secondary: #6e655b;
    --vx-text-muted: #9e958a;
    
    --vx-sidebar-bg: #fdfbf7;
    --vx-header-bg: #fdfbf7;
`);

// Update dark mode variables
css = css.replace(/body\.dark-mode\.sponsor-mode,\s*html\.vx-dark body\.sponsor-mode\s*\{/, `body.dark-mode.sponsor-mode,
html.vx-dark body.sponsor-mode {
    /* Override VXUI base colors to true black/warm-dark (remove dark blue tint) */
    --vx-primary: var(--sponsor-gold-strong);
    --vx-primary-hover: var(--sponsor-gold);
    --vx-primary-light: var(--sponsor-gold-soft);
    --vx-primary-alpha: rgba(200, 169, 124, 0.08);
    
    --vx-bg: #090908;
    --vx-bg-secondary: #131210;
    --vx-surface: #181614;
    --vx-surface-hover: #221f1c;
    --vx-surface-active: #2e2a26;
    
    --vx-border: #2e2a26;
    --vx-border-hover: #403a35;
    
    --vx-text: #f0ebe1;
    --vx-text-secondary: #9e958a;
    --vx-text-muted: #6e655b;
    
    --vx-sidebar-bg: #090908;
    --vx-header-bg: #090908;
`);

fs.writeFileSync('css/sponsor.css', css);
console.log('Base theme updated');
