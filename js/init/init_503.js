app.ready(()=>{
    setPageShellClasses(['file-page']);

    if (typeof tmplink_api !== 'undefined') {
        window.TL = new tmplink_api();
        window.TL.ready(() => {
            window.TL.ga(document.title);
        });
        window.TL.keep_alive();
    }

    if (typeof isMobileScreen === 'function' && isMobileScreen()) {
        app.getFilePrepared('/tpl/503_mobile.html').then((html) => {
            $('#tmpui_body').html(html);
            app.languageBuild();
            $('title').html(app.languageData.title_503);
            $('meta[name=description]').html(app.languageData.des_503);
        });
        return;
    }
    app.languageBuild();
    $('title').html(app.languageData.title_503);
    $('meta[name=description]').html(app.languageData.des_503);
});
