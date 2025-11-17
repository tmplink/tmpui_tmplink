/**
 * Local Wallpaper Manager
 * Handles rotation of local wallpaper images
 */
class BingWallpaperManager {
    constructor() {
        this.cacheKey = 'bing_wallpaper_cache';
        this.lastUpdateKey = 'bing_wallpaper_last_update';
        this.updateInterval = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
        // this.localWallpapers = [
        //     '/img/bimg/wallpaper_1.jpg',
        //     '/img/bimg/wallpaper_2.jpg',
        //     '/img/bimg/wallpaper_3.jpg',
        //     '/img/bimg/wallpaper_4.jpg',
        //     '/img/bimg/wallpaper_5.jpg',
        //     '/img/bimg/wallpaper_6.jpg',
        //     '/img/bimg/wallpaper_7.jpg',
        //     '/img/bimg/wallpaper_8.jpg'
        // ];
        this.localWallpapers = [
            '/img/bg/wallpaper_1.jpg',
            '/img/bg/wallpaper_2.jpg'
        ];
        this.currentWallpaperIndexKey = 'bing_wallpaper_current_index';
    }

    /**
     * Initialize the Bing wallpaper manager
     */
    init() {
        console.log('BingWallpaperManager: Initializing...');
        
        // Check if it's a mobile device
        if (this.isMobileDevice()) {
            console.log('Bing wallpaper disabled on mobile devices');
            return;
        }
        
        console.log('BingWallpaperManager: Desktop/tablet device detected');
        
        // First, try to apply cached wallpaper immediately if available
        const cachedData = this.getCachedWallpaper();
        if (cachedData && cachedData.localUrl) {
            console.log('BingWallpaperManager: Applying cached wallpaper immediately');
            this.applyWallpaper(cachedData.localUrl);
        }
        
        // Then check if we should update the wallpaper
        if (this.shouldUpdate()) {
            console.log('BingWallpaperManager: Fetching new wallpaper in background...');
            this.fetchAndUpdateWallpaper();
        } else {
            console.log('BingWallpaperManager: Using cached wallpaper, no update needed');
        }
    }
    
    /**
     * Check if current device is a mobile phone
     * @returns {boolean}
     */
    isMobileDevice() {
        // Use the same logic as the main app
        if (typeof isMobileScreen === 'function') {
            return isMobileScreen();
        }
        
        // Fallback detection
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isMobile = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
        
        // Also check screen size - tablets typically have width >= 768px
        const screenWidth = window.screen.width;
        const isSmallScreen = screenWidth < 768;
        
        return isMobile && isSmallScreen;
    }

    /**
     * Check if we should update the wallpaper based on the last update time
     * @returns {boolean}
     */
    shouldUpdate() {
        const lastUpdate = localStorage.getItem(this.lastUpdateKey);
        if (!lastUpdate) return true;
        
        const timeSinceUpdate = Date.now() - parseInt(lastUpdate);
        return timeSinceUpdate > this.updateInterval;
    }
    

    /**
     * Get cached wallpaper data
     * @returns {object|null}
     */
    getCachedWallpaper() {
        const cached = localStorage.getItem(this.cacheKey);
        if (!cached) return null;
        
        try {
            return JSON.parse(cached);
        } catch (e) {
            console.error('Failed to parse cached wallpaper data:', e);
            return null;
        }
    }

    /**
     * Cache wallpaper data
     * @param {object} data - Wallpaper data to cache
     */
    cacheWallpaper(data) {
        try {
            localStorage.setItem(this.cacheKey, JSON.stringify(data));
            localStorage.setItem(this.lastUpdateKey, Date.now().toString());
        } catch (e) {
            console.error('Failed to cache wallpaper data:', e);
        }
    }

