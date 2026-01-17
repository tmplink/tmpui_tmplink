app.ready(() => {
    // 文件页独立初始化 TL 对象
    if (typeof window.TL === 'undefined') {
        if (typeof window.tmplink_api !== 'undefined') {
            window.TL = new tmplink_api();
        } else {
            window.TL = new tmplink();
        }
    }

    if (typeof TL !== 'undefined' && typeof stream === 'function' && !TL.stream) {
        TL.stream = new stream();
        TL.stream.init(TL);
    }

    if (isMobileScreen()) {
        $('#file-view').html(app.getFile('/tpl/file_mobile.html'));
    } else {
        $('#file-view').html(app.getFile('/tpl/file_desktop.html'));
    }

    app.languageBuild();
    $('title').html(app.languageData.title_file);
    $('meta[name=description]').html(app.languageData.des_file);

    TL.ready(() => {
        if (typeof window.filePage !== 'undefined' && typeof window.filePage.loadFileDetails === 'function') {
            window.filePage.loadFileDetails();
        }

        if (typeof TL.report !== 'function' && typeof window.filePage !== 'undefined' && typeof window.filePage.reportFile === 'function') {
            TL.report = () => window.filePage.reportFile();
        }
        
        // 添加用户信息卡片的鼠标悬停事件
        initUserInfoCard();
    });
    
});

/**
 * 初始化用户信息卡片的交互
 */
function initUserInfoCard() {
    // 检测是否是触摸设备
    const isTouchDevice = ('ontouchstart' in window) || 
                          (navigator.maxTouchPoints > 0) || 
                          (navigator.msMaxTouchPoints > 0);
    
    if (isTouchDevice) {
        // 触摸设备使用点击事件
        setupTouchInteraction();
    } else {
        // 桌面设备使用悬停事件
        setupDesktopInteraction();
    }
    
    // 确保无论点击卡片的哪个部分都不会触发下层元素的点击事件
    $('.user-info-card').on('click', function(e) {
        e.stopPropagation();
    });
}

/**
 * 为触摸设备设置交互行为
 */
function setupTouchInteraction() {
    // 信息按钮点击显示/隐藏用户卡片
    $('.btn-user-info').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation(); // 阻止事件冒泡
        
        // 切换卡片的显示状态
        if ($('.user-info-card').is(':visible')) {
            $('.user-info-card').hide();
        } else {
            updateCardContent();
            $('.user-info-card').show();
        }
    });
    
    // 点击页面其他区域时隐藏卡片
    $(document).on('click touchstart', function(e) {
        // 如果点击的不是卡片内部且卡片正在显示，则隐藏卡片
        if (!$(e.target).closest('.user-info-card').length && 
            !$(e.target).closest('.btn-user-info').length && 
            $('.user-info-card').is(':visible')) {
            $('.user-info-card').hide();
        }
    });
}

/**
 * 为桌面设备设置交互行为
 */
function setupDesktopInteraction() {
    // 信息按钮悬停显示用户卡片
    $('.btn-user-info').on({
        mouseenter: function() {
            showUserInfoCard();
        }
    });
    
    // 信息按钮点击显示/隐藏用户卡片（桌面设备也支持点击）
    $('.btn-user-info').on('click', function(e) {
        e.preventDefault();
        
        // 切换卡片的显示状态
        if ($('.user-info-card').is(':visible')) {
            $('.user-info-card').hide();
        } else {
            updateCardContent();
            $('.user-info-card').show();
        }
    });
    
    // 用户信息卡片的鼠标事件
    $('.user-info-card').on({
        mouseenter: function() {
            // 鼠标进入卡片时保持显示
            clearTimeout(window.userInfoCardTimer);
        },
        mouseleave: function() {
            // 鼠标离开卡片时隐藏
            hideUserInfoCard();
        }
    });
    
    // 鼠标离开按钮时，如果不在卡片上，则隐藏卡片
    $('.btn-user-info').on('mouseleave', function() {
        setTimeout(function() {
            if (!$('.user-info-card:hover').length) {
                hideUserInfoCard();
            }
        }, 100);
    });
}

