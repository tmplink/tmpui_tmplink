function INIT_login() {
    TL.ready(() => {
        app.languageBuild();
        $('title').html(app.languageData.title_login);
        $('meta[name=description]').html(app.languageData.des_login);

        //如果是从 menubarx 过来的应用，隐藏第三方登录
        let mx = localStorage.getItem('from_menubarx');
        if (mx==='1') {
            $('#google_login').hide();
        }

        if (TL.isLogin()) {
            // 已登录，跳转到 VXUI 页面
            app.open('/vx');
        }else{
            //初始化谷歌登陆按钮
            TL.oauth.google_login();
        }

        // $('.area_global').remove();

        //如果在国内，则对界面进行调整
        if(TL.area_cn){
            //将谷歌登录移动到最下面
            $('.area_global').remove();
        }else{
            $('.area_cn').remove();
        }
    });
}   
