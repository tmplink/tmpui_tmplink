// Mobile file page specific handlers
(function() {
    'use strict';

    // Unified button feedback helper
    function showButtonFeedback($btn, successText, duration) {
        const $icon = $btn.find('.action-icon-box iconpark-icon');
        const $label = $btn.find('.action-label');
        
        // Save original state
        const originalIconName = $icon.attr('name');
        const originalLabel = $label.text();
        
        // Change to success state
        $icon.attr('name', 'circle-check');
        $icon.css('color', '#22c55e');
        $label.text(successText);
        $label.css('color', '#22c55e');
        
        // Restore after specified duration
        setTimeout(() => {
            $icon.attr('name', originalIconName);
            $icon.css('color', '');
            $label.text(originalLabel);
            $label.css('color', '');
        }, duration);
    }

    // Copy button handler for mobile
    window.mobileCopyFileUrl = function() {
        const params = TL.get_url_params();
        const shareUrl = `https://${TL.site_domain}/f/${params.ukey}`;
        
        copyToClip(shareUrl).then(() => {
            const $copyBtn = $('#btn_copy_fileurl_mobile');
            showButtonFeedback($copyBtn, '已复制', 3000);
        }).catch(err => {
            console.error('Copy failed:', err);
        });
    };

    // Like button handler for mobile
    window.mobileLikeFile = function() {
        const params = TL.get_url_params();
        const $likeBtn = $('#likes');
        const $icon = $likeBtn.find('iconpark-icon');
        const $count = $('#likes_count');
        
        $.post(TL.api_file, {
            action: 'like',
            ukey: params.ukey,
            token: TL.api_token
        }, (rsp) => {
            let currentCount = parseInt($count.text()) || 0;
            
            if (rsp.status == 1) {
                // Liked
                $count.text(currentCount + 1);
                $icon.attr('name', 'like-fill');
                $icon.css('color', '#ef4444');
            } else {
                // Unliked
                $count.text(Math.max(0, currentCount - 1));
                $icon.attr('name', 'like');
                $icon.css('color', '');
            }
        });
    };

    // Track if file has been saved to my files
    let fileSaved = false;

    // Save to my files handler for mobile
    window.mobileSaveToMyFiles = function() {
        // Check if user is logged in
        if (typeof TL !== 'undefined' && TL.logined == 1) {
            const $btn = $('#btn_save_to_my_files_mobile');
            
            // Only execute actual operation on first click
            if (!fileSaved) {
                const params = TL.get_url_params();
                // Call dir.saveToMyFiles
                TL.dir.saveToMyFiles(params.ukey);
                fileSaved = true;
            }
            
            // Always show visual feedback
            showButtonFeedback($btn, '已收藏', 3000);
        } else {
            // Not logged in, redirect to login
            app.open('/app&listview=login');
        }
    };

})();