    /**
     * Get the current wallpaper index based on time
     * @returns {number}
     */
    getCurrentWallpaperIndex() {
        const lastUpdate = localStorage.getItem(this.lastUpdateKey);
        const currentIndex = parseInt(localStorage.getItem(this.currentWallpaperIndexKey) || '-1');
        
        // If this is the first time (no lastUpdate or currentIndex is -1)
        if (!lastUpdate || currentIndex === -1) {
            // Start with the first wallpaper
            localStorage.setItem(this.currentWallpaperIndexKey, '0');
            return 0;
        }
        
        // If we should update (12 hours have passed)
        if (this.shouldUpdate()) {
            // Move to next wallpaper
            const nextIndex = (currentIndex + 1) % this.localWallpapers.length;
            localStorage.setItem(this.currentWallpaperIndexKey, nextIndex.toString());
            return nextIndex;
        }
        
        // Otherwise, return the current wallpaper
        return currentIndex;
    }

    /**
     * Fetch wallpaper data from local files
     * @returns {Promise<object>}
     */
    async fetchBingWallpaper() {
        try {
            // Get the current wallpaper based on time
            const wallpaperIndex = this.getCurrentWallpaperIndex();
            const imageUrl = this.localWallpapers[wallpaperIndex];
            
            return {
                url: imageUrl,
                title: `Local Wallpaper ${wallpaperIndex + 1}`,
                copyright: '',
                date: new Date().toISOString(),
                index: wallpaperIndex
            };
        } catch (error) {
            console.error('Failed to fetch local wallpaper:', error);
            // Fallback to first wallpaper
            return {
                url: this.localWallpapers[0],
                title: 'Local Wallpaper 1',
                copyright: '',
                date: new Date().toISOString(),
                index: 0
            };
        }
    }

    /**
     * Fetch random wallpaper from local files
     * @returns {Promise<object>}
     */
    async fetchRandomWallpaper() {
        try {
            // Get a random wallpaper
            const randomIndex = Math.floor(Math.random() * this.localWallpapers.length);
            const imageUrl = this.localWallpapers[randomIndex];
            
            return {
                url: imageUrl,
                title: `Local Wallpaper ${randomIndex + 1}`,
                copyright: '',
                date: new Date().toISOString(),
                index: randomIndex
            };
        } catch (error) {
            console.error('Random wallpaper fetch failed:', error);
            return null;
        }
    }

    /**
     * Process local wallpaper URL
     * @param {string} url - Image URL
     * @returns {Promise<string>} - Image URL (direct use)
     */
    async downloadImage(url) {
        // Local files can be used directly
        return url;
    }

    /**
     * Apply wallpaper to the background
     * @param {string} imageUrl - URL of the wallpaper image
     */
    applyWallpaper(imageUrl) {
        console.log('BingWallpaperManager: Applying wallpaper:', imageUrl);
        
        // Check if TL is available
        if (!window.TL) {
            console.log('BingWallpaperManager: TL not available yet, retrying in 1 second');
            setTimeout(() => this.applyWallpaper(imageUrl), 1000);
            return;
        }
        
        // Check if user has custom wallpaper set
        if (window.TL.mybg_light !== 0 || window.TL.mybg_dark !== 0) {
            console.log('BingWallpaperManager: User has custom wallpaper, skipping Bing wallpaper');
            return;
        }
        
        // Check if we're currently using default SVG backgrounds
        const currentLight = window.TL.system_background.light[0];
        const currentDark = window.TL.system_background.dark[0];
        const isUsingDefaultBg = currentLight && currentLight.includes('/img/bg/') && currentLight.endsWith('.svg');
        
        if (!isUsingDefaultBg) {
            console.log('BingWallpaperManager: Not using default background, skipping replacement');
            return;
        }
        
        console.log('BingWallpaperManager: Replacing default SVG backgrounds with Bing wallpaper');
        
        // Store original backgrounds if not already stored
        if (!this.originalBackgrounds) {
            this.originalBackgrounds = {
                light: [...window.TL.system_background.light],
                dark: [...window.TL.system_background.dark]
            };
            console.log('BingWallpaperManager: Stored original backgrounds:', this.originalBackgrounds);
        }
        
        // Preload the image first, then apply with fadeIn effect
        this.preloadAndApplyImage(imageUrl);
    }
    
