function INIT_reset() {
    TL.ready(()=>{
        app.languageBuild();
        $('title').html(app.languageData.title_reset);
        $('meta[name=description]').html(app.languageData.des_reset);
        if (TL.isLogin()) {
            // 已登录，跳转到 room 页面
            app.open('/app&listview=room&mrid=0');
        }    
    });
    
}
