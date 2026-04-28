const fs = require('fs');
let css = fs.readFileSync('css/sponsor.css', 'utf-8');

// The screenshot shows an input field ("绑定的邮箱/手机号" like box) next to a "发送验证码" button. 
// Standardizing input and button shapes together. We shouldn't make inputs 999px because it looks bad. Let's just make the secondary buttons look good. 

// The user is asking about "其它的按钮呢" (what about other buttons). They specifically sent a screenshot of "发送验证码" and "绑定谷歌账号", which are secondary/outline buttons. They probably are still rectangular in the UI despite the global .vx-btn override, possibly because the form css overrides it elsewhere or the global override didn't have enough specificity.

// Wait, let's fix the duplicated border-radius first.
css = css.replace(/border-radius:\s*999px\s*!important;\s*border-radius:\s*999px\s*!important;/g, 'border-radius: 999px !important;');

// I'll make sure the form input inputs matches perfectly if they're grouped with a button
css += `
/* Ensure all buttons globally use pill shape in sponsor mode */
body.sponsor-mode .vx-btn,
body.sponsor-mode .vx-btn-primary,
body.sponsor-mode .vx-btn-secondary,
body.sponsor-mode .vx-btn-outline,
body.sponsor-mode .vx-btn-ghost,
body.sponsor-mode .vx-action-btn,
body.sponsor-mode button {
    border-radius: 999px !important;
}

/* For inputs that are paired with buttons (like send verification code), keep input rounded slightly to match pill design aesthetic optionally */
body.sponsor-mode .vx-input-group .vx-input {
    border-radius: 12px;
}
`;

fs.writeFileSync('css/sponsor.css', css);
