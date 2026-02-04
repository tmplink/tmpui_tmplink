/**
 * 复制内容到剪贴板的现代化实现，带有后备方案
 * @param {string} content 要复制的文本内容
 * @returns {Promise<void>} 返回一个 Promise，复制成功时 resolve，失败时 reject
 */
async function copyToClip(content) {
    try {
        // 首先尝试使用现代的 Clipboard API
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(content);
            return;
        }
        
        // 后备方案：使用传统的 document.execCommand 方法
        const textArea = document.createElement('textarea');
        textArea.value = content;
        
        // 设置样式使元素不可见
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        // 执行复制命令
        const success = document.execCommand('copy');
        
        // 清理
        document.body.removeChild(textArea);
        
        if (!success) {
            throw new Error("Clipboard operation failed");
        }
    } catch (err) {
        console.error("复制失败:", err);
        // 尝试最后的方法：提示用户手动复制
        alert("自动复制失败，请手动复制: " + content);
        throw err;
    }
}

/**
 * Adds dark mode styles to chart options with transparent background
 * @param {Object} options - Original chart options
 * @returns {Object} The modified options with theme styles
 */
function getChartThemeOptions(options) {
    // Detect dark mode
    const isDarkMode = 
        document.documentElement.classList.contains('dark') || 
        document.body.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches || 
        localStorage.getItem('theme') === 'dark';

    // Override styles
    return {
        ...options,
        chart: {
            ...options.chart,
            background: 'transparent',
            foreColor: isDarkMode ? '#e1e1e1' : '#304758',
            toolbar: {
                show: false
            }
        },
        grid: {
            ...options.grid,
            show: false
        },
        tooltip: {
            ...options.tooltip,
            theme: isDarkMode ? 'dark' : 'light'
        },
        dataLabels: {
            ...options.dataLabels,
            offsetY: -20,  // 恢复向上偏移
            style: {
                ...options.dataLabels?.style,
                colors: [isDarkMode ? '#e1e1e1' : '#304758']
            }
        },
        plotOptions: {
            ...options.plotOptions,
            bar: {
                ...options.plotOptions?.bar,
                columnWidth: '60%',
                borderRadius: 4
            }
        },
        yaxis: {
            ...options.yaxis,
            labels: {
                ...options.yaxis?.labels,
                style: {
                    colors: isDarkMode ? '#e1e1e1' : '#304758'
                }
            }
        },
        xaxis: {
            ...options.xaxis,
            labels: {
                ...options.xaxis?.labels,
                style: {
                    colors: isDarkMode ? '#e1e1e1' : '#304758'
                },
                offsetY: -10  // 保持 X 轴标签的上方偏移
            },
            axisBorder: {
                show: false
            },
            axisTicks: {
                show: false
            }
        }
    };
}

function getSortKeys() {
    let key = get_page_mrid();

    if (key === undefined) {
        key = 'workspace';
    }

    return {
        display: 'app_room_view_display_' + key,
        sort_by: 'app_room_view_sort_by_' + key,
        sort_type: 'app_room_view_sort_type_' + key,
    }

}

function listDataPrepare(data) {
    let new_data = {};
    for (let i in data) {
        new_data[data[i].ukey] = data[i];
    }
    return new_data;
}

function debug(log) {
    if (true) {
        console.log(log);
    }
}

function isiPad() {
    return (/macintosh|mac os x/i.test(navigator.userAgent) && window.screen.height > window.screen.width && !navigator.userAgent.match(/(iPhone\sOS)\s([\d_]+)/)) || navigator.userAgent.match(/(iPad).*OS\s([\d_]+)/);
}

function isMobile() {
    if (/(iphone|ipad|ipod|ios|android)/i.test(navigator.userAgent.toLowerCase())) {
        return true;
    } else {
        return false;
    };
}

function isMobileScreen() {
    return window.screen.width < 675;
}

// 调整透明度：隐藏
function opacityHide(dom) {
    var obj = document.querySelector(dom);
    obj.style.opacity = 0;
    obj.style.filter = "alpha(opacity=0)";
}

// 调整透明度：显示
function opacityShow(dom) {
    var obj = document.querySelector(dom);
    obj.style.opacity = 1;
    obj.style.filter = "alpha(opacity=100)";
}

//if iphone or ipad
function is_iphone_or_ipad() {
    //如果是 macos 或者 windows 设备
    if ((navigator.userAgent.match(/Macintosh/i) && isiPad() === null) || navigator.userAgent.match(/Windows/i)) {
        return false;
    }

    //如果是 android 设备
    if (navigator.userAgent.match(/Android/i)) {
        $('#anyconnect_android_device').show();
        return false;
    }

    //如果是 iPhone
    if (navigator.userAgent.match(/iPhone/i)) {
        return true;
    }

    return true;
}

/**
 * 获取当前页面的 url
 * @returns {string}
 */
function getCurrentURL() {
    var url = window.location.href;
    return url;
}

/**
 * 简化版倒计时函数，输出更紧凑的时间格式
 * @param {string} id - 要更新的DOM元素ID
 * @param {number} time - 剩余时间（秒）
 * @param {string} lang - 语言代码：'en', 'cn', 'hk', 'jp'，默认为'en'
 * @returns {boolean} - 操作是否成功
 */
