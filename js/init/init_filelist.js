/**
 * FileList Module Initialization
 * URL format: /?tmpui_page=/app&listview=filelist&mrid=xxx
 */
function INIT_filelist() {
    // Show loading immediately
    TL.loading_box_on();
    
    TL.ready(() => {
        FILELIST.init();
        app.languageBuild();
        $('title').html(app.languageData.filelist_title || app.languageData.title_room || '文件');
        $('meta[name=description]').html(app.languageData.des_room || '文件浏览器');
    });
}
