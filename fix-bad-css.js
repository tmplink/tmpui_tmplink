const fs = require('fs');
let css = fs.readFileSync('css/sponsor.css', 'utf-8');

// Target the bad block
const badBlock1 = `/* Ensure all buttons globally use pill shape in sponsor mode */
body.sponsor-mode .vx-btn,
body.sponsor-mode .vx-btn-primary,
body.sponsor-mode .vx-btn-secondary,
body.sponsor-mode .vx-btn-outline,
body.sponsor-mode .vx-btn-ghost,
body.sponsor-mode .vx-action-btn,
body.sponsor-mode button {
    border-radius: 999px !important;
}`;

css = css.replace(badBlock1, `/* Removed bad global button override */`);

// Remove the input 999px
const badBlock2 = `/* Add matching radius to all form inputs */
body.sponsor-mode .vx-input,
body.sponsor-mode .vx-textarea,
body.sponsor-mode .vx-select {
    border-radius: 999px; /* Give them pill shape to match! */
    padding-left: 20px;
    padding-right: 20px;
}
/* Fix specifically textarea */
body.sponsor-mode .vx-textarea {
    border-radius: 16px;
}`;

css = css.replace(badBlock2, `/* Removed bad input override */`);

fs.writeFileSync('css/sponsor.css', css);
console.log('Fixed globally bad CSS properties.');
