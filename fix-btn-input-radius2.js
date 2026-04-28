const fs = require('fs');
let css = fs.readFileSync('css/sponsor.css', 'utf-8');

// Make sure inputs look cohesive with 999px buttons
// Actually, making input box 12px or 999px depending on context. Let's make input fields rounded to match
// the button pill shape (radius 16px is a good balance for inputs when buttons are pill shaped)

css = css.replace(/border-radius:\s*12px;/g, 'border-radius: 16px;');

// What about vx-list-item or file items?
// I want to make sure I ONLY target buttons.

fs.writeFileSync('css/sponsor.css', css);
