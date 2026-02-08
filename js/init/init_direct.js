function INIT_direct() {
    TL.ready(() => {
        //判断是否登录
        if (TL.isLogin() === false) {
            //跳转到登录页面
            app.open('/login');
            return;
        }
        TL.direct.init_details(()=>{
            // 使用autoLoader，不需要单独调用list_autoload_enabled
            TL.direct.filelist(0);
            TL.direct.open();
            TL.direct.prepare();
        });
        app.languageBuild();
        $('meta[name=description]').html(app.languageData.title_direct);
        $('title').html(app.languageData.title_direct);
    });
}
