const fs = require('fs');
let css = fs.readFileSync('css/sponsor.css', 'utf-8');

// I'll make sure secondary, ghost, and outline buttons get a pill shape explicitly, 
// and fix their borders to look smooth like the primary button, but keeping their outline nature.
if (!css.includes('/* Also ensure all secondary forms inputs have smooth borders */')) {
    css += `\n/* Also ensure all secondary forms inputs have smooth borders */\nbody.sponsor-mode .vx-btn-secondary,\nbody.sponsor-mode .vx-btn-outline,\nbody.sponsor-mode .vx-btn-ghost {\n    border-radius: 999px !important;\n}\n`;
}

css = css.replace(/body\.sponsor-mode \.vx-btn-secondary \{([^}]*)\}/g, 'body.sponsor-mode .vx-btn-secondary {$1    border-radius: 999px !important;\n}');
css = css.replace(/body\.sponsor-mode \.vx-btn-outline \{([^}]*)\}/g, 'body.sponsor-mode .vx-btn-outline {$1    border-radius: 999px !important;\n}');
css = css.replace(/body\.sponsor-mode \.vx-btn-ghost \{([^}]*)\}/g, 'body.sponsor-mode .vx-btn-ghost {$1    border-radius: 999px !important;\n}');

// To fix some specific buttons, let's see if there's any other global btn overrides.
fs.writeFileSync('css/sponsor.css', css);
