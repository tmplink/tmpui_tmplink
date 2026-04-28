const fs = require('fs');

let css = fs.readFileSync('css/sponsor.css', 'utf-8');

css = css.replace(/body\.sponsor-mode\s*\{\s*--sponsor-gold:[^}]+\}/, `body.sponsor-mode {
    --sponsor-gold: #c8a97c;
    --sponsor-gold-strong: #b88d54;
    --sponsor-gold-soft: rgba(200, 169, 124, 0.15);
    --sponsor-glow: rgba(200, 169, 124, 0.3);
    --sponsor-border: rgba(200, 169, 124, 0.4);
    --sponsor-text: #9a7545;
    --sponsor-gradient: linear-gradient(135deg, #f5e9d7 0%, #c8a97c 48%, #b88d54 100%);
    --sponsor-btn-text: #0a0d14;
}`);

css = css.replace(/body\.dark-mode\.sponsor-mode,\s*html\.vx-dark body\.sponsor-mode\s*\{\s*--sponsor-gold:[^}]+\}/, `body.dark-mode.sponsor-mode,
html.vx-dark body.sponsor-mode {
    --sponsor-gold: #e1c699;
    --sponsor-gold-strong: #c8a97c;
    --sponsor-gold-soft: rgba(200, 169, 124, 0.15);
    --sponsor-glow: rgba(200, 169, 124, 0.3);
    --sponsor-border: rgba(200, 169, 124, 0.45);
    --sponsor-text: #f5e9d7;
    --sponsor-gradient: linear-gradient(135deg, #f5e9d7 0%, #c8a97c 48%, #b88d54 100%);
    --sponsor-btn-text: #0a0d14;
}`);

// update buttons that have background: var(--sponsor-gradient) to use --sponsor-btn-text instead of --sponsor-text
css = css.replace('body.sponsor-mode .vx-btn-primary {\n    background: var(--sponsor-gradient);\n    border-color: var(--sponsor-gold-strong);\n    color: var(--sponsor-text);\n}', `body.sponsor-mode .vx-btn-primary {
    background: var(--sponsor-gradient);
    border-color: var(--sponsor-gold-strong);
    color: var(--sponsor-btn-text);
}`);

css = css.replace('body.sponsor-mode .vx-btn-primary:hover:not(:disabled) {\n    background: linear-gradient(135deg, #fbe08e 0%, #f7c55c 55%, #f59e0b 100%);\n    border-color: var(--sponsor-gold-strong);\n}', `body.sponsor-mode .vx-btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #fdf4e6 0%, #d8be9a 48%, #c8a97c 100%);
    border-color: var(--sponsor-gold-strong);
    color: var(--sponsor-btn-text);
    box-shadow: rgba(255, 255, 255, 0.5) 0px 1px 0px 0px inset, rgba(200, 169, 124, 0.3) 0px 0px 20px 0px, var(--sponsor-glow) 0 6px 16px -4px;
}`);

// fix badge sponsor
css = css.replace('body.sponsor-mode .vx-badge-sponsor,\nbody.sponsor-mode .publisher-badge {\n    background: var(--sponsor-gradient);\n    color: var(--sponsor-text);\n    box-shadow: 0 8px 18px -10px var(--sponsor-glow);\n}', `body.sponsor-mode .vx-badge-sponsor,
body.sponsor-mode .publisher-badge {
    background: var(--sponsor-gradient);
    color: var(--sponsor-btn-text);
    box-shadow: 0 8px 18px -10px var(--sponsor-glow);
}`);

css = css.replace('color: var(--sponsor-text);\n    background: var(--sponsor-gradient);', `color: var(--sponsor-btn-text);\n    background: var(--sponsor-gradient);`);

fs.writeFileSync('css/sponsor.css', css);
console.log('Patched');