    /**
     * Preload image and apply with fadeIn effect
     * @param {string} imageUrl - URL of the image to preload and apply
     */
    preloadAndApplyImage(imageUrl) {
        console.log('BingWallpaperManager: Preloading image:', imageUrl);
        
        // Create a new image element to preload
        const img = new Image();
        
        img.onload = () => {
            console.log('BingWallpaperManager: Image loaded successfully, applying with fadeIn');
            
            // Update system backgrounds
            if (window.TL && window.TL.system_background) {
                window.TL.system_background.light = [imageUrl];
                window.TL.system_background.dark = [imageUrl];
                console.log('BingWallpaperManager: Updated system backgrounds');
                
                // Apply the wallpaper with fadeIn effect
                this.applyWithFadeIn(imageUrl);
            }
        };
        
        img.onerror = () => {
            console.error('BingWallpaperManager: Failed to load image:', imageUrl);
            // Try to fetch a new wallpaper as fallback
            this.fetchRandomWallpaper().then(fallbackData => {
                if (fallbackData) {
                    console.log('BingWallpaperManager: Trying fallback wallpaper');
                    this.preloadAndApplyImage(fallbackData.url);
                }
            });
        };
        
        // Start loading the image
        img.src = imageUrl;
    }
    
    /**
     * Apply wallpaper with fadeIn effect
     * @param {string} imageUrl - URL of the wallpaper
     */
    applyWithFadeIn(imageUrl) {
        const night = window.TL.matchNightModel();
        const bgWrapImg = $('#background_wrap_img');
        
        if (bgWrapImg.length > 0) {
            // Fade out current background
            bgWrapImg.fadeOut(100, () => {
                // Set new background
                bgWrapImg.css('background', `url("${imageUrl}") no-repeat center`);
                bgWrapImg.css('background-size', 'cover');
                
                // Fade in new background
                bgWrapImg.fadeIn(100);
                console.log('BingWallpaperManager: Applied wallpaper with fadeIn effect');
            });
        } else {
            // Fallback to original method if elements not found
            console.log('BingWallpaperManager: Background elements not found, using fallback method');
            window.TL.bgLoadImg1(night);
        }
    }
    
    /**
     * Remove Bing wallpaper from backgrounds (restore original)
     */
    removeWallpaper() {
        if (window.TL && window.TL.system_background && this.originalBackgrounds) {
            console.log('BingWallpaperManager: Restoring original backgrounds');
            window.TL.system_background.light = [...this.originalBackgrounds.light];
            window.TL.system_background.dark = [...this.originalBackgrounds.dark];
            console.log('BingWallpaperManager: Restored original backgrounds');
            
            // Clear the cached wallpaper
            localStorage.removeItem(this.cacheKey);
            localStorage.removeItem(this.lastUpdateKey);
            
            // Reload background if already loaded
            if (window.TL.bgLoaded) {
                const night = window.TL.matchNightModel();
                window.TL.bgLoadImg1(night);
            }
        }
    }
    
    /**
     * Check if Bing wallpaper is currently active
     * @returns {boolean}
     */
    isActive() {
        if (!window.TL || !window.TL.system_background) return false;
        
        // Check if user has custom wallpaper
        if (window.TL.mybg_light !== 0 || window.TL.mybg_dark !== 0) {
            return false;
        }
        
        // Check if current background is from local wallpapers (not original SVG)
        const currentLight = window.TL.system_background.light[0];
        const currentDark = window.TL.system_background.dark[0];
        
        return currentLight && currentLight.includes('/img/bimg/wallpaper_') && 
               currentDark && currentDark.includes('/img/bimg/wallpaper_');
    }

    /**
     * Fetch and update wallpaper
     */
    async fetchAndUpdateWallpaper() {
        // Double check for mobile device
        if (this.isMobileDevice()) {
            return;
        }
        
        try {
            const wallpaperData = await this.fetchBingWallpaper();
            if (!wallpaperData) {
                console.error('Failed to fetch wallpaper data');
                return;
            }
            
            // Use the image URL directly (no need to download)
            wallpaperData.localUrl = wallpaperData.url;
            
            // Cache the wallpaper data
            this.cacheWallpaper(wallpaperData);
            
            // Apply the wallpaper
            this.applyWallpaper(wallpaperData.localUrl);
            
            console.log('Bing wallpaper updated successfully:', wallpaperData.title);
        } catch (error) {
            console.error('Error updating Bing wallpaper:', error);
        }
    }

