class BoxSelecter {

    items_name = 'items_box'
    parent_op = null
    pre_op_list = null
    move_place = 'workspace'
    dir_tree_init = false
    site_domain = null
    lastSelectedNode = null;

    init(parent_op) {
        this.parent_op = parent_op;
        this.site_domain = this.parent_op.site_domain;
        this.initEventListeners();
    }

    pageInit() {
        //重置所有选中的项目
        this.setNone();
        //隐藏未选择时的可用按钮
        this.setGUIOnSelected();
    }

    setGUIOnSelected() {
        //假如没有已选中的项目
        if ($(`[data-check="true"]`).length === 0) {
            //隐藏未选择时的可用按钮
            $('.btn-gui-on-selected').hide();
        } else {
            //显示未选择时的可用按钮
            $('.btn-gui-on-selected').fadeIn(100);
        }
    }

    initEventListeners() {
        document.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    handleMouseDown(event) {
        if (event.shiftKey) {
            this.isShiftSelecting = true;
            event.preventDefault();
        }
    }

    handleMouseMove(event) {
        if (this.isShiftSelecting) {
            event.preventDefault();
        }
    }

    handleMouseUp(event) {
        if (this.isShiftSelecting) {
            this.isShiftSelecting = false;
            event.preventDefault();
        }
    }

    handleKeyDown(event) {
        if (event.key === 'Shift') {
            document.body.style.userSelect = 'none';
        }
    }

    handleKeyUp(event) {
        if (event.key === 'Shift') {
            document.body.style.userSelect = '';
            this.isShiftSelecting = false;
        }
    }

    mobileHeadShow() {
        //获取当前的mrid
        let url = get_url_params();
        let mrid = url.mrid;
        //如果是移动设备，并且mrid不等于0
        if (isMobileScreen()&&mrid != 0) {
            //如果有被选中的项目，则显示
            if ($(`[data-check="true"]`).length > 0) {
                $('.mobile-head-selector').show();
            } else {
                $('.mobile-head-selector').hide();
            }
        }
    }

    onclickByList(node, event) {

        // 阻止默认的文本选择行为
        if (event.shiftKey) {
            event.preventDefault();
        }

        if (event.shiftKey) {
            this.shiftSelect(node);
        } else {
            let n = node.getAttribute('data-check');
            if (n !== 'true') {
                this.setOn(node);
            } else {
                this.selectOff(node);
            }
            this.lastSelectedNode = node;
        }

        //检查所有已选中的选项，如果没有 file，则隐 .btn_for_copy_in_dir
        let file_hit = false;
        for (let i = 0; i < node.length; i++) {
            let inode = node[i];
            let check = inode.getAttribute('data-check');
            if (check === 'true'&&inode.getAttribute('tlunit')==='file') {
                file_hit = true;
            }
        }
        if (file_hit) {
            $('.btn_for_copy_in_dir').show();
        } else {
            $('.btn_for_copy_in_dir').hide();
        }
        this.setGUIOnSelected();
        this.mobileHeadShow();
    }

    shiftSelect(endNode) {
        const allNodes = Array.from(document.getElementsByName(this.items_name));
        const endIndex = allNodes.indexOf(endNode);

        // 找到所有已选中的项
        const selectedIndices = allNodes
            .map((node, index) => node.getAttribute('data-check') === 'true' ? index : -1)
            .filter(index => index !== -1);

        if (selectedIndices.length === 0) {
            // 如果没有选中项，从头开始选择到点击项
            for (let i = 0; i <= endIndex; i++) {
                this.setOn(allNodes[i]);
            }
        } else {
            const lastSelectedIndex = selectedIndices[selectedIndices.length - 1];
            
            if (endIndex < lastSelectedIndex) {
                // 反向选择：取消之前的选择，选择新范围
                allNodes.forEach((node, index) => {
                    if (index >= endIndex && index <= lastSelectedIndex) {
                        this.setOn(node);
                    } else {
                        this.selectOff(node);
                    }
                });
            } else {
                // 正向选择：扩展选择范围
                const startIndex = selectedIndices[0];
                for (let i = startIndex; i <= endIndex; i++) {
                    this.setOn(allNodes[i]);
                }
            }
        }

        this.lastSelectedNode = endNode;
    }

    boxOnclick(node) {
        let n = node.getAttribute('data-check');
        if (n !== 'true') {
            this.setOn(node);
        } else {
            this.selectOff(node);
        }
    }

    setOn(node) {
        //获取是否处于深色模式
        let dark_mode = this.parent_op.matchNightModel();
        //如果是深色模式，使用不同的配色
        let color = '';
        if (dark_mode) {
            color = '#6d6c6c';
        } else {
            color = 'rgb(220, 236, 245)';
        }

        let inode = node.getAttribute('tldata');
        let itype = node.getAttribute('tltype');
        let unit_type = node.getAttribute('tlunit');//是否是文件夹又或者是文件
        if(unit_type === 'dir'){
            $(`.dir_${inode}`).css('border-width', '1px');
            $(`.dir_${inode}`).css('background-color', color);
        }else{
            if (itype === 'photo_card') {
                $(`.file_unit_${inode} .card`).css('background-color', color);
            } else {
                // $(`.file_unit_${inode}`).css('border-radius', '5px');
                $(`.file_unit_${inode}`).css('border-width', '1px');
                $(`.file_unit_${inode}`).css('background-color', color);
            }
        }
        node.setAttribute('data-check', 'true');
    }

    selectOff(node) {
        let inode = node.getAttribute('tldata');
        let itype = node.getAttribute('tltype');
        if(node.getAttribute('tlunit') === 'dir'){
            $(`.dir_${inode}`).css('border-width', '');
            $(`.dir_${inode}`).css('background-color', '');
        }else{
            if (itype === 'photo_card') {
                $(`.file_unit_${inode} .card`).css('background-color', '');
            } else {
                $(`.file_unit_${inode}`).css('border-radius', '');
                $(`.file_unit_${inode}`).css('border-width', '');
                $(`.file_unit_${inode}`).css('background-color', '');
            }
        }
        node.setAttribute('data-check', 'false');
    }

    setAll() {
        var node = document.getElementsByName(this.items_name);
        for (let i = 0; i < node.length; i++) {
            this.setOn(node[i]);
        }
        this.setGUIOnSelected();
    }

    setNone() {
        var node = document.getElementsByName(this.items_name);
        for (let i = 0; i < node.length; i++) {
            this.selectOff(node[i]);
        }
        // 重置最后选中的节点
        this.lastSelectedNode = null;
        this.setGUIOnSelected();
    }

    fileOnCheck() {
        var node = document.getElementsByName(this.items_name);
        for (let i = 0; i < node.length; i++) {
            if (inode.checked == true) {
                //do something
                return;
            }
        }
        //do something
    }

    async share() {
        var node = document.getElementsByName(this.items_name);
        let ukeys = [];
        for (let i = 0; i < node.length; i++) {
            var inode = node[i];
            let check = inode.getAttribute('data-check');
            if (check === 'true') {
                //do something
                ukeys.push({
                    'ukey': inode.getAttribute('tldata'),
                    'title': inode.getAttribute('tltitle'),
                    'type': inode.getAttribute('tlunit'),
                });
            }
        }
        await this.toClicpboard(ukeys);
    }

    async toClicpboard(data) {
        let ctext = '';
        for (let x in data) {
            if(data[x].type==='dir'){
                ctext = ctext + '📂' + data[x].title + ' https://' + this.site_domain + '/room/' + data[x].ukey + "\r";
            }else{
                ctext = ctext + '📃' + data[x].title + ' https://' + this.site_domain + '/f/' + data[x].ukey + "\r";
            }
        }
        await copyToClip(ctext);
    }

    delete() {
        if (this.parent_op.profile_confirm_delete_get()) {
            if (!confirm(app.languageData.confirm_delete)) {
                return false;
            }
        }
        let ukey = [];
        let dirs = [];
        var node = document.getElementsByName(this.items_name);
        if (node.length > 0) {
            for (let i = 0; i < node.length; i++) {
                var inode = node[i];
                let check = inode.getAttribute('data-check');
                if (check === 'true'&&inode.getAttribute('tlunit')==='dir') {
                    //do something
                    dirs.push(inode.getAttribute('tldata'));
                } 
                if (check === 'true'&&inode.getAttribute('tlunit')==='file') {
                    //do something
                    ukey.push(inode.getAttribute('tldata'));
                }
            }

            if (dirs.length!==0) {
                this.parent_op.dir.delete(dirs, true);
            }

            if (ukey.length!==0) {
                this.parent_op.workspace_del(ukey, true);
            }
        }
    }

    changeModelOpen(){
        $('#changeModelModal').modal('show');
    }

    changeModel() {
        let ukeys = [];

        var node = document.getElementsByName(this.items_name);
        for (let i = 0; i < node.length; i++) {
            var inode = node[i];
            let check = inode.getAttribute('data-check');
            if (check === 'true') {
                //do something
                ukeys.push(inode.getAttribute('tldata'));
            }
        }
        if (ukeys.length === 0) {
            this.parent_op.alert(app.languageData.status_error_12);
            return false;
        }
        console.log(ukeys);
        this.parent_op.file.changeModel(ukeys);
    }

    async downloadAll() {
        var node = document.getElementsByName(this.items_name);
        let data = [];
        for (let i = 0; i < node.length; i++) {
            let inode = node[i];
            let unit_type = inode.getAttribute('tlunit');//是否是文件夹又或者是文件
            if (unit_type === 'file') {
                //do something
                let ukey = inode.getAttribute('tldata');
                let type = 'file';
                data.push({'id':ukey,'type':type});
            }
            if (unit_type === 'dir') {
                let ukey = inode.getAttribute('tldata');
                let type = 'dir';
                data.push({'id':ukey,'type':type});
            }
        }

        if (data.length === 0) {
            this.parent_op.alert(app.languageData.status_error_12);
            return false;
        }

        await this.parent_op.download.folder_download(data);
    }

    async download() {
        var node = document.getElementsByName(this.items_name);
        let data = [];
        for (let i = 0; i < node.length; i++) {
            let inode = node[i];
            let check = inode.getAttribute('data-check');
            let unit_type = inode.getAttribute('tlunit');//是否是文件夹又或者是文件
            if (check === 'true'&&unit_type==='file') {
                //do something
                let ukey = inode.getAttribute('tldata');
                let type = 'file';
                data.push({'id':ukey,'type':type});
            }
            if (check === 'true'&&unit_type==='dir') {
                let ukey = inode.getAttribute('tldata');
                let type = 'dir';
                data.push({'id':ukey,'type':type});
            }
        }

        if (data.length === 0) {
            this.parent_op.alert(app.languageData.status_error_12);
            return false;
        }

        await this.parent_op.download.folder_download(data);
    }

    downloadURL() {
        //未登录无法使用此功能
        if (!this.parent_op.isLogin()) {
            this.parent_op.alert(app.languageData.status_need_login);
            return false;
        }
        var node = document.getElementsByName(this.items_name);
        let check_count = 0;
        for (let i = 0; i < node.length; i++) {
            let inode = node[i];
            let check = inode.getAttribute('data-check');
            if (check === 'true') {
                //do something
                check_count++;
                let ukey = inode.getAttribute('tldata');
                this.parent_op.download_file_url(ukey, (downloadURL) => {
                    $('#copy-modal-body').html($('#copy-modal-body').html() + `${downloadURL}\n`);
                });
            }
        }
        if (check_count === 0) {
            this.parent_op.alert(app.languageData.status_error_12);
            return false;
        }
        // //打开复制窗口
        // let base64_text = window.btoa($('#copy-modal-body').html());
        // $('#copy-modal-body').attr('base64',base64_text);
        $('#copyModal').modal('show');
    }

    //todo: 移动文件到文件夹，如果选中的项目包含了文件夹，则提示不会对文件夹进行移动
    moveToModel(type) {
        var node = document.getElementsByName(this.items_name);
        this.move_place = type;
        
        // 收集被选中的文件夹ID，用于在树形结构中排除
        let excludeFolderIds = [];
        for (let i = 0; i < node.length; i++) {
            var inode = node[i];
            let check = inode.getAttribute('data-check');
            let unit_type = inode.getAttribute('tlunit');
            let id = inode.getAttribute('tldata');
            if (check === 'true' && unit_type === 'dir') {
                excludeFolderIds.push(id);
            }
        }
        // 将排除的文件夹ID传递给 dir 对象
        this.parent_op.dir.setExcludeFolderIds(excludeFolderIds);
        
        for (let i = 0; i < node.length; i++) {
            var inode = node[i];
            let check = inode.getAttribute('data-check');
            if (check === 'true'){
                // 每次都重新渲染树形结构，以确保排除列表生效
                $('#mv_box_0').empty();
                this.parent_op.dir.treeShow(0);
                this.dir_tree_init = true;
                $('#movefileModal').modal('show');
                return true;
            }
        }

        alert(app.languageData.status_error_12);
        return false;
    }

    moveToDir() {
        var node = document.getElementsByName(this.items_name);
        let data = [];
        for (let i = 0; i < node.length; i++) {
            var inode = node[i];
            let check = inode.getAttribute('data-check');
            let id = inode.getAttribute('tldata');
            let unit_type = inode.getAttribute('tlunit');
            if (check === 'true'){
                //do something
                data.push({'id':id,'type':unit_type});
            }
        }
        this.parent_op.dir.moveTo(data, this.move_place);
    }

    directCopy(type) {
        var node = document.getElementsByName(this.items_name);
        let copyText = '';
        for (let i = 0; i < node.length; i++) {
            var inode = node[i];
            let check = inode.getAttribute('data-check');
            if (check === 'true'&&inode.getAttribute('tlunit')==='file') {
                //do something
                let dkey = inode.getAttribute('tldata');
                let fname = inode.getAttribute('tltitle');
                let did = inode.getAttribute('tldid');
                let dir_key = this.parent_op.direct.dir_key;
                let direct_link_domain = this.parent_op.direct.domain;
                let direct_link_protocol = this.parent_op.direct.protocol;
                //get file url
                let urldata = this.parent_op.direct.genLinkDirect(dkey, fname);
                //create copy text
                switch (type) {
                    case 'staticDirLink':
                        copyText += `${direct_link_protocol}${direct_link_domain}/dir/${dir_key}/${did}/${fname}\n`;
                        break;
                    case 'downloadURLForText':
                        copyText += `${fname}\n${urldata.download}\n`;
                        break;
                    case 'downloadURLForHTML':
                        copyText += `<a href="${urldata.download}" target="_blank">${fname}</a>\n`;
                        break;
                    case 'streamURLForText':
                        if (this.parent_op.direct.is_allow_play(fname)) {
                            copyText += `${fname}\n${urldata.play}\n`;
                        }
                        break;
                    case 'streamURLForHTML':
                        if (this.parent_op.direct.is_allow_play(fname)) {
                            copyText += `<a href="${urldata.play}" target="_blank">${fname}</a>\n`;
                        }
                        break;
                    case 'resURLForText':
                        copyText += `${urldata.download}\n`;
                        break;
                    case 'resURLForHTML':
                        copyText += `<a href="${urldata.download}" target="_blank">${fname}</a>\n`;
                        break;
                }
            }
        }

        //打开复制窗口
        if (copyText !== '') {
            $('#copy-modal-body').html(copyText);
            $('#copyModal').modal('show');
        }
    }

    async copyModelCP() {
        try {
            await copyToClip($('#copy-modal-body').text());
            let tmp = $('#copy-modal-btn').html();
            $('#copy-modal-btn').html(app.languageData.copied);
            setTimeout(() => {
                $('#copy-modal-btn').html(tmp);
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }

    directAddlinks() {
        var node = document.getElementsByName(this.items_name);
        let ukeys = [];
        for (let i = 0; i < node.length; i++) {
            var inode = node[i];
            let check = inode.getAttribute('data-check');
            let unit_type = inode.getAttribute('tlunit');//是否是文件夹又或者是文件
            if (check === 'true'&&unit_type==='file') {
                //do something
                let ukey = inode.getAttribute('tldata');
                ukeys.push(ukey);
            }
        }

        //打开复制窗口
        if (ukeys.length > 0) {
            this.parent_op.direct.addLinks(ukeys);
        }
    }

    directDelete() {
        var node = document.getElementsByName(this.items_name);
        let ukeys = [];
        for (let i = 0; i < node.length; i++) {
            var inode = node[i];
            let check = inode.getAttribute('data-check');
            if (check === 'true') {
                //do something
                let ukey = inode.getAttribute('tldata');
                ukeys.push(ukey);
            }
        }

        //打开复制窗口
        if (ukeys.length > 0) {
            this.parent_op.direct.delLinks(ukeys);
        }
    }
}
