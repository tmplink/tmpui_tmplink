document.addEventListener('DOMContentLoaded', function() {
    const config = {
        defaultLang: 'en',
        availableLangs: {
            'en': '/json/en.json',
            'cn': '/json/cn.json',
            'hk': '/json/hk.json',
            'jp': '/json/jp.json'
        }
    };

    function getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    function getLanguage() {
        const urlLang = getQueryParam('lang');
        if (urlLang && config.availableLangs[urlLang]) {
            return urlLang;
        }
        
        const storedLang = localStorage.getItem('tmplink_legal_lang');
        if (storedLang && config.availableLangs[storedLang]) {
            return storedLang;
        }

        const browserLang = navigator.language.substring(0, 2).toLowerCase();
        // Mapping common browser codes to our specific keys if needed
        if (browserLang === 'zh') {
            return navigator.language.includes('TW') || navigator.language.includes('HK') ? 'hk' : 'cn';
        }
        if (browserLang === 'ja') return 'jp';
        
        return config.availableLangs[browserLang] ? browserLang : config.defaultLang;
    }

    function setLanguage(lang) {
        if (!config.availableLangs[lang]) return;
        localStorage.setItem('tmplink_legal_lang', lang);
        
        // Update URL without reloading if possible, or just reload
        const url = new URL(window.location);
        url.searchParams.set('lang', lang);
        window.history.pushState({}, '', url);
        
        loadLanguage(lang);
        
        // Update selector
        const selector = document.getElementById('lang-selector');
        if (selector) selector.value = lang;

        // Update html lang attribute
        document.documentElement.lang = lang;
    }

    async function loadLanguage(lang) {
        try {
            const response = await fetch(config.availableLangs[lang]);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            applyTranslations(data);
        } catch (e) {
            console.error('Failed to load language:', e);
        }
    }

    function applyTranslations(data) {
        const elements = document.querySelectorAll('[i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('i18n');
            if (data[key]) {
                // If the content contains HTML tags, use innerHTML, otherwise innerText
                if (data[key].includes('<') && data[key].includes('>')) {
                    el.innerHTML = data[key];
                } else {
                    el.innerText = data[key];
                }
            }
        });
        
        // Special case handling for links that might need dynamic behavior or replacement
        // For example, if there's a privacy link in TOS
    }

    function initLanguageSwitcher() {
        const selector = document.getElementById('lang-selector');
        if (!selector) return;

        selector.addEventListener('change', (e) => {
            setLanguage(e.target.value);
        });
    }

    const currentLang = getLanguage();
    initLanguageSwitcher();
    setLanguage(currentLang);
});
