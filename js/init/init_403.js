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
        app.getFilePrepared('/tpl/403_mobile.html').then((html) => {
            $('#tmpui_body').html(html);
            app.languageBuild();
        });
        return;
    }
    app.languageBuild();
});
