/**
 * AI 聊天页面初始化脚本 (Listview模式)
 */
function INIT_ai() {
    TL.ready(() => {
        // 检查用户登录状态
        if (TL.isLogin() === false) {
            app.open('/login')
            return
        }
        
        // 初始化AI界面和功能
        TL.ai.initUI()
    })
}
