const fs = require('fs');
let css = fs.readFileSync('css/sponsor.css', 'utf-8');

// Replace border: none !important back to border: 1px solid transparent !important; background-clip: padding-box !important;
css = css.replace(/border:\s*none\s*!important;/g, 'border: 1px solid transparent !important;\n    background-clip: padding-box !important;');

fs.writeFileSync('css/sponsor.css', css);
console.log('Fixed layout size issues with background-clip: padding-box');
