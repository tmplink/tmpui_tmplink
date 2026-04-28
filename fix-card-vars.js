const fs = require('fs');
let css = fs.readFileSync('css/sponsor.css', 'utf-8');

// I'll make sure there is no explicit blue left
// Dark blue check: #1e293b, #0f172a, #334155, #f8fafc, #f1f5f9
css = css.replace(/#1e293b/gi, '#181614');
css = css.replace(/#0f172a/gi, '#090908');
css = css.replace(/#334155/gi, '#221f1c');
css = css.replace(/#f8fafc/gi, '#fdfbf7');
css = css.replace(/#f1f5f9/gi, '#f4f1ea');
css = css.replace(/#e2e8f0/gi, '#e8e3d9');
css = css.replace(/#cbd5e1/gi, '#d5cec0');
css = css.replace(/#64748b/gi, '#6e655b');
css = css.replace(/#94a3b8/gi, '#9e958a');

// Apply it:
fs.writeFileSync('css/sponsor.css', css);
console.log('Fixed hardcoded slate/blue colors inside sponsor mode context');

