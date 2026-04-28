const fs = require('fs');
let css = fs.readFileSync('css/sponsor.css', 'utf-8');

// Replace the transparent border and background-clip that exposes the background page color
css = css.replace(/border:\s*1px\s*solid\s*transparent\s*!important;\n\s*background-clip:\s*padding-box\s*!important;/g, 'border: none !important;');

fs.writeFileSync('css/sponsor.css', css);
console.log('Fixed white ring issue by removing the transparent border completely.');
