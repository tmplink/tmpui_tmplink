const fs = require('fs');
let css = fs.readFileSync('css/sponsor.css', 'utf-8');

// I also need to ensure that forms/inputs look good next to buttons
css += `
/* Add matching radius to all form inputs */
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
}
`;

fs.writeFileSync('css/sponsor.css', css);
