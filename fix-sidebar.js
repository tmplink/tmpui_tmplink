const fs = require('fs');
let css = fs.readFileSync('css/sponsor.css', 'utf-8');

// The vxui.css uses `.vx-sidebar` or `.vx-layout` classes which we need to override the background for.
css = css.replace(/--vx-sidebar-bg:\s*[^;]+;/g, function(match) {
    if (match.includes('#fdfbf7')) return '--vx-sidebar-bg: #f5f2eb;'; // Slightly darker side in light mode
    if (match.includes('#090908')) return '--vx-sidebar-bg: #090908;';
    return match;
});

// Since the whole body may have a hardcoded standard #1e293b dark background if .vx-dark is set, force the whole HTML background if needed:
if (!css.includes('html.vx-dark body.sponsor-mode .vx-sidebar')) {
    css += `\n
/* Complete background overrides for elements that might have hardcoded backgrounds */
body.sponsor-mode .vx-sidebar {
    background: var(--vx-sidebar-bg) !important;
}

body.sponsor-mode .vx-layout {
    background: var(--vx-bg) !important;
}

html.vx-dark body.sponsor-mode {
    background: var(--vx-bg) !important;
}

body.sponsor-mode {
    background: var(--vx-bg) !important;
}
`;
}

fs.writeFileSync('css/sponsor.css', css);
console.log('Fixed possible hardcoded background issues');
