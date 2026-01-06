/**
 * このファイルは、ページが読み込まれたときに、対象のビュー情報を取得し、対応するページを読み込む役割を担っています。
 * @author CC2655
 * @version 1.0
 * @date 2022/12/21
 */
var dynamicView = new dynamic();
app.ready(() => {
    //写入自定义路由
    app.setCoustomRouter('/', ()=>{
        dynamicView.route();
    });

    let params = app.getUrlVars(window.location.href);
    switch (params.listview) {
        case 'preload':
            dynamicView.preload();
            break;
        case 'workspace':
            // workspace 已废弃，重定向到 room
            dynamicView.room();
            break;
        case 'room':
            dynamicView.room();
            break;
        case 'direct':
            dynamicView.direct();
            break;
        case 'login':
            dynamicView.login();
            break;
        case 'reg':
            dynamicView.reg();
            break;
        case 'reset':
            dynamicView.reset();
            break;
        case 'tos':
            dynamicView.tos();
            break;
        case 'privacy':
            dynamicView.privacy();
            break;
        case 'notes':
            dynamicView.notes();
            break;
        case 'ai':
            dynamicView.ai();
            break;
        case 'photo':
            dynamicView.photo();
            break;
        default:
            dynamicView.index();
    }
});
