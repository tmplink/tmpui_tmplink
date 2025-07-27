class uploader {
    parent_op = null

    skip_upload = false
    prepare_sha1 = false
    mr_id = 0
    upload_count = 0
    upload_queue_id = 0
    upload_queue_file = []
    upload_processing = 0
    single_file_size = 50 * 1024 * 1024 * 1024
    slice_size = 3 * 1024 * 1024;
    max_sha1_size = 256 * 1024 * 1024;

    upload_queue = 0;
    upload_queue_max = 5;

    // 新增：实际运行时使用的变量
    _internal_queue_max = 1;
    _internal_worker_max = 1;

    active_uploads = 0;
    upload_speeds = {};
    speed_update_interval = null;

    speed_chart = null;
    speed_data = [];
    speed_labels = [];
    chart_update_interval = null;
    chart_visible = false;
    total_uploaded_data = 0;

    // 单个文件的上传线程数
    upload_worker_queue = [];
    upload_worker_queue_max = 5;

    upload_slice_chunk = [] //记录每个文件的总上传量
    upload_slice_total = [] //文件上传线程计数器
    upload_slice_process = [] //当前处理进度

    upload_file_progress = {}; // 格式: { id: { total: 文件总大小, uploaded: 已上传字节数 } }

    init(parent_op) {
        this.check_upload_clean_btn_status();
        this.parent_op = parent_op;
        //如果已经渲染了 upload_speed_chart，那么初始化图表
        let chart = document.getElementById('upload_speed_chart');
        if (chart) {
            this.initSpeedChart();
        }
        // 初始化累计上传数据计数器
        this.total_uploaded_data = 0;
    }

    clean_upload_finish_list() {
        $('#upload_model_box_finish').html('');
        $('.upload_model_box_finish_clean').hide();
    }

    check_upload_clean_btn_status() {
        let content = $('#upload_model_box_finish').html();
        if (content === undefined) {
            return false;
        }
        if (content.length > 0) {
            $('.upload_model_box_finish_clean').show();
        } else {
            $('.upload_model_box_finish_clean').hide();
        }
    }

    init_upload_pf() {
        $.post(this.parent_op.api_user, {
            'action': 'pf_upload_get',
            'token': this.parent_op.api_token
        }, (rsp) => {
            if (rsp.status === 1) {
                this.upload_worker_queue_max = rsp.data.upload_slice_thread_max;
                this.upload_queue_max = rsp.data.upload_slice_queue_max;
                //upload_slice_size不能大于80
                if (rsp.data.upload_slice_size > 80) {
                    rsp.data.upload_slice_size = 80;
                }
                this.slice_size = rsp.data.upload_slice_size * (1024 * 1024);
                //更新到界面
                $('#upload_slice_size').val(rsp.data.upload_slice_size);
                $('#upload_slice_queue_max').val(rsp.data.upload_slice_queue_max);
                $('#upload_slice_thread_max').val(rsp.data.upload_slice_thread_max);
                //更新设定
                this.quickUploadInit();
                this.model_selected(0);
            }
        }, 'json').fail((xhr, textStatus, errorThrown) => {
            let errorMessage = '获取上传配置失败';
            if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = xhr.responseJSON.message;
            } else if (textStatus) {
                errorMessage = `配置获取失败: ${textStatus}`;
            }
            alert(errorMessage);
        });
        //初始化上传服务器列表
        this.parent_op.recaptcha_do('upload_request_select2', (captcha) => {
            let server_list = [];
            $.post(this.parent_op.api_url_upload, {
                'token': this.parent_op.api_token,
                'action': 'upload_request_select2',
                'captcha': captcha
            }, (rsp) => {
                if (rsp.status === 1) {
                    server_list = rsp.data.servers;
                    $('#upload_servers_opt').html(app.tpl('upload_servers_opt_tpl', server_list));

                    //检查是否有本地存储的上传服务器
                    let server = localStorage.getItem('app_upload_server');
                    if (server !== null) {
                        //如果这个 server 的值是有效的，调整 select 的选中值（需要检查 server_list.url）
                        for (let x in server_list) {
                            if (server_list[x].url === server) {
                                $('#upload_servers').val(server);
                            }
                        }
                    } else {
                        //如果没有本地存储的上传服务器，选择第一个
                        $('#upload_servers').val(server_list[0].url);
                    }

                    let server_text = $('#upload_servers option:selected').text();
                    $('#seleted_server').html(', ' + app.languageData.seleted_server + ' : ' + server_text);

                    //是否是赞助者？
                    if (this.parent_op.isSponsor === false) {
                        $('#upload_servers').attr('disabled', 'disabled');
                    }
                }
            }, 'json');
        });
        //如果用户还不是赞助者，将不支持修改上传参数
        if (this.parent_op.isSponsor === false) {
            $('#upload_slice_size').attr('disabled', 'disabled');
            $('#upload_slice_queue_max').attr('disabled', 'disabled');
            $('#upload_slice_thread_max').attr('disabled', 'disabled');
        }
    }

    initSpeedChart() {
        console.log('initSpeedChart');
        this.speed_data = Array(20).fill(0);  // 改为 20 个数据点，对应 60 秒

        var options = {
            series: [{
                name: 'Upload Speed',
                data: this.speed_data
            }],
            chart: {
                id: 'realtime',
                height: 100,
                type: 'area',
                animations: {
                    enabled: false,
                },
                toolbar: {
                    show: false
                },
                zoom: {
                    enabled: false
                },
                offsetX: 0, // 取消x轴偏移
                offsetY: 0, // 取消y轴偏移
                sparkline: {
                    enabled: true
                },
            },
            tooltip: {
                enabled: false // 全局禁用 tooltip
            },
            dataLabels: {
                enabled: false
            },
            stroke: {
                width: 1,
                curve: 'straight'
            },
            title: {
                text: app.languageData.upload_speed,
                align: 'left'
            },
            xaxis: {
                categories: Array.from({ length: 60 }, (_, i) => `${60 - i * 3}s`), // 生成 60 至 1 s 的数组
                //不显示底部
                labels: {
                    show: false
                },
                axisBorder: {
                    show: false
                },
                axisTicks: {
                    show: false
                }
            },
            yaxis: {
                labels: {
                    formatter: function (value) {
                        return bytetoconver(value, true) + '/s';
                    },
                    show: true
                },
                show: true,
                tickAmount: 3,
            },
            grid: {
                show: true, // 显示网格线
            },
        };

        options = getChartThemeOptions(options);

        this.speed_chart = new ApexCharts(document.querySelector("#upload_speed_chart"), options);
        this.speed_chart.render();
    }

    updateSpeedDisplay() {
        let totalSpeed = Object.values(this.upload_speeds).reduce((a, b) => a + b, 0);
        totalSpeed = totalSpeed / 3;
        this.speed_data.shift();
        this.speed_data.push(totalSpeed);
        this.speed_chart.updateSeries([{
            name: 'Upload Speed',
            data: this.speed_data
        }]);

        let speed_text = bytetoconver(totalSpeed, true) + '/s';
        let total_text = bytetoconver(this.total_uploaded_data, true);
        $('.upload_speed_show_inner').show().html(`<iconpark-icon name="wifi"></iconpark-icon> ${speed_text} <span class="mx-2"></span> <iconpark-icon name="cloud-arrow-up"></iconpark-icon> ${total_text}`);


        this.upload_speeds = {};  // Reset speed counter

        // 如果图表还没显示，则显示它
        if (!this.chart_visible) {
            $('#upload_speed_chart_box').show();
            this.chart_visible = true;
        }
    }

    auto_set_upload_server(dom) {
        let val = $(dom).val();
        localStorage.setItem('app_upload_server', val);

        let server_text = $('#upload_servers option:selected').text();
        $('#seleted_server').html(', ' + app.languageData.seleted_server + ' : ' + server_text);
    }

    auto_set_upload_pf(dom) {
        //获取当前值
        let val = $(dom).val();
        //输入的值不能大于 80，不能小于 1
        if (val > 80) {
            val = 80;
        }
        if (val < 1) {
            val = 1;
        }
        //获取当前的 ID
        let id = $(dom).attr('id');
        //更新前，更改输入框的颜色
        $(dom).addClass('text-yellow');
        //更新
        $.post(this.parent_op.api_user, {
            'action': 'pf_upload_set',
            'token': this.parent_op.api_token,
            'key': id,
            'val': val
        }, (rsp) => {
            //恢复输入框的颜色
            $(dom).removeClass('text-yellow');
            if (rsp.status === 1) {
                //将输入框设置为绿色
                $(dom).addClass('text-success');
                setTimeout(() => {
                    $(dom).removeClass('text-success');
                }, 1000);
                //更新本地配置的对应值
                switch (id) {
                    case 'upload_slice_size':
                        this.slice_size = val * (1024 * 1024);
                        break;
                    case 'upload_slice_queue_max':
                        this.upload_queue_max = val;
                        break;
                    case 'upload_slice_thread_max':
                        this.upload_worker_queue_max = val;
                        break;
                }
            } else {
                //将输入框设置为红色
                $(dom).addClass('text-danger');
                setTimeout(() => {
                    $(dom).removeClass('text-danger');
                }, 1000);
            }
        }, 'json');
    }

    tmpupGenerator() {
        // Show the CLI uploader interface
        $('#tmpup').show();
        
        // Get model information
        let model = localStorage.getItem('app_upload_model');
        let mrid = get_page_mrid();
        let text_mr = mrid ? `-F "mr_id=${mrid}"` : '';
        
        // Build the command with proper parameters
        let text_path = '-F "file=@ your file path (etc.. @/root/test.bin)"';
        let text_model = `-F "model=${model}"`;
        let text_token = `-F "token=${this.parent_op.api_token}"`;
        
        // Complete command text
        let text = `curl -k ${text_path} ${text_token} ${text_model} ${text_mr} -X POST "https://tmp-cli.vx-cdn.com/app/upload_cli"`;
        
        // Update the CLI command display
        $('#cliuploader').show();
        $('#cliuploader_show').html(text);
        
        // Use TL.directCopy instead of the clipboard.js approach
        $('#cliuploader_copy').attr('onclick', `TL.directCopy(this, '${text.replace(/'/g, "\\'")}', false)`);
    }

    tmpupGeneratorView() {
        //如果有设定文件夹
        let mrid = get_page_mrid();
        let model = localStorage.getItem('app_upload_model');
        let token = this.parent_op.api_token;

        //显示 Token
        $('#tmpup_mrid_view').hide();
        $('#tmpup_token').html(token);
        $('#tmpup_copy_token').attr('onclick', `TL.directCopy(this,'${token}')`);
        $('#tmpup_model').html(model);
        $('#tmpup_copy_model').attr('onclick', `TL.directCopy(this,'${model}')`);

        if (mrid !== undefined) {
            $('#tmpup_mrid_view').show();
            $('#tmpup_mrid').html(mrid);
            $('#tmpup_copy_mrid').attr('onclick', `TL.directCopy(this,'${mrid}')`);
        } else {
            $('#tmpup_mrid_view').hide();
        }
    }

    skipUpload() {
        this.skip_upload = ($('#skip_upload').is(':checked')) ? true : false;
        //启用此功能，需要同时启用秒传 quickUpload
        if (this.prepare_sha1 === false && this.skip_upload === true) {
            debug('Enable quick upload');
            this.prepare_sha1 = true;
            $('#quick_upload').prop('checked', true);
        }

    }

    quickUploadInit() {
        if (localStorage.getItem('app_upload_quick') === null) {
            localStorage.setItem('app_upload_quick', 0);
        } else {
            if (localStorage.getItem('app_upload_quick') === '1') {
                $('#quick_upload').prop('checked', true);
                this.prepare_sha1 = true;
            } else {
                $('#quick_upload').prop('checked', false);
                this.prepare_sha1 = false;
            }
        }
    }

    quickUpload() {
        //写入到存储
        localStorage.setItem('app_upload_quick', ($('#quick_upload').is(':checked')) ? 1 : 0);
        this.prepare_sha1 = ($('#quick_upload').is(':checked')) ? true : false;
        //如果此功能被设置为 false，那么需要同时关闭跳过上传
        if (this.skip_upload === true && this.prepare_sha1 === false) {
            debug('Disable skip upload');
            this.skip_upload = false;
            $('#skip_upload').prop('checked', false);
        }
    }

    upload_queue_clean() {
        $('.upload_file_ok').remove();
        if (this.upload_queue_file.length > 0) {
            for (let x in this.upload_queue_file) {
                $('#uq_' + id).remove();
            }
            this.upload_queue_file = [];
        }
    }

    upload_cli() {
        if (this.parent_op.logined === 1) {
            $('#uploadCliModal').modal('show');
            $('#upload_cli_token').html(this.parent_op.api_token);
        } else {
            alert(app.languageData.status_need_login);
            app.open('/app&listview=login');
        }
    }

    open(mr_id) {

        this.mr_id = mr_id;

        if (!this.parent_op.logined) {
            alert(app.languageData.status_need_login);
            return false;
        }

        if (mr_id == 0) {
            $('#dirsToUpload').hide();
            $('.dirsToUpload_label').hide();
        }

        // this.upload_model_selected(Number(this.upload_model_selected_val));

        $('#upload_mr_id').val(mr_id);

        //如果可用的私有空间不足，则隐藏选项
        if (this.storage_used >= this.storage) {
            $('.storage_needs').hide();
        }

        //skip upload
        if (this.skip_upload) {
            $('#skip_upload').attr('checked', 'checked');
        }

        $('#uploadModal').modal('show');
        this.tmpupGeneratorView();

        document.addEventListener('paste', this.handlePaste.bind(this));

        $('#uploadModal').on('hidden.bs.modal', () => {
            document.removeEventListener('paste', this.handlePaste.bind(this));
        });
    }

    handlePaste(e) {
        const items = e.clipboardData.items;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    this.upload_queue_add({
                        file: file,
                        is_dir: false
                    });
                }
            }
        }
    }


    /**
     * 开始上传，如果没有超过最大上传数，启动新的上传任务
     */
    upload_start() {

        //如果没有需要上传的文件，退出
        if (this.upload_queue_file.length == 0) {
            return false;
        }

        //如果超过最大上传数，等待 1 秒后再次检查
        if (this.upload_queue > this.upload_queue_max) {
            //等待 1 秒后再次检查
            setTimeout(() => {
                this.upload_start();
            }, 1000);
            return false;
        }

        //启动新的上传任务
        let f = this.upload_queue_file.shift();
        this.upload_queue++;
        if (typeof f === 'object') {
            this.upload_core(f, f.is_dir);
        }
    }

    queue_remove(id) {
        // delete this.upload_queue_file[id];
        // this.upload_queue_file.length--;

        for (var i = 0; i < this.upload_queue_file.length - 1; i++) {
            if (this.upload_queue_file[i].id == id) {
                this.upload_queue_file.splice(i, 1);
            }
        }

        $('#uq_' + id).hide();
    }

    upload_model_get() {
        return $("#upload_model").val();
    }

    upload_mrid_get() {
        return $("#upload_mr_id").val();
    }

    upload_core(file_res, is_dir) {
        $('#nav_upload_btn').html('<img src="/img/loading.svg"  />');
        let file = file_res.file;
        let id = file_res.id;
        let model = file_res.model;
        let mrid = file_res.mrid;
        if (file.size > this.single_file_size) {
            alert(app.languageData.upload_limit_size);
            $('#uq_' + id).fadeOut();
            this.upload_queue--;
            return false;
        }

        if (file.size > (this.storage - this.storage_used) && (model == 99)) {
            alert(app.languageData.upload_fail_storage);
            $('#uq_' + id).fadeOut();
            this.upload_queue--;
            return false;
        }
        $('#uq_delete_' + id).hide();
        $('#uqnn_' + id).html(app.languageData.upload_upload_prepare);

        this.upload_prepare(file, id, (f, sha1, id) => {
            //如果sha1不等于0，则调用另外的接口直接发送文件名信息。
            let filename = is_dir ? file.webkitRelativePath : file.name;
            let upload_skip = this.skip_upload ? 1 : 0;
            if (sha1 !== 0) {
                //如果启用了跳过文件
                if (this.skip_upload) {
                    $.post(this.parent_op.api_file, {
                        'sha1': sha1,
                        'mr_id': mrid,
                        'action': 'check_in_dir',
                        'token': this.parent_op.api_token
                    }, (rsp) => {
                        switch (rsp.status) {
                            //文件尚未上传到服务器
                            case 0:
                                this.upload_worker(f, sha1, id, filename);
                                break;
                            //文件已被上传，并且已经在文件夹中
                            case 1:
                                this.upload_final(rsp, file, id, true);
                                break;
                            //文件已被上传,但是不在文件中，调用 prepare 处理
                            case 2:
                                $.post(this.parent_op.api_file, {
                                    'sha1': sha1,
                                    'filename': filename,
                                    'filesize': file.size,
                                    'model': model,
                                    'mr_id': mrid,
                                    'skip_upload': upload_skip,
                                    'action': 'prepare_v4',
                                    'token': this.parent_op.api_token
                                }, (rsp) => {
                                    if (rsp.status === 1) {
                                        this.upload_final(rsp, file, id);
                                    } else {
                                        this.upload_worker(f, sha1, id, filename);
                                    }
                                }, 'json');
                                break;
                        }
                    }, 'json');
                } else {
                    $.post(this.parent_op.api_file, {
                        'sha1': sha1,
                        'filename': filename,
                        'filesize': file.size,
                        'model': model,
                        'mr_id': mrid,
                        'skip_upload': upload_skip,
                        'action': 'prepare_v4',
                        'token': this.parent_op.api_token
                    }, (rsp) => {
                        if (rsp.status === 1) {
                            this.upload_final(rsp, file, id);
                        } else {
                            this.upload_worker(f, sha1, id, filename);
                        }
                    }, 'json');
                }
            } else {
                this.upload_worker(f, sha1, id, filename);
            }
        });
    }

    model_selected(model) {
        //检查账号是否有足够可用的空间
        if (model == 99) {
            if (this.storage_used >= this.storage) {
                alert('私有空间已经用完，请考虑购买私有空间扩展包。');
                return false;
            }
        }

        //构建说明文本
        let model_text = '';

        switch (model) {
            case 0:
                model_text = app.languageData.modal_settings_upload_model1;
                $('#upload_model').val(0);
                break;
            case 1:
                model_text = app.languageData.modal_settings_upload_model2;
                $('#upload_model').val(1);
                break;
            case 2:
                model_text = app.languageData.modal_settings_upload_model3;
                $('#upload_model').val(2);
                break;
            case 3:
                model_text = app.languageData.modal_settings_upload_model4;
                $('#upload_model').val(3);
                break;
            case 99:
                model_text = app.languageData.modal_settings_upload_model99;
                $('#upload_model').val(99);
                break;
        }

        //获取设置：是否启用秒传
        let quick = localStorage.getItem('app_upload_quick');
        if (quick !== undefined) {
            if (quick === '1') {
                model_text += '，' + app.languageData.model_title_quick_upload + '：' + app.languageData.btn_enable;
            }
        }

        //获取设置: 是否跳过上传
        let skip = this.skip_upload;
        if (skip === true) {
            model_text += '，' + app.languageData.model_title_skip + '：' + app.languageData.btn_enable;
        }

        $('#select_model_list').hide();
        $('#upload_select_file').show();
        $('#selected_model_box').show();
        $('#seleted_model').html(model_text);
        localStorage.setItem('app_upload_model', model);
    }

    model_reset() {
        $('#select_model_list').show();
        $('#upload_select_file').hide();
        $('#selected_model_box').hide();
    }


    upload_prepare(file, id, callback) {
        // 定义块大小为 64KB
        const blockSize = 64 * 1024;
        // 定义 SHA-1 实例
        const sha1 = CryptoJS.algo.SHA1.create();
        // 定义当前块号和总块数
        let currentBlock = 0;
        const totalBlocks = Math.ceil(file.size / blockSize);
        // 定义进度条元素
        let uqpid = "#uqp_" + id;
        const progressBar = $(uqpid);

        // 提取信息
        $('#uqnn_' + id).html(app.languageData.upload_upload_prepare);

        // 不支持 FileReader , 或者停用了秒传，或者文件大小超过了 max_sha1_size 直接下一步。
        if (!window.FileReader || this.prepare_sha1 === false) {
            callback(file, 0, id);
            return false;
        }

        // 支持 FileReader，计算 SHA-1 值
        const reader = new FileReader();
        reader.onload = function () {
            // 读取当前块数据
            const data = new Uint8Array(reader.result);
            // 更新 SHA-1 实例
            sha1.update(CryptoJS.lib.WordArray.create(data));
            // 更新当前块号
            currentBlock++;

            // 更新进度条
            const progress = currentBlock / totalBlocks * 100;
            progressBar.css('width', `${progress}%`);

            // 如果当前块号小于总块数，则继续读取下一块
            if (currentBlock < totalBlocks) {
                readNextBlock();
            } else {
                // 如果所有块都读取完毕，则计算最终 SHA-1 值并回调
                const hash = sha1.finalize().toString();
                callback(file, hash, id);
            }
        };

        // 读取下一块数据
        function readNextBlock() {
            const start = currentBlock * blockSize;
            const end = Math.min(start + blockSize, file.size);
            reader.readAsArrayBuffer(file.slice(start, end));
        }

        // 初始化进度条
        progressBar.css('width', '0%');

        // 从第一块开始读取数据
        readNextBlock();
    }



    upload_worker(file, sha1, id, filename) {
        //sha1 在浏览器不支持 sha1 计算，或者停用了秒传，其值为 0

        //获取上传服务器的节点
        this.parent_op.recaptcha_do('upload_request_select2', (captcha) => {
            $.post(this.parent_op.api_url_upload, {
                'token': this.parent_op.api_token,
                'action': 'upload_request_select2',
                'filesize': file.size,
                'captcha': captcha,
            }, (rsp) => {
                if (rsp.status == 1) {
                    let api = $('#upload_servers').val();
                    //文件小于 32 MB，直接上传
                    debug('upload::slice::' + filename);
                    let api_sync = api + '/app/upload_slice';
                    this.worker_slice(api_sync, rsp.data.utoken, sha1, file, id, filename, 0);
                } else {
                    //无法获得可用的上传服务器
                    alert('上传失败，无法获得可用的服务器。');
                }
            });
        });
    }

    /**
     * 分片上传
     * 分片上传功能，首先会查询服务器是否有需要上传的分片，如果有则返回分片编号，如果没有则返回需要上传的分片编号
     * @param {*} server
     * @param {*} file 
     * @param {*} id 
     * @param {*} filename 
     */
    lastPrepareTimes = {};
    worker_slice(server, utoken, sha1, file, id, filename, thread = 0) {

        //如果上传队列中存在正在上传的文件，隐藏出了上传按钮之外的其他选项
        if (this.upload_queue > 0) {
            $('.uploader_opt').hide();
        } else {
            $('.uploader_opt').show();
        }

        //创建分片任务的ID，算法 uid+文件路径+文件大小+分片设定 的 sha1 值
        let uptoken = CryptoJS.SHA1(this.parent_op.uid + file.name + file.size + this.slice_size).toString();
        let upload_queue_max = this._internal_queue_max;
        let numbers_of_slice = 1;

        // 获取当前时间
        const now = Date.now();

        // 如果这个任务之前没有 prepare，初始化它的时间
        if (this.lastPrepareTimes[uptoken] === undefined) {
            this.lastPrepareTimes[uptoken] = 0;
        }

        // 如果距离这个任务上次 prepare 请求不足1秒，则等待
        if (now - this.lastPrepareTimes[uptoken] < 1000) {
            setTimeout(() => {
                this.worker_slice(server, utoken, sha1, file, id, filename, thread);
            }, 1000 - (now - this.lastPrepareTimes[uptoken]));
            return;
        }

        // 更新这个任务的上次 prepare 时间
        this.lastPrepareTimes[uptoken] = now;

        //根据当前分片限制，以及文件的总大小，计算出是否启动多线程上传
        if (file.size > this.slice_size) {
            numbers_of_slice = Math.ceil(file.size / this.slice_size);
        }

        //如果没有初始化，则初始化，并将当前任务设置为主线程，只有主线程才能更新界面
        if (thread === 0) {
            if (this.upload_slice_chunk[id] === undefined) {
                this.upload_slice_chunk[id] = [];
                debug(`文件名 ${filename} 的分片数量 ${numbers_of_slice} 任务已初始化。`);
            }
            if (this.upload_slice_process[id] === undefined) {
                this.upload_slice_process[id] = 0;
            }

            // 初始化文件上传进度跟踪
            if (this.upload_file_progress[id] === undefined) {
                this.upload_file_progress[id] = {
                    total: file.size,
                    uploaded: 0,
                    isUpdating: false, // 添加一个标志，表示当前是否正在更新进度
                    lastUpdateTime: 0, // 添加一个时间戳，控制更新频率
                    resumeInitialized: false  // 添加标记，用于跟踪是否已执行断点续传进度初始化
                };

                // 初始化时设置一次进度显示
                $('#uqnn_' + id).html(
                    `${app.languageData.upload_sync} (0/${bytetoconver(file.size, true)}) 0%`
                );
            }
        }

        //如果分片数量大于上传线程数量，则线程数量设定为 upload_queue_max,否则设定为 numbers_of_slice
        if (numbers_of_slice < upload_queue_max) {
            upload_queue_max = numbers_of_slice;
        }

        //尚未初始化线程分配总数
        if (this.upload_slice_total[id] === undefined) {
            this.upload_slice_total[id] = numbers_of_slice;
        }

        //当前任务的多线程上传队列状态是否已经建立
        if (this.upload_worker_queue[id] === undefined) {
            this.upload_worker_queue[id] = 1;
            debug(`任务 ${id} 主线程 1 已启动。`);
        }

        //更新进度
        this.upload_slice_process[id]++;

        //如果当前处理进度 -1 等于总数，并且不是主线程，则退出
        if ((this.upload_slice_process[id] + 3) >= numbers_of_slice && thread > 0) {
            debug(`任务 ${id} 子线程已退出。`);
            return false;
        } else {
            //是否超出上传线程数？没有超出的话，启动新的上传任务
            if (this.upload_worker_queue[id] < upload_queue_max) {
                let thread_id = this.upload_worker_queue[id] + 1;
                this.upload_worker_queue[id] = thread_id;
                this.worker_slice(server, utoken, sha1, file, id, filename, thread_id);
                debug(`任务 ${id} 子线程 ${thread_id} 已启动。`);
            }
        }

        //查询分片信息
        $.post(server, {
            'token': this.parent_op.api_token, 'uptoken': uptoken,
            'action': 'prepare',
            'sha1': sha1, 'filename': filename, 'filesize': file.size, 'slice_size': this.slice_size,
            'utoken': utoken, 'mr_id': this.upload_mrid_get(), 'model': this.upload_model_get()
        }, (rsp) => {

            switch (rsp.status) {
                /**
                 * 分片上传服务
                 * 返回状态码
                 * 1 ：上传完成
                 * 2 ：上传尚未完成，需要等待其他人完成上传（客户端每隔一段时间再次发起查询，如果用户无法完成上传，则重新分配）
                 * 3 ：进入上传流程，客户端将会获得一份分配的分片编号
                 * 4 ：分片任务不存在
                 * 5 ：分片上传完成
                 * 6 ：这个文件已经被其他人上传了，因此直接跳过（需要清理已上传的文件）
                 * 7 : 上传失败，原因将会写入到 data
                 * 8 ：分片合并完成
                 * 9 ：文件已经上传完成，但是文件合并进程正在进行中，处于锁定状态
                 */
                case 1:
                    //已完成上传
                    this.upload_final({ status: rsp.status, data: { ukey: rsp.data } }, file, id);
                    break;
                case 6:
                    //已完成上传
                    //重置 rsp.stustus = 1
                    rsp.status = 1;
                    this.upload_final({ status: rsp.status, data: { ukey: rsp.data } }, file, id);
                    break;
                case 8:
                    //已完成上传
                    //重置 rsp.stustus = 1
                    //重置 rsp.ukey = rsp.data ，模板中需要用到
                    rsp.status = 1;
                    this.upload_final({ status: rsp.status, data: { ukey: rsp.data } }, file, id);
                    break;
                case 2:
                    //没有可上传分片，等待所有分片完成
                    //只有主线程才执行这项工作，其他线程直接退出
                    if (thread === 0) {
                        console.log(`Case 2: 等待分片完成，隐藏进度条 for file ${id}`);
                        // 主线程显示同步状态并隐藏进度条
                        $('#uqp_' + id).hide();
                        $('#uqp_' + id).parent('.progress').hide();
                        $('#uqnn_' + id).html(app.languageData.upload_sync_to_storage);
                    }
                    setTimeout(() => {
                        this.worker_slice(server, utoken, sha1, file, id, filename, thread);
                    }, 5000);
                    break;
                // 在 worker_slice 函数中收到服务器响应后，添加下面的代码
                // 在 case 3 分支中，添加一次性进度绘制代码：

                case 3:
                    // 获得一个需要上传的分片编号,开始处理上传

                    // 检查是否已经为此文件执行过断点续传进度更新
                    if (thread === 0 && this.upload_file_progress[id] &&
                        !this.upload_file_progress[id].resumeInitialized &&
                        rsp.data && rsp.data.total > 0) {

                        // 标记已执行断点续传进度更新
                        this.upload_file_progress[id].resumeInitialized = true;

                        // 计算已上传分片数
                        const totalSlices = rsp.data.total;
                        const waitingSlices = rsp.data.wait;
                        const uploadedSlices = totalSlices - waitingSlices;

                        // 只有当有已上传分片时才更新进度
                        if (uploadedSlices > 0) {
                            // 计算进度百分比
                            const progressPercent = Math.floor((uploadedSlices / totalSlices) * 100);

                            // 估算已上传字节数
                            const estimatedBytes = Math.min(uploadedSlices * this.slice_size, file.size);

                            // 更新进度条
                            $(`#uqp_${id}`).css('width', `${progressPercent}%`);

                            // 更新进度文本
                            $(`#uqnn_${id}`).html(
                                `${app.languageData.upload_sync} (${bytetoconver(estimatedBytes, true)}/${bytetoconver(file.size, true)}) ${progressPercent}%`
                            );

                            console.log(`断点续传初始化: 文件 ${filename} 已上传 ${uploadedSlices}/${totalSlices} 分片 (${progressPercent}%)`);

                            // 更新已上传字节数
                            this.upload_file_progress[id].uploaded = estimatedBytes;
                        }
                    }

                    this.worker_slice_uploader(server, id, uptoken, file, rsp.data, filename, thread, () => {
                        // 回归
                        this.worker_slice(server, utoken, sha1, file, id, filename, thread);
                    });
                    break;
                case 7:
                    //上传失败
                    //rsp.data 中的数值为错误代码
                    this.upload_final({ status: rsp.data, data: { ukey: rsp.data } }, file, id, thread);
                    break;
                case 9:
                    //文件合并进程正在进行中，处于锁定状态
                    if (thread === 0) {
                        console.log(`Case 9: 文件合并锁定，隐藏进度条 for file ${id}`);
                        // 主线程显示同步状态并隐藏进度条
                        $('#uqp_' + id).hide();
                        $('#uqp_' + id).parent('.progress').hide();
                        $('#uqnn_' + id).html(app.languageData.upload_sync_to_storage);
                    }
                    //重置 rsp.stustus = 1
                    rsp.status = 1;
                    this.upload_final({ status: rsp.status, data: { ukey: rsp.data } }, file, id,);
                    break;

            }
        }, 'json').fail((xhr, textStatus, errorThrown) => {
            // 添加错误处理
            let errorMessage = '网络请求失败';
            if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = xhr.responseJSON.message;
            } else if (textStatus) {
                errorMessage = `请求失败: ${textStatus}`;
            }

            alert(errorMessage);
            $('#uqnn_' + id).html(`<span class="text-red">${errorMessage}</span>`);

            // 重试逻辑
            setTimeout(() => {
                this.worker_slice(server, utoken, sha1, file, id, filename, thread);
            }, 3000);
        });
    }

    /**
     * 分片上传
     */
    worker_slice_uploader(server, id, uptoken, file, slice_status, filename, thread, cb) {
        //从 file 中读取指定的分片
        let index = slice_status.next;
        let blob = file.slice(index * this.slice_size, (index + 1) * this.slice_size);

        //初始化
        let uqmid = "#uqm_" + id;
        let uqpid = "#uqp_" + id;
        let main_t = thread === 0 ? '主线程' : '子线程';

        debug(`任务 ${id} ${main_t} ${thread} 正在上传分片 ${index + 1}。`);

        //初始化上传任务的已上传数据计数器
        if (this.upload_slice_chunk[id][index] === undefined) {
            this.upload_slice_chunk[id][index] = 0;
        }

        //提交分片
        let xhr = new XMLHttpRequest();
        //构建参数
        let fd = new FormData();
        fd.append("filedata", blob, 'slice');
        fd.append("uptoken", uptoken);
        fd.append("filename", filename);
        fd.append("index", index);
        fd.append("action", 'upload_slice');
        fd.append("slice_size", this.slice_size);

        //完成时回调
        xhr.addEventListener("load", (evt) => {
            //将返回值解析为 json
            let rsp = JSON.parse(evt.target.response);
            //如果返回值是 5，则表示分片上传完成
            if (rsp.status == 5) {
                cb();
            } else {
                //其它情况也返回处理
                cb();
            }
        });

        //主线程工作
        if (thread === 0) {
            //如果是主线程，则更新上传信息到界面上
            // $('#uqnn_' + id).html(app.languageData.upload_sync);

            //获取进度信息
            let total = slice_status.total;
            let success = slice_status.total - slice_status.wait;

            //设置进度条的宽度
            let pp_pie = 100 / total;
            let pp_percent = success * pp_pie;

            //绘制进度信息
            $(uqmid).html(`${app.languageData.upload_upload_processing} ${file.name}`);
            // $(uqpid).css('width', pp_percent + '%');
        }

        //上传完成后，关闭计时器
        xhr.addEventListener("loadend", (evt) => {
            //如果已上传的总数等于总数，则表示上传完成，显示已完成
            if (index === (this.upload_slice_total[id] - 1)) {
                console.log(`最后一个分片上传完成，隐藏进度条 for file ${id}`);
                // 隐藏进度条和容器
                $(uqpid).hide();
                $(uqpid).parent('.progress').hide();
                // 显示同步到存储节点的状态
                $('#uqnn_' + id).html(app.languageData.upload_sync_to_storage);
            }
        });

        //上传发生错误，重启
        xhr.addEventListener("error", (evt) => {
            this.handleUploadError(id);
            cb();
        });

        //上传被中断，重启
        xhr.addEventListener("abort", (evt) => {
            this.handleUploadError(id);
            cb();
        });

        //分块上传进度上报
        xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
                let previousLoaded = this.upload_slice_chunk[id][index] || 0;
                let newLoaded = evt.loaded;
                let loadedDiff = newLoaded - previousLoaded;

                if (loadedDiff > 0) {
                    this.updateUploadSpeed(id, loadedDiff);
                    this.upload_slice_chunk[id][index] = newLoaded;

                    // 更新文件总体上传进度
                    if (this.upload_file_progress[id]) {
                        this.upload_file_progress[id].uploaded += loadedDiff;
                        // 限制最大值不超过文件总大小，防止进度超过100%
                        this.upload_file_progress[id].uploaded = Math.min(
                            this.upload_file_progress[id].uploaded,
                            this.upload_file_progress[id].total
                        );
                        // 只有主线程才更新界面显示
                        if (thread === 0) {
                            this.updateFileProgress(id, filename);
                        }
                    }
                }
            }
        };

        //提交
        xhr.overrideMimeType("application/octet-stream");
        xhr.open("POST", server);

        this.parent_op.recaptcha_do('upload_slice', (recaptcha) => {
            fd.append('captcha', recaptcha);
            xhr.send(fd);
        });
    }

    /**
     * 更新文件上传进度显示
     * @param {*} id 文件ID
     * @param {*} filename 文件名
     */
    updateFileProgress(id, filename) {
        if (!this.upload_file_progress[id]) return;

        let progress = this.upload_file_progress[id];
        let percentComplete = Math.min(100, Math.floor((progress.uploaded / progress.total) * 100));

        let uqmid = "#uqm_" + id;
        let uqpid = "#uqp_" + id;

        // 标记这个文件是否正在更新进度，防止更新冲突
        if (this.upload_file_progress[id].isUpdating) return;
        this.upload_file_progress[id].isUpdating = true;

        // 如果达到100%，隐藏进度条并显示同步状态
        if (percentComplete >= 100) {
            console.log(`隐藏进度条 for file ${id}: ${filename}`);
            $(uqpid).hide();
            $(uqpid).parent('.progress').hide(); // 同时隐藏进度条容器
            $(uqmid).html(`${app.languageData.upload_upload_processing} ${filename}`);
            $('#uqnn_' + id).html(app.languageData.upload_sync_to_storage);
        } else {
            // 更新进度文本和进度条
            $(uqmid).html(`${app.languageData.upload_upload_processing} ${filename}`);
            $(uqpid).css('width', percentComplete + '%');

            // 更新状态文本，显示已上传/总大小
            $('#uqnn_' + id).html(
                `${app.languageData.upload_sync} (${bytetoconver(progress.uploaded, true)}/${bytetoconver(progress.total, true)}) ${percentComplete}%`
            );
        }

        // 用setTimeout确保DOM更新完成后再释放锁
        setTimeout(() => {
            if (this.upload_file_progress[id]) {
                this.upload_file_progress[id].isUpdating = false;
            }
        }, 50);
    }

    handleUploadError(id) {
        delete this.upload_speeds[id];
        this.active_uploads = Math.max(0, this.active_uploads - 1);
        if (this.active_uploads === 0) {
            this.stopSpeedUpdater();
        }
    }

    startSpeedUpdater() {
        if (!this.chart_visible) {
            $('#upload_speed_chart_box').show();
            this.chart_visible = true;
        }
        if (!this.speed_update_interval) {
            this.speed_update_interval = setInterval(() => this.updateSpeedDisplay(), 3000);
        }
    }

    stopSpeedUpdater() {
        if (this.speed_update_interval) {
            clearInterval(this.speed_update_interval);
            this.speed_update_interval = null;
        }
        // We don't hide the chart anymore
    }

    updateUploadSpeed(id, bytes) {
        if (!this.upload_speeds[id]) {
            this.upload_speeds[id] = 0;
            this.active_uploads++;
            this.startSpeedUpdater();
        }
        this.upload_speeds[id] += bytes;
        this.total_uploaded_data += bytes;  // 在这里更新总上传数据量
    }

    handleUploadCompletion(id) {
        delete this.upload_speeds[id];
        this.active_uploads = Math.max(0, this.active_uploads - 1);
        // 添加这个检查
        if (this.active_uploads === 0 && this.upload_queue_file.length === 0) {
            this.stopSpeedUpdater();
        }
    }

    // 添加一个方法来重置所有上传状态
    resetUploadStatus() {
        this.active_uploads = 0;
        this.upload_speeds = {};
        // 不重置 total_uploaded_data，因为这是累计值
        this.stopSpeedUpdater();
        // We don't hide the chart here, it will remain visible
        $('#upload_speed_chart_box').hide();
        this.chart_visible = false;
    }

    selected(dom) {
        //隐藏首页特性的介绍
        $('#index_feature').fadeOut();

        let file = document.getElementById('fileToUpload').files;
        let f = null;
        if (file.length > 0) {
            for (let x in file) {
                f = file[x];
                if (typeof f !== 'object') {
                    continue;
                }
                if (f.size !== 0) {
                    this.upload_queue_add({
                        file: f,
                        is_dir: false
                    });
                }
            }
        }

        //清空文件选择框
        dom.value = '';
    }

    dir_selected(e) {
        let file = document.getElementById('dirsToUpload').files;
        let f = null;
        if (file.length > 0) {
            for (let x in file) {
                f = file[x];
                if (typeof f !== 'object') {
                    continue;
                }
                if (f.size !== 0) {
                    this.upload_queue_add({
                        file: f,
                        is_dir: true
                    });
                }
            }
        }
        //清空文件选择框
        // dom.value = '';
    }


    drop(e) {
        e.preventDefault();
        var fileList = e.dataTransfer.files;
        //files
        if (fileList.length == 0) {
            return false;
        }
        for (let x in fileList) {
            if (typeof fileList[x] === 'object') {
                setTimeout(() => {
                    this.upload_queue_add({
                        file: fileList[x],
                        is_dir: false
                    });
                }, 500);
            }
        }

    }

    upload_queue_add(f) {
        setTimeout(() => {
            let file = f.file;

            //添加一些额外参数
            f.model = this.upload_model_get();
            f.mrid = this.upload_mrid_get();
            f.id = this.upload_queue_id;

            //检查是否超出了可用的私有存储空间
            if (this.upload_model_get() == 99) {
                if ((this.parent_op.storage_used + file.size) > this.parent_op.storage) {
                    $.notifi(file.name + ' : ' + app.languageData.upload_fail_storage, { noticeClass: 'ntf-error', autoHideDelay: 5000 });
                    return false;
                }
            }

            this.upload_queue_file.push(f);
            //如果未登录，添加队列到首页
            let target = this.parent_op.isLogin() ? '#upload_model_box' : '#upload_index_box';
            $(target).append(app.tpl('upload_list_wait_tpl', {
                name: file.name,
                size: bytetoconver(file.size, true),
                id: this.upload_queue_id
            }));
            $(target).show();
            this.upload_queue_id++;
            //更新状态
            this.upload_btn_status_update();
            //启动上传
            this.upload_start();
        }, 500, f);
    }

    upload_btn_status_update() {
        if (this.upload_queue_file.length > 0) {
            //更新队列数
            $('.upload_queue').fadeIn();
            $('.upload_queue_counter').html(this.upload_queue_file.length);

            //更新已完成📖
            $('.upload_count').fadeIn();
            $('.upload_count').html(this.upload_count);
        } else {
            $('.upload_queue').fadeOut();
        }
    }

    upload_complete(evt, file, id) {
        this.download_retry = 0;
        clearInterval(this.upload_progressbar_counter[id]);
        this.upload_progressbar_counter[id] = null;
        var data = JSON.parse(evt.target.responseText);
        this.upload_final(data, file, id);
    }

    upload_failed(evt, id) {
        clearInterval(this.upload_progressbar_counter[id]);
        this.upload_progressbar_counter[id] = null;
        alert(app.languageData.upload_fail);
        this.upload_queue--;
        $('#uq_' + id).fadeOut();
    }

    upload_canceled(evt, id) {
        clearInterval(this.upload_progressbar_counter[id]);
        this.upload_progressbar_counter[id] = null;
        alert(app.languageData.upload_cancel);
        this.upload_queue--;
        $('#uq_' + id).fadeOut();
    }

    upload_final(rsp, file, id, skip) {
        // 在完成或失败时清理进度跟踪数据
        if (this.upload_file_progress[id]) {
            delete this.upload_file_progress[id];
        }

        this.handleUploadCompletion(id);
        this.upload_queue--;
        if (skip === undefined) {
            skip = false;
        }

        //如果上传队列中存在正在上传的文件，隐藏除了上传按钮之外的其他选项
        if (this.upload_queue > 0 || this.upload_queue_file.length > 0) {
            $('.uploader_opt').hide();
        } else {
            $('.uploader_opt').show();
            this.resetUploadStatus();
        }
        this.check_upload_clean_btn_status();

        if (rsp.status === 1) {
            console.log(`upload_final: 上传成功，隐藏进度条 for file ${id}`);
            // 确保进度条被隐藏
            $('#uqp_' + id).hide();
            $('#uqp_' + id).parent('.progress').hide();
            // 先显示同步状态，然后显示完成状态
            $('#uqnn_' + id).html(app.languageData.upload_sync_to_storage);
            setTimeout(() => {
                $('#uqnn_' + id).html(app.languageData.upload_ok);
            }, 1000);

            //如果未登录状态下上传，则不隐藏上传完成后的信息
            if (this.parent_op.isLogin()) {
                // 清除之前的定时器
                if (this.refreshTimeout) {
                    clearTimeout(this.refreshTimeout);
                }

                // 只在所有文件都上传完成时才刷新列表
                if (this.upload_queue === 0 && this.upload_queue_file.length === 0) {
                    this.refreshTimeout = setTimeout(() => {
                        if (get_page_mrid() !== undefined) {
                            this.parent_op.dir.open();
                        } else {
                            this.parent_op.workspace_filelist(0);
                        }
                    }, 1000);
                }

                $('#uq_' + id).hide();
                if (skip === false) {
                    $('#upload_model_box_finish').append(app.tpl('upload_list_ok_tpl', {
                        name: file.name,
                        size: bytetoconver(file.size, true),
                        ukey: rsp.data.ukey
                    }));
                    this.parent_op.btn_copy_bind();
                }
                this.upload_btn_status_update();
                this.check_upload_clean_btn_status();
            } else {
                $('#uq_' + id).remove();
                $('#upload_index_box_finish').show();
                $('#upload_index_box_finish').append(app.tpl('upload_list_ok_tpl', {
                    name: file.name,
                    size: bytetoconver(file.size, true),
                    ukey: rsp.data.ukey
                }));
                this.parent_op.btn_copy_bind();
            }
        } else {
            //根据错误代码显示错误信息
            let error_msg = app.languageData.upload_fail;
            switch (rsp.status) {
                case 2:
                    //上传失败，无效请求
                    error_msg = app.languageData.upload_fail_utoken;
                    break;
                case 3:
                    //上传失败，不能上传空文件
                    error_msg = app.languageData.upload_fail_empty;
                    break;
                case 4:
                    //上传失败，上传的文件大小超出了系统允许的大小
                    error_msg = app.languageData.upload_limit_size;
                    break;
                case 5:
                    //上传失败，超出了单日允许的最大上传量
                    error_msg = app.languageData.upload_limit_day;
                    break;
                case 6:
                    //上传失败，没有权限上传到这个文件夹
                    error_msg = app.languageData.upload_fail_permission;
                    break;
                case 7:
                    //要上传的文件超出了私有存储空间限制
                    error_msg = app.languageData.upload_fail_storage;
                    break;
                case 8:
                    //上传失败，目前暂时无法为这个文件分配存储空间
                    error_msg = app.languageData.upload_fail_prepare;
                    break;
                case 9:
                    //上传失败，操作失败，无法获取节点信息
                    error_msg = app.languageData.upload_fail_node;
                    break;
                case 10:
                    //上传失败，文件名中包含了不允许的字符
                    error_msg = app.languageData.upload_fail_name;
                    break;
                default:
                    //默认错误
                    error_msg = app.languageData.upload_fail_unknown + ` ${rsp.status}`;
            }
            debug(rsp.status + ':' + error_msg);
            $('#uqnn_' + id).html(`<span class="text-red">${error_msg}</span>`);
            //清除上传进度条
            $('.uqinfo_' + id).remove();
        }

        //更新上传统计
        this.upload_count++;
    }

    upload_final_error_text(status) {
        switch (status) {
            case 2:
                //上传失败，无效请求
                return app.languageData.upload_fail_utoken;
            case 3:
                //上传失败，不能上传空文件
                return app.languageData.upload_fail_empty;
            case 4:
                //上传失败，上传的文件大小超出了系统允许的大小
                return app.languageData.upload_limit_size;
            case 5:
                //上传失败，超出了单日允许的最大上传量
                return app.languageData.upload_limit_day;
            case 6:
                //上传失败，没有权限上传到这个文件夹
                return app.languageData.upload_fail_permission;
            case 7:
                //要上传的文件超出了私有存储空间限制
                return app.languageData.upload_fail_storage;
            case 8:
                //上传失败，目前暂时无法为这个文件分配存储空间
                return app.languageData.upload_fail_prepare;
            case 9:
                //上传失败，操作失败，无法获取节点信息
                return app.languageData.upload_fail_node;
            case 10:
                //上传失败，文件名中包含了不允许的字符
                return app.languageData.upload_fail_name;
            default:
                //默认错误
                return app.languageData.upload_fail_unknown + ` ${status}`;
        }
    }
}