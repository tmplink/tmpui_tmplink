class stream {

    parent = null;
    allow_ext = [];
    canplay_list = [
        ['video/mp4','mp4'],
        ['video/webm','webm'],
        ['video/ogg','ogg'],
        ['video/quicktime','mov'],
        ['video/3gpp','3gp'],
        ['video/mpeg','mpeg'],
    ];
    open_on_apps_ext = ['mp4','webm','ogg','mov','3gp','mpeg','mkv','rm','rmvb','avi','m4v','flv','wmv','mpv'];
    waitting_list = [];
    current_stream = 0;
    current_stream_wait = 0;

    init(parent) {
        this.parent = parent;
        this.checkCanPlay();
    }

    checkCanPlay(){
        let video = document.createElement('video');
        let canplay = '';
        for (let i in this.canplay_list) {
            canplay = video.canPlayType(this.canplay_list[i][0]);
            if (canplay==='probably'||canplay==='maybe') {
                this.allow_ext.push(this.canplay_list[i][1]);
            }
        }
    }

    checkForOpenOnApps(filename,owner){
        if (this.parent.logined !== 1) {
            return false;
        }
        if (owner!==this.parent.uid) {
            if(this.parent.sponsor===false){
                return false;
            }
        }
        for (let i in this.open_on_apps_ext) {
            let ext = filename.substring(filename.lastIndexOf('.') + 1, filename.length);
            if (ext.toLowerCase().indexOf(this.open_on_apps_ext[i]) > -1) {
                return true;
            }
        }
        return false;
    }

    allow(filename,owner) {
        if (this.parent.logined !== 1) {
            return false;
        }
        
        // if (owner!=this.parent.uid) {
        //     if(this.parent.sponsor===false){
        //         return false;
        //     }
        // }

        //is isSponsor
        if(this.parent.sponsor===false){
            return false;
        }
        
        if(this.allow_ext.length==0){
            return false;
        }

        for (let i in this.allow_ext) {
            let ext = filename.substring(filename.lastIndexOf('.') + 1, filename.length);
            if (ext.toLowerCase().indexOf(this.allow_ext[i]) > -1) {
                return true;
            }
        }
        return false;
    }

    
    request(ukey,app) {
        //未登录的情况下，跳转到登录界面
        if (this.parent.logined !== 1) {
            location.href = '/?tmpui_page=/app&listview=login';
            return;
        }

        //显示载入动画
        $('#loading_box').fadeIn();
        this.parent.recaptcha_do('stream_req', (recaptcha) => {
            $.post(this.parent.api_file, {
                action: 'stream_req',
                ukey: ukey,
                token: this.parent.api_token,
                captcha: recaptcha
            }, (req) => {
                $('#loading_box').fadeOut();
                if (req.status == 1) {
                    // let player = 'http://play.5t-cdn.com/?stream=' + btoa(req.data);
                    this.playWith(req.data,app);
                } else {
                    alert('error');
                }
            }, 'json');
        });
    }

    async playWith(url,apps){
        switch(apps){
            case 'vlc':
                this.openWithVLC(url);
                break;
            case 'iina':
                this.openWithIINA(url);
                break;
            case 'potplayer':
                this.openWithPotPlayer(url);
                break;
            case 'kmplayer':
                this.openWithKMPlayer(url);
                break;
            case 'nplayer':
                this.openWithNplayer(url);
                break;
            case 'copy':
                $.notifi(app.languageData.copied, "success");
                await copyToClip(url);
                break;
            default:
                this.play(url);
        }
        $('#openWithPlayerModal').modal('off');
    }

    openWithVLC(url){
        window.location.href = 'vlc://' + url;
    }

    openWithIINA(url){
        window.location.href = 'iina://weblink?url=' + url;
    }

    openWithPotPlayer(url){
        window.location.href = 'potplayer://' + url;
    }

    openWithKMPlayer(url){
        window.location.href = 'kmplayer://' + url;
    }

    openWithNplayer(url){
        window.location.href = 'nplayer-https://' + url;
    }
    
    play(url){
        //通过新标签页打开
        let player = 'https://ix.ng-ccc.com/go.html?stream=' + btoa(url);
        window.open(player, '_blank');
    }
}
