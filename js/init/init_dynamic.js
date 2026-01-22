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
        case 'workspace': {
            const mrid = (params.mrid !== undefined) ? params.mrid : '0';
            window.location.href = `/?tmpui_page=/vx&module=filelist&mrid=${mrid}`;
            break;
        }
        case 'room': {
            const mrid = (params.mrid !== undefined) ? params.mrid : '0';
            window.location.href = `/?tmpui_page=/vx&module=filelist&mrid=${mrid}`;
            break;
        }
        case 'direct':
            window.location.href = '/?tmpui_page=/vx&module=direct';
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
            window.location.href = '/?tmpui_page=/vx&module=notes';
            break;
        case 'ai':
            window.location.href = '/?tmpui_page=/vx&module=ai';
            break;
        case 'photo': {
            const photoMrid = (params.mrid !== undefined) ? params.mrid : '0';
            const mode = (params.mode !== undefined) ? params.mode : '';
            const modeParam = mode ? `&mode=${encodeURIComponent(mode)}` : '';
            window.location.href = `/?tmpui_page=/vx&module=filelist&view=album&mrid=${photoMrid}${modeParam}`;
            break;
        }
        default:
            window.location.href = '/?tmpui_page=/vx';
    }
});
