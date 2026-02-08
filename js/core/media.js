class media {

    parent = null
    allow_ext = ['mp4', 'm4v', 'rm', 'rmvb', 'webm', 'mkv', 'avi', 'ts', 'm2ts', 'mov']
    waitting_list = []
    current_play = 0;
    current_play_wait = 0;

    init(parent) {
        this.parent = parent;
    }

    is_allow(filename) {
        for (let i in this.allow_ext) {
            let ext = filename.substring(filename.lastIndexOf('.') + 1, filename.length);
            if (ext.toLowerCase().indexOf(this.allow_ext[i]) > -1) {
                return true;
            }
        }
        return false;
    }

    is_video_ok(id, sha1) {
        setTimeout(() => {
            $.post(this.parent.api_media, {
                action: 'is_video_ok',
                token: this.parent.api_token,
                id: id
            }, (rsp) => {
                if (rsp.status == 1) {
                    //remove form waitting list and refresh list
                    this.waitting_list.splice(this.waitting_list.indexOf(id), 1);
                    this.video_list();
                    this.parent.lazyload('.lazyload');
                } else {
                    this.is_video_ok(id, sha1);
                }
            }, 'json');
        }, 5000);
    }

    is_video_ok_check(data) {
        //prepare file is ok
        for (let i in data) {
            if (data[i].status !== 'ok') {
                $(`.video_ok_${data[i].id}`).attr('style', 'display: none !important;');
                this.is_video_ok(data[i].id, data[i].sha1);
                //check and add to waitting list
                if (this.waitting_list.indexOf(data[i].id) == -1) {
                    this.waitting_list.push(data[i].id);
                }
            } else {
                $(`.video_processing_${data[i].id}`).attr('style', 'display: none !important;');
                $(`#video_img_ok_${data[i].id}`).attr('preload-src', `https://static.${window.TL.site_domain}/media_img-${data[i].sha1}-360x220.jpg`);
            }
        }
        this.parent.lazyload('.lazyload');
    }

    video_add_on_list(ukey) {
        //锁定按钮
        let dom = '.add-to-media-' + ukey;
        let dombtn = '.add-to-media-btn-' + ukey;
        let dombtnc = 'add-to-media-btn-' + ukey;
        $(dom).attr('disabled', 'disabled');
        //修改图标为加载中
        $(dom).html(`<iconpark-icon name="spinner" class="fa-fw fa-spin text-red ${dombtnc}"></iconpark-icon>`);
        this.video_add(ukey, (status, text) => {
            //恢复图标
            $(dom).html(`<iconpark-icon name="youtube" class="fa-fw ${dombtnc}"></iconpark-icon>`);
            if (status) {
                $(dombtn).addClass('text-red');
            } else {
                alert(text);
            }
        });
    }

    video_can_play_open(ukey) {
        //需要登录
        if (!this.parent.isLogin()) {
            alert(this.parent.languageData.status_need_login);
            app.open('/login');
            return false;
        }
        $('#videoPlayerModal').modal('show');
        this.video_can_play(ukey);
    }

    video_can_play(ukey) {

        //当前正在处理
        if (this.current_play == ukey && this.current_play_wait == 0) {
            return false;
        }

        //如果有视频正在播放，停止播放
        if ($('#video_player_src').get(0).src) {
            //停止播放
            document.getElementById('video_player_src').pause();
            $('#video_player_src').removeAttr('src');
            $('#video_player').hide();
        }

        $('#video_preload').show();
        $('#video_player').hide();

        $('#video_status_icon_fail').hide();
        $('#video_status_icon_process').show();
        $('#video_status').html('正在处理');
        this.current_play = ukey;

        //如果当前等待的视频与当前播放的视频不一致，则退出等待
        if (this.current_play_wait !== ukey && this.current_play_wait !== 0) {
            this.current_play_wait = 0;
            return false;
        }

        $.post(this.parent.api_media, {
            action: 'video_can_play',
            token: this.parent.api_token,
            ukey: ukey
        }, (rsp) => {
            switch (rsp.status) {
                case 1:
                    this.current_play_wait = 0;
                    $('#video_preload').hide();
                    this.video_play(rsp.data.url,rsp.data.title);
                    break;
                case 2:
                    this.current_play_wait = ukey;
                    $('#video_status_icon_fail').hide();
                    $('#video_status_icon_process').show();
                    $('#video_status').html(this.parent.languageData.video_player_proccess);
                    setTimeout(() => {
                        this.video_can_play(ukey);
                    }, 5000);
                    break;
                case 3:
                    this.current_play_wait = 0;
                    $('#video_status_icon_process').hide();
                    $('#video_status_icon_fail').show();
                    $('#video_status').html(this.parent.languageData.video_player_fail);
                    break;
                case 0:
                    this.current_play_wait = 0;
                    $('#video_status_icon_process').hide();
                    $('#video_status_icon_fail').show();
                    alert(this.parent.languageData.status_need_login);
                    app.open('/login');
                    break;
            }
        });
    }

    video_play(src,title) {
        $('#video_player').show();
        //处理界面
        $('#video_player_src').attr('src', src);
        //视频就绪时自动播放
        $('#video_player_src').on('canplay', function () {
            $('#video_player_src').get(0).play();
        });
    }

    video_pause() {
        //如果视频正在播放，则暂停
        if ($('#video_player_src').get(0).src) {
            document.getElementById('video_player_src').pause();
        }
    }
}