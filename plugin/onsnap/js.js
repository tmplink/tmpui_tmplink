/*!
 * jQuery Notifi Plugin v1.0
 * https://github.com/scullytr/notifi
 *
 * Copyright (c) 2019 Tim Scully;
 * Released under the MIT License (MIT)
 */
(function ($) {
    $.notifi = function (content, options) {
        var o = $.extend(true, {}, $.notifi.defaults, options),
            notificationBar = $('#ntf-notifications').length ? $('#ntf-notifications') : $('<div>', {
                "id": 'ntf-notifications',
                "style": 'background:transparent; position:fixed; text-align:center; width:100%; z-index:9999;'
            }).prependTo('body'),
            noticeClose = $(o.noticeClose),
            noticeContent = content || '&nbsp;',
            notice = $('<div>', { 'class': 'ntf-notice' }).addClass('shadow').addClass(o.noticeClass).append(noticeClose.addClass(o.noticeCloseClass)).prepend(noticeContent).appendTo(notificationBar);

        if (o.autoShowDelay) {
            setTimeout(function () {
                $.notifi.showNotice(notice, o);
            }, o.autoShowDelay);
        }
        else {
            $.notifi.showNotice(notice, o);
        }

        return notice;
    };

    $.notifi.showNotice = function (notice, o) {
        o = typeof o === "object" ? o : $.notifi.defaults;

        notice.slideDown(o.showSpeed, function () {
            if (o.shown) o.shown();

            var noticeClose = notice.children('.' + o.noticeCloseClass);

            noticeClose.on('click', function () {
                notice.slideUp(o.hideSpeed, function () {
                    notice.remove();

                    if (o.hidden) o.hidden();
                });
            });

            if (o.autoHideDelay) {
                setTimeout(function () {
                    $.notifi.hideNotice(notice, o)
                }, o.autoHideDelay);
            }
        });
    };

    $.notifi.hideNotice = function (notice, o) {
        o = typeof o === "object" ? o : $.notifi.defaults;

        notice.slideUp(o.hideSpeed, function () {
            notice.remove();

            if (o.hidden) o.hidden();
        });
    };

    $.notifi.defaults = {
        hidden: null,
        autoHideDelay: 2000,
        hideSpeed: 100,
        noticeClass: '',
        noticeClose: '',
        noticeCloseClass: 'ntf-notice-close',
        autoShowDelay: 0,
        shown: null,
        showSpeed: 100
    };
}(jQuery));
