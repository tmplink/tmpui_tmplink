/**
 * Modern Index Page Initialization
 * Handles the new modern homepage functionality while preserving existing features
 */

setThemeColor();

// API endpoints
const TMPLINK_API_USER = 'https://tmp-api.vx-cdn.com/api_v2/user';
const TMPLINK_API_TOKEN = 'https://tmp-api.vx-cdn.com/api_v2/token';

// Track login status
let isLoggedIn = false;

// Initialize area detection and redirect for China mainland users
initAreaDetection();

// Initialize when app is ready
app.ready(() => {
    initializeModernHomepage();
});

/**
 * Initialize the modern homepage
 */
function initializeModernHomepage() {
    const lang = app.languageSetting;
    langset(lang);
    app.languageBuild();
    
    // Update page metadata
    document.title = app.languageData.title_index;
    document.querySelector('meta[name=description]').setAttribute('content', app.languageData.des_index);
    
    // Initialize components
    initScrollEffects();
    initIntersectionObserver();
    initMenubarXTracking();
    autoLogin();
    sendAnalytics();
}

/**
 * Initialize area detection for China mainland users
 */
function initAreaDetection() {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', TMPLINK_API_TOKEN, true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    
    xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                const rsp = JSON.parse(xhr.responseText);
                if (rsp.data === 1) {
                    handleChinaMainlandRedirect();
                }
            }
        }
    };
    
    const params = new URLSearchParams();
    params.append('action', 'set_area');
    xhr.send(params.toString());
}

/**
 * Handle redirect for China mainland users
 */
function handleChinaMainlandRedirect() {
    if (window.location.hostname !== 'www.ttttt.link' && window.location.hostname !== '127.0.0.1') {
        const params = window.location.search || '';
        window.location.href = 'https://www.ttttt.link' + params;
    }
}

/**
 * Initialize scroll effects for modern interactions
 */
function initScrollEffects() {
    let ticking = false;
    
    function updateScrollEffects() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Hide/show language selector based on scroll position
        const languageBtn = document.getElementById('translater-btn');
        if (languageBtn) {
            if (scrollTop > 300) {
                languageBtn.style.display = 'none';
            } else {
                languageBtn.style.display = 'block';
            }
        }
        
        // Parallax effect for hero section
        const hero = document.getElementById('hero');
        if (hero && scrollTop < window.innerHeight) {
            const parallaxSpeed = 0.5;
            hero.style.transform = `translateY(${scrollTop * parallaxSpeed}px)`;
        }
        
        ticking = false;
    }
    
    function requestTick() {
        if (!ticking) {
            requestAnimationFrame(updateScrollEffects);
            ticking = true;
        }
    }
    
    window.addEventListener('scroll', requestTick, { passive: true });
}

/**
 * Initialize Intersection Observer for animation triggers
 */
function initIntersectionObserver() {
    // Skip if user prefers reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }
    
    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -100px 0px',
        threshold: 0.1
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                
                // Add staggered animation for feature boxes
                if (entry.target.classList.contains('feature-box')) {
                    const delay = Array.from(entry.target.parentElement.children).indexOf(entry.target) * 100;
                    entry.target.style.animationDelay = `${delay}ms`;
                }
            }
        });
    }, observerOptions);
    
    // Observe elements that should animate in
    document.querySelectorAll('.feature-box, .about-content, .feature-row').forEach(el => {
        observer.observe(el);
    });
}

/**
 * Initialize MenubarX tracking
 */
function initMenubarXTracking() {
    if (localStorage.getItem('from_menubarx') === null) {
        const url = new URL(location.href);
        const s = url.searchParams.get('s');
        
        if (s === 'mx') {
            localStorage.setItem('from_menubarx', '1');
        } else {
            localStorage.setItem('from_menubarx', '0');
        }
    }
}

/**
 * Set language and update UI
 */
function langset(lang) {
    const langMap = {
        'en': 'English',
        'cn': '简体中文',
        'hk': '繁体中文',
        'jp': '日本語'
    };
    
    const selectedLangElement = document.querySelector('.selected_lang');
    if (selectedLangElement) {
        selectedLangElement.textContent = langMap[lang] || 'English';
    }
    
    app.languageSet(lang);
}

