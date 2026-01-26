app.ready(()=>{
    document.documentElement.classList.add('file-page');
    document.body.classList.add('file-page');
    if (typeof isMobileScreen === 'function' && isMobileScreen()) {
        $('#tmpui_body').html(app.getFile('/tpl/403_mobile.html'));
    }
    app.languageBuild();
});
