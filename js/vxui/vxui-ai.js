'use strict';

const VX_AI = {
    init() {
        document.body.classList.add('vx-ai-active');
    },
    destroy() {
        document.body.classList.remove('vx-ai-active');
    }
};

VXUI.registerModule('ai', VX_AI);
