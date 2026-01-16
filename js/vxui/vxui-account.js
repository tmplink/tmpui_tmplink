/**
 * VXUI Account Module
 * 账户中心模块 - 用户信息、设置、Google 绑定
 */

const VX_ACCOUNT = {
    // Current state
    currentTab: 'info',

    /**
     * Initialize Account Info module (separate route)
     */
    initInfo(params = {}) {
        console.log('[VX_ACCOUNT] Initializing profile module...', params);

        // Check login
        if (typeof TL !== 'undefined' && !TL.isLogin()) {
            VXUI.toastWarning('请先登录');
            setTimeout(() => {
                window.location.href = '/login';
            }, 1000);
            return;
        }

        // Apply translations
        if (typeof TL !== 'undefined' && TL.tpl_lang) {
            TL.tpl_lang();
        }

        // Load user info - check if TL data is ready
        if (typeof TL !== 'undefined') {
            if (TL.uid) {
                this.fetchProfileDetails(() => {
                    this.loadUserInfo();
                });
            } else {
                const checkData = setInterval(() => {
                    if (TL.uid) {
                        clearInterval(checkData);
                        this.fetchProfileDetails(() => {
                            this.loadUserInfo();
                        });
                    }
                }, 200);

                // Timeout after 5 seconds
                setTimeout(() => {
                    clearInterval(checkData);
                    this.loadUserInfo();
                }, 5000);
            }
        }
    },

    /**
     * Initialize Account Settings module (separate route)
     */
    initSettings(params = {}) {
        console.log('[VX_ACCOUNT] Initializing settings module...', params);

        // Check login
        if (typeof TL !== 'undefined' && !TL.isLogin()) {
            VXUI.toastWarning('请先登录');
            setTimeout(() => {
                window.location.href = '/login';
            }, 1000);
            return;
        }

        // Apply translations
        if (typeof TL !== 'undefined' && TL.tpl_lang) {
            TL.tpl_lang();
        }

        // VXUI 可能在 TL.api_token 尚未填充时直接刷新进入 settings：兜底从存储/Cookie 恢复
        if (typeof TL !== 'undefined' && !TL.api_token) {
            const stored = localStorage.getItem('app_token');
            if (stored) {
                TL.api_token = stored;
            } else if (typeof getCookie === 'function') {
                const c = getCookie('token');
                if (c) TL.api_token = c;
            }
        }

        // Load preferences + connect status (only if the section exists)
        this.loadPreferences();
        this.loadGoogleStatus();
    },
    
    /**
     * Get translation text safely
     */
    t(key, fallback) {
        return (typeof TL !== 'undefined' && TL.tpl && TL.tpl[key]) ? TL.tpl[key] : fallback;
    },
    
    /**
     * Get language data safely
     */
    lang(key, fallback) {
        return (typeof app !== 'undefined' && app.languageData && app.languageData[key]) ? app.languageData[key] : fallback;
    },

    /**
     * 记录 UI 行为（event_ui）
     */
    trackUI(title) {
        try {
            if (!title) return;
            if (typeof VXUI !== 'undefined' && VXUI && typeof VXUI.trackUI === 'function') {
                VXUI.trackUI(title);
                return;
            }
            if (typeof TL !== 'undefined' && TL && typeof TL.ga === 'function') {
                TL.ga(title);
            }
        } catch (e) {
            // ignore
        }
    },
    
    /**
     * Initialize the account module
     * @param {Object} params - Module parameters (tab: 'info'|'settings')
     */
    init(params = {}) {
        console.log('[VX_ACCOUNT] Initializing account module...', params);
        
        // Check login
        if (typeof TL !== 'undefined' && !TL.isLogin()) {
            VXUI.toastWarning('请先登录');
            setTimeout(() => {
                window.location.href = '/login';
            }, 1000);
            return;
        }
        
        // Update sidebar
        this.updateSidebar();
        
        // Apply translations
        if (typeof TL !== 'undefined' && TL.tpl_lang) {
            TL.tpl_lang();
        }
        
        // Show tab from params
        if (params.tab === 'settings') {
            this.showTab('settings');
        } else {
            this.showTab('info');
        }
        
        // Load user info - check if TL data is ready
        if (typeof TL !== 'undefined') {
            // If uid exists, data is ready - load immediately
            if (TL.uid) {
                console.log('[VX_ACCOUNT] TL.uid ready, loading user info');
                
                // Always fetch profile details via API (pf_userinfo_get)
                this.fetchProfileDetails(() => {
                    this.loadUserInfo();
                });
            } else {
                // Wait for data to be ready
                console.log('[VX_ACCOUNT] Waiting for TL data...');
                let attempts = 0;
                const checkData = setInterval(() => {
                    attempts++;
                    console.log('[VX_ACCOUNT] Check attempt', attempts, 'TL.uid:', TL.uid);
                    if (TL.uid) {
                        clearInterval(checkData);
                        console.log('[VX_ACCOUNT] TL.uid now ready');
                        
                        this.fetchProfileDetails(() => {
                            this.loadUserInfo();
                        });
                    }
                }, 200);
                
                // Timeout after 5 seconds
                setTimeout(() => {
                    clearInterval(checkData);
                    console.log('[VX_ACCOUNT] Timeout, attempting load anyway');
                    this.loadUserInfo();
                }, 5000);
            }
        }
        
        // Load preferences
        this.loadPreferences();
        
        // Load Google connect status
        this.loadGoogleStatus();
    },
    
    /**
     * Update sidebar content
     */
    updateSidebar() {
        if (typeof VXUI !== 'undefined' && typeof VXUI.setSidebarDynamicFromTemplate === 'function') {
            VXUI.setSidebarDynamicFromTemplate('vx-account-sidebar-tpl');
        } else {
            const sidebarTpl = document.getElementById('vx-account-sidebar-tpl');
            const sidebarDynamic = document.getElementById('vx-sidebar-dynamic');
            if (sidebarTpl && sidebarDynamic) {
                const content = sidebarTpl.content ? sidebarTpl.content.cloneNode(true) : sidebarTpl.cloneNode(true);
                sidebarDynamic.innerHTML = '';
                sidebarDynamic.appendChild(content);
            }
        }

        if (typeof TL !== 'undefined' && TL.tpl_lang) {
            TL.tpl_lang();
        }
    },
    
    /**
     * Switch between tabs
     */
    showTab(tab) {
        this.currentTab = tab;

        this.trackUI(`vui_account[${tab}]`);
        
        // Update sidebar nav (only module dynamic area)
        document.querySelectorAll('#vx-sidebar-dynamic .vx-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        const navItem = document.getElementById(`nav-account-${tab}`);
        if (navItem) navItem.classList.add('active');
        
        // Update URL
        if (typeof VXUI !== 'undefined' && VXUI.updateUrl) {
            VXUI.updateUrl('account', { tab: tab });
        }
        
        // Show/hide content
        document.getElementById('vx-account-info').style.display = tab === 'info' ? 'block' : 'none';
        document.getElementById('vx-account-settings').style.display = tab === 'settings' ? 'block' : 'none';
    },
    
    /**
     * Fetch profile details from server (pf_userinfo_get)
     * This gets nickname, intro, avatar_id, publish status etc.
     */
    fetchProfileDetails(callback) {
        const apiUrl = (typeof TL !== 'undefined' && TL.api_user) ? TL.api_user : '/api_v2/user';
        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
        
        console.log('[VX_ACCOUNT] Fetching profile details via pf_userinfo_get');
        
        $.post(apiUrl, {
            'action': 'pf_userinfo_get',
            'token': token
        }, (rsp) => {
            if (rsp.status == 1) {
                console.log('[VX_ACCOUNT] Profile details received:', rsp.data);
                
                // Update TL.profile with the received data
                if (typeof TL !== 'undefined') {
                    if (!TL.profile) {
                        TL.profile = {};
                    }
                    TL.profile.publish = rsp.data.publish;
                    TL.profile.publish_status = rsp.data.publish_status;
                    TL.profile.nickname = rsp.data.nickname;
                    TL.profile.intro = rsp.data.intro;
                    TL.profile.avatar_id = rsp.data.avatar_id;
                    TL.profile.init_status = true;
                    
                    // Generate avatar URL if no custom avatar
                    if (!TL.profile.avatar_id || TL.profile.avatar_id === '0' || TL.profile.avatar_id === 0) {
                        // Generate avatar from uid
                        const uidStr = String(TL.uid);
                        let seed = 0;
                        for (let i = 0; i < uidStr.length; i++) {
                            seed += uidStr.charCodeAt(i);
                        }
                        const avatarId = (seed % 16) + 1;
                        TL.profile.avatar_url = `/img/avatar/2-${avatarId}.svg`;
                    }
                }
            } else {
                console.log('[VX_ACCOUNT] Failed to get profile details:', rsp);
            }
            
            if (typeof callback === 'function') {
                callback();
            }
        }, 'json').fail(() => {
            console.error('[VX_ACCOUNT] Network error fetching profile details');
            if (typeof callback === 'function') {
                callback();
            }
        });
    },
    
    /**
     * Load user information
     */
    loadUserInfo() {
        console.log('[VX_ACCOUNT] loadUserInfo called');
        
        if (typeof TL === 'undefined') {
            console.log('[VX_ACCOUNT] TL not defined');
            return;
        }
        
        if (!TL.uid) {
            console.log('[VX_ACCOUNT] TL.uid not ready');
            return;
        }
        
        console.log('[VX_ACCOUNT] Loading user info with data:', {
            uid: TL.uid,
            sponsor: TL.sponsor,
            sponsor_time: TL.sponsor_time,
            high_speed_channel: TL.high_speed_channel,
            user_group: TL.user_group,
            user_join: TL.user_join,
            user_acv: TL.user_acv,
            user_total_files: TL.user_total_files
        });
        
        try {
            // Avatar - use TL.profile if available
            let avatarUrl = '/img/avatar/default.png';
            if (TL.profile && TL.profile.avatar_id && TL.profile.avatar_id !== '0' && TL.profile.avatar_id !== 0) {
                avatarUrl = `https://tmp-static.vx-cdn.com/static/avatar?id=${TL.profile.avatar_id}`;
            } else {
                // Use profile's generated avatar if available
                if (TL.profile && TL.profile.avatar_url) {
                    avatarUrl = TL.profile.avatar_url;
                } else if (TL.uid) {
                    // Generate avatar from uid - handle both string and number
                    const uidStr = String(TL.uid);
                    let seed = 0;
                    for (let i = 0; i < uidStr.length; i++) {
                        seed += uidStr.charCodeAt(i);
                    }
                    const avatarId = (seed % 16) + 1;
                    avatarUrl = `/img/avatar/2-${avatarId}.svg`;
                }
            }
            
            const avatarEl = document.getElementById('vx-profile-avatar');
            if (avatarEl) avatarEl.src = avatarUrl;
            
            // Name and intro - use TL.profile
            let nickname = this.lang('user_saved_title', '未设置昵称');
            let intro = this.lang('user_saved_content', '这个人很懒，什么都没写');
            
            if (TL.profile) {
                if (TL.profile.nickname && TL.profile.nickname !== '0') {
                    nickname = TL.profile.nickname;
                }
                if (TL.profile.intro && TL.profile.intro !== '0') {
                    intro = TL.profile.intro;
                }
            }
            
            const nameEl = document.getElementById('vx-profile-name');
            const introEl = document.getElementById('vx-profile-intro');
            if (nameEl) nameEl.textContent = nickname;
            if (introEl) introEl.textContent = intro;
            
            // Badges - if sponsor, only show sponsor badge; otherwise show rank badge (rank uses UID like legacy)
            const rankEl = document.getElementById('vx-profile-rank');
            const sponsorBadge = document.getElementById('vx-profile-sponsor-badge');
            
            if (TL.sponsor) {
                // Sponsor: hide rank badge, show sponsor badge
                if (rankEl) rankEl.style.display = 'none';
                if (sponsorBadge) sponsorBadge.style.display = 'inline-flex';
            } else {
                // Not sponsor: show rank badge, hide sponsor badge
                if (rankEl) {
                    rankEl.style.display = 'inline-flex';
                    rankEl.textContent = (TL.uid !== undefined && TL.uid !== null && TL.uid !== '')
                        ? String(TL.uid)
                        : this.lang('myprofile_rank_normal', '普通用户');
                }
                if (sponsorBadge) sponsorBadge.style.display = 'none';
            }
            
            // Stats - format status text
            const formatStatus = (enabled, extraText) => {
                if (enabled) {
                    let text = this.lang('opt_enable', '启用');
                    if (extraText) text += ` (${extraText})`;
                    return `<span style="color: var(--vx-success)">${text}</span>`;
                }
                return `<span style="color: var(--vx-text-muted)">${this.lang('opt_disable', '未启用')}</span>`;
            };
            
            // High speed channel - check both boolean and string '1'
            const hasHighSpeed = TL.high_speed_channel === true || TL.high_speed_channel === '1' || 
                                 (TL.user_group && TL.user_group.highspeed);
            const hasBlue = (TL.user_group && TL.user_group.blue);
            const sponsorText = this.lang('service_code_hs', '赞助者特权');
            
            // Stats elements
            const highspeedEl = document.getElementById('vx-stat-highspeed');
            const blueEl = document.getElementById('vx-stat-blue');
            const dvdEl = document.getElementById('vx-stat-dvd');
            
            // If sponsor, all features are enabled
            if (TL.sponsor) {
                if (highspeedEl) highspeedEl.innerHTML = formatStatus(true, sponsorText);
                if (blueEl) blueEl.innerHTML = formatStatus(true, sponsorText);
                if (dvdEl) dvdEl.innerHTML = formatStatus(true);
            } else {
                if (highspeedEl) highspeedEl.innerHTML = formatStatus(hasHighSpeed);
                if (blueEl) blueEl.innerHTML = formatStatus(hasBlue);
                if (dvdEl) dvdEl.innerHTML = formatStatus(false);
            }
            
            // ACV (Share Value / 分享值)
            const acvEl = document.getElementById('vx-stat-acv');
            if (acvEl) acvEl.textContent = TL.user_acv || 0;
            
            // Storage - display total private storage space (formatted, legacy behavior)
            const storageEl = document.getElementById('vx-stat-storage');
            if (storageEl) {
                if (TL.storage) {
                    // Format total storage from bytes
                    storageEl.textContent = bytetoconver(TL.storage, true);
                } else {
                    storageEl.textContent = '0 GB';
                }
            }
            
            // Shares count
            const sharesEl = document.getElementById('vx-stat-shares');
            if (sharesEl) sharesEl.textContent = TL.user_total_files || 0;
            
            // File size and upload total - these are already formatted by tmplink.js
            const filesizeEl = document.getElementById('vx-stat-filesize');
            const uploadEl = document.getElementById('vx-stat-upload');
            if (filesizeEl) filesizeEl.textContent = TL.user_total_filesize || '0 GB';
            if (uploadEl) uploadEl.textContent = TL.user_total_upload || '0 GB';
            
            // Join date
            const joinEl = document.getElementById('vx-stat-join');
            if (joinEl) {
                joinEl.textContent = TL.user_join || '--';
            }

            // Sponsor time (legacy behavior: show date if sponsor)
            const sponsorTimeEl = document.getElementById('vx-stat-sponsor-time');
            if (sponsorTimeEl) {
                if (TL.sponsor && TL.sponsor_time) {
                    sponsorTimeEl.textContent = TL.sponsor_time;
                } else {
                    sponsorTimeEl.textContent = this.lang('opt_disable', '未启用');
                }
            }
            
            // Show publish section for sponsors or users with high share value
            const publishSection = document.getElementById('vx-profile-publish');
            if (publishSection) {
                const canPublish = TL.sponsor || (TL.user_acv && TL.user_acv >= 150);
                publishSection.style.display = canPublish ? 'block' : 'none';
                
                // Load publish status from profile
                if (canPublish && TL.profile) {
                    this.updatePublishStatus();
                }
            }
            
            // Hide loading, show content
            const loadingEl = document.getElementById('vx-profile-loading');
            const contentEl = document.getElementById('vx-profile-content');
            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';
            
            console.log('[VX_ACCOUNT] User info loaded successfully');
            
        } catch (e) {
            console.error('[VX_ACCOUNT] Failed to load user info:', e);
            // Still hide loading on error
            const loadingEl = document.getElementById('vx-profile-loading');
            const contentEl = document.getElementById('vx-profile-content');
            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';
        }
    },
    
    /**
     * Show profile edit form
     */
    showProfileEdit() {
        const displayEl = document.getElementById('vx-profile-display');
        const editEl = document.getElementById('vx-profile-edit');
        const nameInput = document.getElementById('vx-profile-name-input');
        const introInput = document.getElementById('vx-profile-intro-input');
        
        if (!displayEl || !editEl || !nameInput || !introInput) return;
        
        // Populate inputs with current values
        let currentName = '';
        let currentIntro = '';
        
        if (typeof TL !== 'undefined' && TL.profile) {
            currentName = (TL.profile.nickname && TL.profile.nickname !== '0') ? TL.profile.nickname : '';
            currentIntro = (TL.profile.intro && TL.profile.intro !== '0') ? TL.profile.intro : '';
        }
        
        nameInput.value = currentName;
        introInput.value = currentIntro;
        
        // Switch to edit mode
        displayEl.style.display = 'none';
        editEl.style.display = 'block';
        
        // Focus on name input
        nameInput.focus();
    },
    
    /**
     * Cancel profile edit
     */
    cancelProfileEdit() {
        const displayEl = document.getElementById('vx-profile-display');
        const editEl = document.getElementById('vx-profile-edit');
        
        if (displayEl) displayEl.style.display = 'block';
        if (editEl) editEl.style.display = 'none';
    },
    
    /**
     * Save profile (nickname and intro)
     */
    saveProfile() {
        const nameInput = document.getElementById('vx-profile-name-input');
        const introInput = document.getElementById('vx-profile-intro-input');
        
        if (!nameInput || !introInput) return;
        
        const nickname = nameInput.value.trim();
        const intro = introInput.value.trim();
        
        if (!nickname || !intro) {
            VXUI.toastWarning(this.lang('direct_brand_name_empty', '请填写完整信息'));
            return;
        }
        
        const apiUrl = (typeof TL !== 'undefined' && TL.api_user) ? TL.api_user : '/api_v2/user';
        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
        
        VXUI.toastInfo('保存中...');
        
        $.post(apiUrl, {
            'action': 'pf_userinfo_set',
            'token': token,
            'nickname': nickname,
            'intro': intro
        }, (data) => {
            if (data.status == 1) {
                VXUI.toastSuccess('资料保存成功');
                
                // Refresh profile details from server
                this.fetchProfileDetails(() => {
                    this.loadUserInfo();
                    this.cancelProfileEdit();
                });
            } else {
                VXUI.toastError(data.message || '保存失败');
            }
        }, 'json').fail(() => {
            VXUI.toastError('网络错误');
        });
    },
    
    /**
     * Update publish status display
     */
    updatePublishStatus() {
        if (typeof TL === 'undefined' || !TL.profile) return;
        
        const publishSwitch = document.getElementById('vx-profile-publish-switch');
        const statusEl = document.getElementById('vx-profile-publish-status');
        
        const isPublished = TL.profile.publish === 'yes';
        const publishStatus = TL.profile.publish_status;
        
        // Set switch state
        if (publishSwitch) {
            publishSwitch.checked = isPublished;
        }
        
        // Show publish status icon next to label
        if (statusEl && isPublished) {
            let statusHtml = '';
            switch (publishStatus) {
                case 'ok':
                    statusHtml = `<iconpark-icon name="circle-check" class="vx-publish-icon vx-publish-icon-ok" title="${this.lang('brand_status_ok', '已通过')}"></iconpark-icon>`;
                    break;
                case 'reject':
                    statusHtml = `<iconpark-icon name="circle-xmark" class="vx-publish-icon vx-publish-icon-reject" title="${this.lang('brand_status_reject', '已拒绝')}"></iconpark-icon>`;
                    break;
                case 'wait':
                    statusHtml = `<iconpark-icon name="timer" class="vx-publish-icon vx-publish-icon-wait" title="${this.lang('brand_status_wait', '等待审核')}"></iconpark-icon>`;
                    break;
                case 'review':
                    statusHtml = `<iconpark-icon name="loader" class="vx-publish-icon vx-publish-icon-review fa-spin" title="${this.lang('brand_status_review', '审核中')}"></iconpark-icon>`;
                    break;
            }
            statusEl.innerHTML = statusHtml;
        } else if (statusEl) {
            statusEl.innerHTML = '';
        }
    },
    
    /**
     * Set publish profile status
     */
    setPublishProfile() {
        const publishSwitch = document.getElementById('vx-profile-publish-switch');
        if (!publishSwitch) return;
        
        const publish = publishSwitch.checked ? 'yes' : 'no';
        
        const apiUrl = (typeof TL !== 'undefined' && TL.api_user) ? TL.api_user : '/api_v2/user';
        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
        
        $.post(apiUrl, {
            'action': 'pf_userinfo_publish_set',
            'token': token,
            'status': publish
        }, (data) => {
            if (data.status == 1) {
                // Update TL.profile and refresh status
                if (typeof TL !== 'undefined' && TL.profile) {
                    TL.profile.publish = publish;
                }
                this.fetchProfileDetails(() => {
                    this.updatePublishStatus();
                });
            }
        }, 'json');
    },
    
    /**
     * Submit profile for review - not needed for sponsors
     */
    submitForReview() {
        const apiUrl = (typeof TL !== 'undefined' && TL.api_user) ? TL.api_user : '/api_v2/user';
        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
        
        VXUI.toastInfo('正在提交审核...');
        
        $.post(apiUrl, {
            'action': 'pf_userinfo_review',
            'token': token
        }, (data) => {
            if (data.status == 1) {
                VXUI.toastSuccess(this.lang('user_review_status_1', '提交成功，请等待审核'));
                // Refresh profile details to get updated status
                this.fetchProfileDetails(() => {
                    this.updatePublishStatus();
                });
            } else if (data.status == 2) {
                VXUI.toastWarning(this.lang('user_review_status_2', '您已提交过审核，请等待'));
            } else {
                VXUI.toastError(this.lang('user_review_status_0', '提交失败'));
            }
        }, 'json').fail(() => {
            VXUI.toastError('网络错误');
        });
    },
    
    /**
     * Load user preferences
     */
    loadPreferences() {
        // Load from local storage or server
        const bulkCopy = localStorage.getItem('pref_bulk_copy') === 'true';
        const confirmDelete = localStorage.getItem('pref_confirm_delete') !== 'false'; // Default true

        const bulkCopyEl = document.getElementById('vx-pref-bulk-copy');
        const confirmDeleteEl = document.getElementById('vx-pref-confirm-delete');
        if (!bulkCopyEl || !confirmDeleteEl) return;

        bulkCopyEl.checked = bulkCopy;
        confirmDeleteEl.checked = confirmDelete;
    },
    
    /**
     * Set bulk copy preference
     */
    setPrefBulkCopy() {
        const el = document.getElementById('vx-pref-bulk-copy');
        if (!el) return;
        const checked = el.checked;
        localStorage.setItem('pref_bulk_copy', checked);
        
        // Post to server if TL available
        if (typeof TL !== 'undefined' && TL.profile_bulk_copy_post) {
            TL.profile_bulk_copy_post();
        }
    },
    
    /**
     * Set confirm delete preference
     */
    setPrefConfirmDelete() {
        const el = document.getElementById('vx-pref-confirm-delete');
        if (!el) return;
        const checked = el.checked;
        localStorage.setItem('pref_confirm_delete', checked);
        
        // Post to server if TL available
        if (typeof TL !== 'undefined' && TL.profile_confirm_delete_post) {
            TL.profile_confirm_delete_post();
        }
    },
    
    /**
     * Edit avatar - trigger file input
     */
    editAvatar() {
        document.getElementById('vx-avatar-input').click();
    },
    
    /**
     * Upload new avatar
     */
    uploadAvatar(input) {
        if (!input.files || !input.files[0]) return;
        
        const file = input.files[0];
        if (file.size > 2 * 1024 * 1024) {
            VXUI.toastError('图片大小不能超过 2MB');
            return;
        }
        
        const apiUrl = (typeof TL !== 'undefined' && TL.api_user) ? TL.api_user : '/api_v2/user';
        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
        
        const formData = new FormData();
        formData.append('action', 'pf_avatar_set');
        formData.append('token', token);
        formData.append('file', file);
        
        VXUI.toastInfo('正在上传头像...');
        
        fetch(apiUrl, {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (data.status == 1) {
                VXUI.toastSuccess('头像更新成功');
                // Refresh profile details to get new avatar_id, then update display
                this.fetchProfileDetails(() => {
                    this.loadUserInfo();
                });
            } else if (data.status == 2) {
                VXUI.toastError('图片尺寸不符合要求');
            } else {
                VXUI.toastError('头像上传失败');
            }
        })
        .catch(() => {
            VXUI.toastError('网络错误');
        });
        
        // Clear input so same file can be selected again
        input.value = '';
    },
    
    /**
     * Change password
     */
    changePassword() {
        const newPass = document.getElementById('vx-new-password').value;
        const confirmPass = document.getElementById('vx-confirm-password').value;
        
        if (!newPass || !confirmPass) {
            VXUI.toastWarning('请填写完整');
            return;
        }
        
        if (newPass !== confirmPass) {
            VXUI.toastError('两次输入的密码不一致');
            return;
        }
        
        if (newPass.length < 6) {
            VXUI.toastError('密码长度至少 6 位');
            return;
        }
        
        const apiUrl = (typeof TL !== 'undefined' && TL.api_user) ? TL.api_user : '/api_v2/user';
        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
        
        $.post(apiUrl, {
            action: 'password_change',
            token: token,
            password: newPass
        }, (data) => {
            if (data.status == 1) {
                VXUI.toastSuccess('密码修改成功');
                document.getElementById('vx-new-password').value = '';
                document.getElementById('vx-confirm-password').value = '';
            } else {
                VXUI.toastError(data.message || '密码修改失败');
            }
        }, 'json').fail(() => {
            VXUI.toastError('网络错误');
        });
    },
    
    /**
     * Send email verification code
     */
    sendEmailCode() {
        const email = document.getElementById('vx-new-email').value;
        
        if (!email || !email.includes('@')) {
            VXUI.toastWarning('请输入有效的邮箱地址');
            return;
        }
        
        const btn = document.getElementById('vx-send-code-btn');
        btn.disabled = true;
        btn.textContent = '发送中...';
        
        // Use TL's cc_send if available
        if (typeof TL !== 'undefined' && TL.cc_send) {
            // Set email field for TL
            $('#email_new').val(email);
            TL.cc_send();
            
            // Countdown
            let count = 60;
            const timer = setInterval(() => {
                count--;
                btn.textContent = `${count}s`;
                if (count <= 0) {
                    clearInterval(timer);
                    btn.disabled = false;
                    btn.innerHTML = '<span data-tpl="form_checkcode_send">发送验证码</span>';
                }
            }, 1000);
        } else {
            // Fallback API call
            const apiUrl = (typeof TL !== 'undefined' && TL.api_user) ? TL.api_user : '/api_v2/user';
            
            $.post(apiUrl, {
                action: 'send_checkcode',
                email: email
            }, (data) => {
                if (data.status == 1) {
                    VXUI.toastSuccess('验证码已发送');
                    
                    let count = 60;
                    const timer = setInterval(() => {
                        count--;
                        btn.textContent = `${count}s`;
                        if (count <= 0) {
                            clearInterval(timer);
                            btn.disabled = false;
                            btn.innerHTML = '<span data-tpl="form_checkcode_send">发送验证码</span>';
                        }
                    }, 1000);
                } else {
                    btn.disabled = false;
                    btn.innerHTML = '<span data-tpl="form_checkcode_send">发送验证码</span>';
                    VXUI.toastError(data.message || '发送失败');
                }
            }, 'json').fail(() => {
                btn.disabled = false;
                btn.innerHTML = '<span data-tpl="form_checkcode_send">发送验证码</span>';
                VXUI.toastError('网络错误');
            });
        }
    },
    
    /**
     * Change email
     */
    changeEmail() {
        const email = document.getElementById('vx-new-email').value;
        const code = document.getElementById('vx-email-code').value;
        
        if (!email || !code) {
            VXUI.toastWarning('请填写完整');
            return;
        }
        
        const apiUrl = (typeof TL !== 'undefined' && TL.api_user) ? TL.api_user : '/api_v2/user';
        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
        
        $.post(apiUrl, {
            action: 'email_change',
            token: token,
            email: email,
            checkcode: code
        }, (data) => {
            if (data.status == 1) {
                VXUI.toastSuccess('邮箱修改成功');
                document.getElementById('vx-new-email').value = '';
                document.getElementById('vx-email-code').value = '';
            } else {
                VXUI.toastError(data.message || '邮箱修改失败');
            }
        }, 'json').fail(() => {
            VXUI.toastError('网络错误');
        });
    },
    
    /**
     * Load Google connect status
     */
    loadGoogleStatus() {
        const statusEl = document.getElementById('vx-google-status');
        const connectBtn = document.getElementById('vx-google-connect');
        const disconnectBtn = document.getElementById('vx-google-disconnect');
        if (!statusEl || !connectBtn || !disconnectBtn) return;

        const apiUrl = (typeof TL !== 'undefined' && TL.api_user) ? TL.api_user : '/api_v2/user';
        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';

        // token 可能在页面初始阶段异步填充：延迟重试，避免误判为未绑定
        if (!token) {
            setTimeout(() => this.loadGoogleStatus(), 300);
            return;
        }
        
        $.post(apiUrl, {
            action: 'oauth_google_is_connected',
            token: token
        }, (data) => {
            if (data.status == 1) {
                // Connected
                statusEl.textContent = this.lang('oauth_btn_google_connected', '已绑定');
                statusEl.classList.add('connected');
                connectBtn.style.display = 'none';
                disconnectBtn.style.display = 'inline-flex';
            } else {
                // Not connected
                statusEl.textContent = this.lang('oauth_btn_google_connect', '未绑定');
                statusEl.classList.remove('connected');
                disconnectBtn.style.display = 'none';
                
                // Get connect URL
                this.getGoogleConnectUrl();
            }
        }, 'json');
    },
    
    /**
     * Get Google connect URL
     */
    getGoogleConnectUrl() {
        const connectBtn = document.getElementById('vx-google-connect');
        if (!connectBtn) return;

        const apiUrl = (typeof TL !== 'undefined' && TL.api_user) ? TL.api_user : '/api_v2/user';
        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
        const lang = (typeof TL !== 'undefined' && TL.currentLanguage) ? TL.currentLanguage : 'cn';
        
        $.post(apiUrl, {
            action: 'oauth_google_login',
            type: 'connect',
            token: token,
            lang: lang
        }, (data) => {
            if (data.status == 1) {
                connectBtn.href = data.data;
                connectBtn.target = '_blank';
                connectBtn.style.display = 'inline-flex';
                connectBtn.onclick = () => this.startGoogleConnectCallback();
            }
        }, 'json');
    },
    
    /**
     * Start Google connect callback polling
     */
    startGoogleConnectCallback() {
        const msgEl = document.getElementById('vx-google-connect-msg');
        if (msgEl) {
            msgEl.textContent = this.lang('oauth_btn_processing', '连接中...');
        }
        
        const checkStatus = () => {
            const apiUrl = (typeof TL !== 'undefined' && TL.api_user) ? TL.api_user : '/api_v2/user';
            const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
            
            $.post(apiUrl, {
                action: 'oauth_google_status',
                token: token
            }, (data) => {
                if (data.data === 'GOOGLE_BIND_SUCCESS') {
                    const doneEl = document.getElementById('vx-google-connect-msg');
                    if (doneEl) doneEl.textContent = this.lang('oauth_btn_complete', '绑定成功');
                    setTimeout(() => this.loadGoogleStatus(), 2000);
                } else if (data.data === 'GOOGLE_BIND_FAILED') {
                    VXUI.toastError('绑定失败');
                    const failEl = document.getElementById('vx-google-connect-msg');
                    if (failEl) failEl.textContent = this.lang('oauth_btn_google_connect', '绑定 Google');
                } else if (data.data === 'GOOGLE_BIND_START') {
                    setTimeout(checkStatus, 2000);
                } else {
                    setTimeout(checkStatus, 2000);
                }
            }, 'json');
        };
        
        setTimeout(checkStatus, 2000);
    },
    
    /**
     * Disconnect Google account
     */
    disconnectGoogle() {
        if (!confirm('确定要解除 Google 账号绑定吗？')) return;

        const disconnectBtn = document.getElementById('vx-google-disconnect');
        if (!disconnectBtn) return;
        
        const apiUrl = (typeof TL !== 'undefined' && TL.api_user) ? TL.api_user : '/api_v2/user';
        const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
        
        disconnectBtn.disabled = true;
        
        $.post(apiUrl, {
            action: 'oauth_google_disconnect',
            token: token
        }, () => {
            VXUI.toastSuccess('已解除绑定');
            this.loadGoogleStatus();
        }, 'json').always(() => {
            disconnectBtn.disabled = false;
        });
    },
    
    /**
     * Refresh account data
     */
    refresh() {
        if (document.getElementById('vx-profile-avatar') || document.getElementById('vx-profile-name')) {
            this.loadUserInfo();
        }
        if (document.getElementById('vx-google-status')) {
            this.loadGoogleStatus();
        }
        if (document.getElementById('vx-pref-bulk-copy') || document.getElementById('vx-pref-confirm-delete')) {
            this.loadPreferences();
        }
        VXUI.toastInfo('已刷新');
    }
};

VXUI.registerModule('profile', {
    template: '/tpl/vxui/profile.html',
    init: (params) => VX_ACCOUNT.initInfo(params)
});

VXUI.registerModule('settings', {
    template: '/tpl/vxui/settings.html',
    init: (params) => VX_ACCOUNT.initSettings(params)
});
