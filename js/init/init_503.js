app.ready(()=>{
    document.documentElement.classList.add('file-page');
    document.body.classList.add('file-page');

    if (typeof tmplink_api !== 'undefined') {
        window.TL = new tmplink_api();
        window.TL.ready(() => {
            window.TL.ga(document.title);
        });
        window.TL.keep_alive();
    }

    if (typeof isMobileScreen === 'function' && isMobileScreen()) {
        $('#tmpui_body').html(app.getFile('/tpl/503_mobile.html'));
    }
    app.languageBuild();
    $('title').html(app.languageData.title_503);
    $('meta[name=description]').html(app.languageData.des_503);
});
