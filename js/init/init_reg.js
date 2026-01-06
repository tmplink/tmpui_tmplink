function INIT_reg() {
    TL.ready(() => {
        app.languageBuild();
        $('title').html(app.languageData.title_reg);
        $('meta[name=description]').html(app.languageData.des_reg);
        if (TL.isLogin()) {
            // 已登录，跳转到 room 页面
            app.open('/app&listview=room&mrid=0');
        }
    });
}
