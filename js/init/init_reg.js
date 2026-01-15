function INIT_reg() {
    if (typeof TL !== 'undefined' && TL.loading_box_off) {
        TL.loading_box_off();
    }
    TL.ready(() => {
        if (typeof TL !== 'undefined' && TL.loading_box_off) {
            TL.loading_box_off();
        }
        app.languageBuild();
        $('title').html(app.languageData.title_reg);
        $('meta[name=description]').html(app.languageData.des_reg);
        if (TL.isLogin()) {
            // 已登录，跳转到 room 页面
            app.open('/app&listview=room&mrid=0');
        }
    });
}