/**
 * 显示用户信息卡片并填充数据
 */
function showUserInfoCard() {
    // 清除可能的隐藏计时器
    clearTimeout(window.userInfoCardTimer);
    
    // 更新卡片内容
    updateCardContent();
    
    // 立即显示卡片，不使用渐变效果
    $('.user-info-card').show();
}

/**
 * 更新卡片内容
 */
function updateCardContent() {
    // 复制昵称到卡片中
    $('.userinfo_card_nickname').text($('.userinfo_nickname').text());
    
    // 处理认证状态
    let isPro = false;
    if ($('.userinfo_pro').is(':visible')) {
        $('.userinfo_card_pro').show();
        isPro = true;
        
        // 为赞助者名字添加特殊样式
        $('.userinfo_card_nickname').addClass('is-pro');
    } else {
        $('.userinfo_card_pro').hide();
        $('.userinfo_card_nickname').removeClass('is-pro');
    }
    
    // 获取用户头像信息
    let avatarSrc = $('.userinfo_avatar_img').attr('src');
    if (avatarSrc && avatarSrc !== '/img/loading.svg') {
        $('.userinfo_avatar_card_img').attr('src', avatarSrc);
    }
    
    // 获取并显示用户简介信息
    if ($('.userinfo_card_intro').text() === '个人介绍信息') {
        // 从文件详情中获取用户简介
        if (TL.current_file_details) {
            // 尝试从API返回数据中获取
            if (TL.current_file_details.ui_intro) {
                $('.userinfo_card_intro').text(TL.current_file_details.ui_intro);
            } else {
                // 请求用户信息
                getUserIntro();
            }
        } else {
            // 默认简介
            $('.userinfo_card_intro').text('这是通过TMP.link分享的文件，点击即可下载');
        }
    }
}

/**
 * 获取用户简介信息
 */
function getUserIntro() {
    // 检查当前文件详情
    if (TL.current_file_details) {
        // 首先检查是否已存在用户介绍
        if (TL.current_file_details.ui_intro) {
            $('.userinfo_card_intro').text(TL.current_file_details.ui_intro);
            return;
        }
        
        // 检查是否存在user_saved_intro元素
        // 这个元素可能在profile.js中被填充
        if ($('.user_saved_intro').length > 0) {
            let intro = $('.user_saved_intro').text();
            if (intro && intro !== app.languageData.user_saved_content) {
                // 使用用户的实际介绍
                $('.userinfo_card_intro').text(intro);
                // 保存到当前文件详情中
                if (TL.current_file_details) {
                    TL.current_file_details.ui_intro = intro;
                }
                return;
            }
        }
        
        // 如果无法获取到用户介绍，生成一个默认的
        setDefaultIntro();
    } else {
        // 无文件详情，使用默认介绍
        setDefaultIntro();
    }
}

/**
 * 设置默认介绍文本
 */
function setDefaultIntro() {
    if (TL.current_file_details && TL.current_file_details.ui_nickname) {
        let nickname = TL.current_file_details.ui_nickname;
        let isPro = TL.current_file_details.ui_pro === 'yes';
        
        // 根据用户类型生成不同的介绍
        let intro = '';
        if (isPro) {
            // 认证用户
            intro = `「${nickname}」是TMP.link的认证用户，分享的文件将自动提供高速下载服务。`;
        } else {
            // 普通用户
            intro = `「${nickname}」通过TMP.link分享了这个文件。`;
        }
            
        $('.userinfo_card_intro').text(intro);
        // 保存为生成的介绍，并标记为默认介绍
        if (TL.current_file_details) {
            TL.current_file_details.ui_intro = intro;
            TL.current_file_details.ui_intro_is_default = true;
        }
    } else {
        // 最基本的默认文本
        $('.userinfo_card_intro').text('这是通过TMP.link分享的文件，点击即可下载。');
    }
}

/**
 * 隐藏用户信息卡片
 */
function hideUserInfoCard() {
    window.userInfoCardTimer = setTimeout(function() {
        // 立即隐藏卡片，不使用渐变效果
        $('.user-info-card').hide();
    }, 200);
}
