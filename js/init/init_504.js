app.ready(()=>{
    document.documentElement.classList.add('file-page');
    document.body.classList.add('file-page');
    if (typeof isMobileScreen === 'function' && isMobileScreen()) {
        $('#tmpui_body').html(app.getFile('/tpl/504_mobile.html'));
    }
    app.languageBuild();
    $('title').html(app.languageData.title_504);
    $('meta[name=description]').html(app.languageData.des_504);
});
