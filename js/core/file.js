class file {
    parent_op = null
    model = 0

    init(parent_op) {
        this.parent_op = parent_op;
        this.model = 0;
    }

    changeModelSet(model) {
        //可用的数值为 0,1,2,99，检查输入值是否正确
        if (model == 1 || model == 2 || model == 0 || model == 99) {
            this.model = model;
            this.changeModelDraw();
            return true;
        }
    }

    changeModelDraw() {
        let model = this.model;
        $('.filemodel').removeClass('card-selected');
        if (model == 1 || model == 2 || model == 0 || model == 99) {
            $('.filemodel-' + model).addClass('card-selected');
        }
    }

    changeModel(ukeys) {

        //如果 ukeys 不是数组，直接重新赋值为数组
        if (!Array.isArray(ukeys)) {
            ukeys = [ukeys];
        }

        $.post(this.parent_op.api_file, {
            action: 'change_model',
            token: this.parent_op.api_token,
            ukeys: ukeys,
            model: this.model,
        }, (rsp) => {
            if (rsp.status == 1) {
                alert(app.languageData.changemodel_msg_1);
                //刷新文件列表
                this.parent_op.dir.filelist(0);
            }
            if (rsp.status == 2) {
                alert(app.languageData.changemodel_msg_2);
            }
            if (rsp.status == 3) {
                alert(app.languageData.changemodel_msg_3);
            }
            if (rsp.status == 4) {
                alert(app.languageData.changemodel_msg_4);
            }
        }, 'json');

        $('#changeModelModal').modal('hide');
    }
}
