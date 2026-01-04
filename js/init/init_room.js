function INIT_room(){
    // 立即显示加载图标
    TL.loading_box_on();
    
    TL.ready(() => {
        TL.dir.open(0);
        TL.dir_list_autoload_enabled();
        $('.nav_upload').attr('disabled', true);
        app.languageBuild();
        $('title').html( app.languageData.title_room);
        $('meta[name=description]').html(app.languageData.des_room);
    });
}