    /**
     * Force update wallpaper (for testing)
     */
    forceUpdate() {
        if (this.isMobileDevice()) {
            console.log('Bing wallpaper is disabled on mobile devices');
            return;
        }
        localStorage.removeItem(this.lastUpdateKey);
        this.fetchAndUpdateWallpaper();
    }
    
    /**
     * Get current wallpaper info
     * @returns {object|null}
     */
    getCurrentWallpaperInfo() {
        return this.getCachedWallpaper();
    }
    
    /**
     * Check if using Bing wallpaper
     * @returns {boolean}
     */
    isUsingBingWallpaper() {
        const cached = this.getCachedWallpaper();
        if (!cached) return false;
        
        // Check if the cached wallpaper is being used
        if (window.TL && window.TL.system_background) {
            return window.TL.system_background.light.includes(cached.localUrl) ||
                   window.TL.system_background.dark.includes(cached.localUrl);
        }
        return false;
    }
}

// Create global instance
window.bingWallpaperManager = new BingWallpaperManager();

// Add test functions to window for debugging
window.testBingWallpaper = function() {
    console.log('=== Testing Bing wallpaper ===');
    console.log('Is mobile device:', window.bingWallpaperManager.isMobileDevice());
    console.log('Should update:', window.bingWallpaperManager.shouldUpdate());
    console.log('Cached wallpaper:', window.bingWallpaperManager.getCachedWallpaper());
    console.log('Is Bing wallpaper active:', window.bingWallpaperManager.isActive());
    
    if (window.TL) {
        console.log('TL available');
        console.log('Custom backgrounds - Light:', window.TL.mybg_light, 'Dark:', window.TL.mybg_dark);
        console.log('System backgrounds:', window.TL.system_background);
        console.log('Background loaded:', window.TL.bgLoaded);
        console.log('Original backgrounds stored:', !!window.bingWallpaperManager.originalBackgrounds);
    } else {
        console.log('TL not available');
    }
    
    // Force init for testing
    window.bingWallpaperManager.init();
};

window.removeBingWallpaper = function() {
    console.log('Removing Bing wallpaper...');
    window.bingWallpaperManager.removeWallpaper();
};

window.forceBingWallpaperUpdate = function() {
    console.log('Force updating Bing wallpaper...');
    window.bingWallpaperManager.forceUpdate();
};

window.getBingWallpaperStatus = function() {
    console.log('=== Bing Wallpaper Status ===');
    console.log('Active:', window.bingWallpaperManager.isActive());
    console.log('Cached data:', window.bingWallpaperManager.getCachedWallpaper());
    console.log('Last update:', localStorage.getItem(window.bingWallpaperManager.lastUpdateKey));
    if (window.TL && window.TL.system_background) {
        console.log('Current backgrounds:', window.TL.system_background);
    }
};

window.simulateBackgroundLoad = function() {
    console.log('=== Simulating Background Load Process ===');
    if (window.TL) {
        console.log('1. Calling TL.checkAndLoadBingWallpaper()...');
        window.TL.checkAndLoadBingWallpaper();
    } else {
        console.log('TL not available');
    }
};

window.testFadeInEffect = function() {
    console.log('=== Testing FadeIn Effect ===');
    const cachedData = window.bingWallpaperManager.getCachedWallpaper();
    if (cachedData && cachedData.localUrl) {
        console.log('Testing fadeIn with cached wallpaper:', cachedData.localUrl);
        window.bingWallpaperManager.applyWithFadeIn(cachedData.localUrl);
    } else {
        console.log('No cached wallpaper available for testing');
        // Force fetch a new one for testing
        window.bingWallpaperManager.forceUpdate();
    }
};
