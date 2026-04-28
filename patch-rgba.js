const fs = require('fs');

let css = fs.readFileSync('css/sponsor.css', 'utf-8');

// Replace colors
css = css.replace(/245,\s*197,\s*66/g, '200, 169, 124');
css = css.replace(/245,\s*158,\s*11/g, '184, 141, 84');
css = css.replace(/251,\s*191,\s*36/g, '225, 198, 153');

// Replace hex if any left
css = css.replace(/#f5c542/gi, '#c8a97c');
css = css.replace(/#f59e0b/gi, '#b88d54');
css = css.replace(/#fbbf24/gi, '#e1c699');
css = css.replace(/#fbe08e/gi, '#f0dfc8');
css = css.replace(/#f7c55c/gi, '#d8be9a');
css = css.replace(/rgba\(93,\s*64,\s*55/gi, 'rgba(139, 102, 59'); // dark brown text replaced with deep gold

fs.writeFileSync('css/sponsor.css', css);
console.log('Colors replaced in sponsor.css');