function countDown(id, time, lang = 'en') {
    // 确保语言是支持的选项，否则默认为英语
    lang = ['en', 'cn', 'hk', 'jp'].includes(lang) ? lang : 'en';
    
    // 精简的时间单位文本
    const units = {
        'en': ['d', 'h', 'm', 's'],
        'cn': ['天', '时', '分', '秒'],
        'hk': ['天', '時', '分', '秒'],
        'jp': ['日', '時', '分', '秒']
    };
    
    // 如果时间为0或负数
    if (time <= 0) {
        let dom = document.getElementById(id);
        if (dom === null) return false;
        dom.innerHTML = "0" + units[lang][3];
        return false;
    }
    
    // 计算时间组件
    let d = Math.floor(time / 86400);
    let h = Math.floor((time % 86400) / 3600);
    let m = Math.floor((time % 3600) / 60);
    let s = time % 60;
    
    // 根据剩余时间级别确定显示格式
    let output = '';
    
    if (d > 0) {
        // 天级别：显示 "Xd Yh"
        output = `${d}${units[lang][0]} ${h}${units[lang][1]}`;
    } else if (h > 0) {
        // 小时级别：显示 "Xh Ym"
        output = `${h}${units[lang][1]} ${m}${units[lang][2]}`;
    } else if (m > 0) {
        // 分钟级别：显示 "Xm Ys"
        output = `${m}${units[lang][2]} ${s}${units[lang][3]}`;
    } else {
        // 秒级别：显示 "Xs"
        output = `${s}${units[lang][3]}`;
    }
    
    // 更新DOM
    let dom = document.getElementById(id);
    if (dom === null) return false;
    dom.innerHTML = output;
    
    // 根据显示的最小时间单位确定更新间隔
    let updateInterval, decreaseAmount;
    
    if (d > 0) {
        // 天级别显示：每小时更新一次
        updateInterval = 3600000; // 1小时 = 3600000毫秒
        decreaseAmount = 3600;    // 减少3600秒（1小时）
    } else if (h > 0) {
        // 小时级别显示：每分钟更新一次
        updateInterval = 60000;   // 1分钟 = 60000毫秒
        decreaseAmount = 60;      // 减少60秒（1分钟）
    } else {
        // 分钟或秒级别显示：每秒更新一次
        updateInterval = 1000;    // 1秒 = 1000毫秒
        decreaseAmount = 1;       // 减少1秒
    }
    
    // 安排下一次更新
    setTimeout(() => {
        countDown(id, time - decreaseAmount, lang);
    }, updateInterval);
    
    return true;
}

function bytetoconver(val, label) {

    //if undefined,return 0 B
    if (val === undefined) {
        return '0 B';
    }

    if (val < 1) {
        return '0 B';
    }

    var s = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    var e = Math.floor(Math.log(val) / Math.log(1024));
    var value = ((val / Math.pow(1024, Math.floor(e))).toFixed(2));
    e = (e < 0) ? (-e) : e;
    if (label) {
        value += ' ' + s[e];
    }
    return value;
}

function formatTime(s) {
    var day = Math.floor(s / (24 * 3600));
    var hour = Math.floor((s - day * 24 * 3600) / 3600);
    var minute = Math.floor((s - day * 24 * 3600 - hour * 3600) / 60);
    var second = s - day * 24 * 3600 - hour * 3600 - minute * 60;
    if (hour < 10) {
        hour = '0' + hour.toString();
    }
    if (minute < 10) {
        minute = '0' + minute.toString();
    }
    if (second < 10) {
        second = '0' + second.toString();
    }
    return hour + ":" + minute + ":" + second;
}

function get_url_params() {
    var vars = [],
        hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for (var i = 0; i < hashes.length; i++) {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
    }
    return vars;
}

function get_page_mrid() {
    var params = get_url_params();
    return params.mrid;
}

function Base64Encode(str) {
    // first we use encodeURIComponent to get percent-encoded UTF-8,
    // then we convert the percent encodings into raw bytes which
    // can be fed into btoa.
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode('0x' + p1);
        }));
}

function Base64Decode(str) {
    // Going backwards: from bytestream, to percent-encoding, to original string.
    return decodeURIComponent(atob(str).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}

function isIosPwaMode() {
    // 检查是否运行在 Safari 浏览器中
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // 检查是否启用了 PWA 模式
    const isInStandaloneMode = ('standalone' in window.navigator) && window.navigator.standalone;

    // 返回结果，如果同时满足 Safari 浏览器和 PWA 模式，则说明当前网页在 iOS PWA 模式下运行
    return isSafari && isInStandaloneMode;
}


function stripTags(html) {
    //处理例外情况
    if (typeof html !== 'string') {
        return '';
    }

    //另外情况2，没有 replace 方法
    if (!html.replace) {
        return html;
    }

    // 剔除 HTML 标签
    const strippedHtml = html.replace(/(<([^>]+)>)/gi, '');
    // 剔除转义字符
    const strippedText = strippedHtml.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');

    return strippedText;
}