/**
 * Navigate to login/workspace
 */
function Login() {
    // Add smooth transition effect
    document.body.style.opacity = '0.7';
    document.body.style.transition = 'opacity 0.3s ease';
    
    setTimeout(() => {
        // Direct navigation logic to avoid preload page
        if (isLoggedIn) {
            // User is logged in, redirect based on UI preference
            const uiPreference = localStorage.getItem('tmplink_ui_preference');
            if (uiPreference === 'classic') {
                location.href = '/?tmpui_page=/app&listview=room';
            } else {
                location.href = '/?tmpui_page=/vx';
            }
        } else {
             // Not logged in or validation failed, go to login
             location.href = '/?tmpui_page=/login';
        }
    }, 150);
}

/**
 * Auto-login functionality with modern UI feedback
 */
async function autoLogin() {
    const apiToken = localStorage.getItem('app_token');
    const startButton = document.querySelector('#index_start');
    
    if (!startButton) return;
    
    // Show modern loading state
    showLoadingState(startButton);
    
    if (apiToken) {
        try {
            const response = await fetch(TMPLINK_API_USER, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    action: 'get_detail',
                    token: apiToken
                })
            });
            
            if (response.ok) {
                const responseData = await response.json();
                if (responseData.status === 1) {
                    isLoggedIn = true;
                    showSuccessState(startButton);
                    setTimeout(() => Login(), 1000);
                } else {
                    showLoginButton(startButton);
                }
            } else {
                showLoginButton(startButton);
            }
        } catch (error) {
            console.error('Login request failed:', error);
            showLoginButton(startButton);
        }
    } else {
        showLoginButton(startButton);
    }
}

/**
 * Show loading state with modern spinner
 */
function showLoadingState(element) {
    element.innerHTML = `
        <div class="loading-container">
            <div class="modern-spinner"></div>
            <style>
                .loading-container {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 67px;
                }
                .modern-spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid rgba(255, 255, 255, 0.3);
                    border-top: 3px solid white;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        </div>
    `;
}

/**
 * Show success state with checkmark animation
 */
function showSuccessState(element) {
    element.innerHTML = `
        <div class="success-container">
            <div class="success-checkmark">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 11l3 3L22 4"></path>
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
                </svg>
            </div>
            <style>
                .success-container {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 67px;
                }
                .success-checkmark {
                    animation: successPulse 0.6s ease-out;
                }
                @keyframes successPulse {
                    0% { transform: scale(0.8); opacity: 0; }
                    50% { transform: scale(1.1); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
            </style>
        </div>
    `;
}

/**
 * Show login button with modern styling
 */
function showLoginButton(element) {
    const buttonText = app.languageData?.i2023_new_index_getting_start || 'Get Started';
    element.innerHTML = `<a href="javascript:;" class="btn-get-started" onclick="Login()">${buttonText}</a>`;
}

/**
 * Send analytics data
 */
function sendAnalytics() {
    const token = localStorage.getItem('app_token');
    if (token) {
        fetch(TMPLINK_API_USER, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                action: 'event_ui',
                token: token,
                title: 'TMPLINK - Modern Index',
                path: location.pathname + location.search
            })
        }).catch(error => {
            console.debug('Analytics request failed:', error);
        });
    }
}

/**
 * Set theme color based on system preference
 */
function setThemeColor() {
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeColorMeta) return;
    
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    themeColorMeta.setAttribute('content', isDarkMode ? '#1f2937' : '#ffffff');
    
    // Listen for theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        themeColorMeta.setAttribute('content', e.matches ? '#1f2937' : '#ffffff');
    });
}

/**
 * Enhanced error handling for graceful degradation
 */
window.addEventListener('error', (event) => {
    console.error('Modern index error:', event.error);
    // Fallback to basic functionality if modern features fail
});

/**
 * Performance monitoring
 */
if ('performance' in window) {
    window.addEventListener('load', () => {
        setTimeout(() => {
            const perfData = performance.getEntriesByType('navigation')[0];
            if (perfData && perfData.loadEventEnd - perfData.loadEventStart > 3000) {
                console.warn('Page load time exceeded 3 seconds');
            }
        }, 0);
    });
}
