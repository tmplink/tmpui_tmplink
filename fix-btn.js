const fs = require('fs');

let css = fs.readFileSync('css/sponsor.css', 'utf-8');
css = css.replace(/body\.sponsor-mode \.vx-btn-primary\s*\{\s*background:\s*var\(--sponsor-gradient\);\s*border-color:\s*var\(--sponsor-gold-strong\);\s*color:\s*var\(--sponsor-btn-text\);\s*\}/, `body.sponsor-mode .vx-btn-primary {
    background: var(--sponsor-gradient);
    border-color: transparent;
    color: var(--sponsor-btn-text);
    box-shadow: rgba(255, 255, 255, 0.4) 0px 1px 0px 0px inset, rgba(200, 169, 124, 0.1) 0px 0px 10px 0px, rgba(0, 0, 0, 0.1) 0px 4px 8px 0px;
    border-radius: var(--vx-radius-full);
}

/* Also ensure forms inputs have warm borders rather than blue in light mode */
body.sponsor-mode .vx-input,
body.sponsor-mode .vx-textarea,
body.sponsor-mode .vx-select {
    border-color: var(--vx-border);
    background: var(--vx-surface);
    color: var(--vx-text);
}
body.sponsor-mode .vx-input:focus,
body.sponsor-mode .vx-textarea:focus,
body.sponsor-mode .vx-select:focus {
    border-color: var(--sponsor-gold-strong);
    box-shadow: 0 0 0 3px var(--sponsor-gold-soft);
}`);

css = css.replace(/body\.sponsor-mode \.vx-btn-primary:hover:not\(:disabled\)\s*\{\s*background:[^;]+;\s*border-color:\s*var\(--sponsor-gold-strong\);\s*color:\s*var\(--sponsor-btn-text\);\s*box-shadow:[^\}]+\}/, `body.sponsor-mode .vx-btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #fdf4e6 0%, #d8be9a 48%, #c8a97c 100%);
    border-color: transparent;
    color: var(--sponsor-btn-text);
    box-shadow: rgba(255, 255, 255, 0.5) 0px 1px 0px 0px inset, rgba(200, 169, 124, 0.3) 0px 0px 20px 0px, rgba(0, 0, 0, 0.2) 0px 8px 16px -4px;
}`);

// Update dark mode buttons explicitly if there are any overrides
fs.writeFileSync('css/sponsor.css', css);
console.log('Fixed btn');
