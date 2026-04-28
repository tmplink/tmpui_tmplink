const fs = require('fs');

let css = fs.readFileSync('css/sponsor.css', 'utf-8');

css = css.replace(`body.dark-mode.sponsor-mode .vx-profile-edit .vx-btn-primary:hover,
html.vx-dark body.sponsor-mode .vx-profile-edit .vx-btn-primary:hover {
    background: #fff;
}
    background: rgba(255, 255, 255, 0.5);
    border-color: rgba(255, 255, 255, 0.6);
    transform: translateY(-1px);
}`, `body.dark-mode.sponsor-mode .vx-profile-edit .vx-btn-primary:hover,
html.vx-dark body.sponsor-mode .vx-profile-edit .vx-btn-primary:hover {
    background: #fff;
    border-color: #fff;
    transform: translateY(-1px);
}`);

fs.writeFileSync('css/sponsor.css', css);
console.log('Fixed syntax near line 415');
