(function (window, document) {
    'use strict';

    const UI = window.VXUIComponents;

    const showcaseState = {
        loggedIn: true,
        owner: true,
        user: {
            name: 'Framework Owner',
            owner: true
        },
        workspaceMode: 'list',
        reportsTab: 'overview',
        linksTab: 'dashboard',
        libraryTab: 'catalog'
    };

    const workspaceRows = [
        { type: 'folder', name: 'Design Assets', size: 'Folder', date: '2026-03-12' },
        { type: 'folder', name: 'Contracts', size: 'Folder', date: '2026-03-01' },
        { type: 'folder', name: 'Release Notes', size: 'Folder', date: '2026-02-17' },
        { type: 'folder', name: 'Audio Samples', size: 'Folder', date: '2026-02-08' },
        { type: 'folder', name: 'Video Drafts', size: 'Folder', date: '2026-01-29' },
        { type: 'file', name: 'framework-roadmap.md', size: '42 KB', date: '2026-04-03' },
        { type: 'file', name: 'component-matrix.xlsx', size: '88 KB', date: '2026-04-01' },
        { type: 'file', name: 'theme-tokens.json', size: '13 KB', date: '2026-03-30' }
    ];

    const reportsRows = [
        { event: 'UI update', channel: 'Web', date: '2026-04-04', status: 'Done' },
        { event: 'Token export', channel: 'API', date: '2026-04-03', status: 'Done' },
        { event: 'Onboarding flow', channel: 'Web', date: '2026-04-02', status: 'In review' },
        { event: 'Search index sync', channel: 'Worker', date: '2026-04-01', status: 'Queued' }
    ];

    const linkRows = [
        { name: 'Public CDN', target: 'cdn.example.dev', visits: '12.8K', status: 'Healthy' },
        { name: 'Docs Portal', target: 'docs.example.dev', visits: '5.3K', status: 'Healthy' },
        { name: 'Media Bridge', target: 'media.example.dev', visits: '987', status: 'Alert' }
    ];

    const libraryRows = [
        { name: 'Starter UI Pack', kind: 'Template', date: '2026-03-27', action: 'Open' },
        { name: 'Onboarding Flow', kind: 'Pattern', date: '2026-03-19', action: 'Open' },
        { name: 'Modal Cookbook', kind: 'Guide', date: '2026-03-08', action: 'Open' }
    ];

    function escapeHtml(value) {
        return UI.escapeHtml(value);
    }

    function fileTypeIcon(row) {
        return row.type === 'folder' ? 'folder-open-e1ad2j7l' : 'file';
    }

    function fileTypeClass(row) {
        return row.type === 'folder' ? 'vx-icon-folder' : 'vx-icon-file';
    }

    function buildWorkspaceRow(row, index) {
        return [
            '<div class="vx-list-row" data-type="' + escapeHtml(row.type) + '">',
                '<button class="vx-list-checkbox" type="button" data-row-checkbox="' + index + '"></button>',
                '<div class="vx-list-name">',
                    '<span class="vx-list-icon ' + fileTypeClass(row) + '"><iconpark-icon name="' + fileTypeIcon(row) + '"></iconpark-icon></span>',
                    '<div class="vx-list-filename"><a href="javascript:;">' + escapeHtml(row.name) + '</a></div>',
                '</div>',
                '<div class="vx-list-size">' + escapeHtml(row.size) + '</div>',
                '<div class="vx-list-date">' + escapeHtml(row.date) + '</div>',
                '<div class="vx-list-actions">',
                    '<button class="vx-list-action-btn" type="button" title="open"><iconpark-icon name="share-from-square"></iconpark-icon></button>',
                    '<button class="vx-list-action-btn" type="button" title="rename"><iconpark-icon name="pen-to-square"></iconpark-icon></button>',
                    '<button class="vx-list-action-btn vx-action-danger" type="button" title="delete"><iconpark-icon name="trash"></iconpark-icon></button>',
                '</div>',
            '</div>'
        ].join('');
    }

    function buildWorkspaceCard(row) {
        return [
            '<article class="vx-album-card" data-type="' + escapeHtml(row.type) + '">',
                '<div class="vx-album-card-thumb ' + fileTypeClass(row) + '"><iconpark-icon name="' + fileTypeIcon(row) + '"></iconpark-icon></div>',
                '<div class="vx-album-card-main">',
                    '<h3>' + escapeHtml(row.name) + '</h3>',
                    '<div class="vx-muted">' + escapeHtml(row.size) + '</div>',
                    '<div class="vx-muted">' + escapeHtml(row.date) + '</div>',
                '</div>',
            '</article>'
        ].join('');
    }

    function renderWorkspaceToolbar() {
        const listActive = showcaseState.workspaceMode === 'list' ? 'active' : '';
        const albumActive = showcaseState.workspaceMode === 'album' ? 'active' : '';

        return [
            '<header class="vx-header vx-header-minimal vx-filelist-head">',
                '<div class="vx-header-left">',
                    UI.iconButton({ className: 'vx-btn-icon vx-portrait-sidebar-btn', icon: 'bars', title: 'menu', attrs: 'data-vx-sidebar-toggle' }),
                    '<nav class="vx-breadcrumb"><a href="javascript:;">Workspace</a></nav>',
                '</div>',
                '<div class="vx-header-right">',
                    UI.iconButton({ icon: 'search', title: 'search' }),
                    '<div class="vx-btn-group vx-view-toggle">',
                        '<button class="vx-btn-icon ' + listActive + '" type="button" data-workspace-mode="list" title="List"><iconpark-icon name="list"></iconpark-icon></button>',
                        '<button class="vx-btn-icon ' + albumActive + '" type="button" data-workspace-mode="album" title="Album"><iconpark-icon name="picture"></iconpark-icon></button>',
                    '</div>',
                    UI.button({ className: 'vx-btn vx-btn-ghost', icon: 'cloud-arrow-up', label: 'Upload', attrs: 'data-auth="logged-in" data-owner="true"' }),
                    UI.button({ className: 'vx-btn vx-btn-ghost', icon: 'folder-plus', label: 'New Folder', attrs: 'data-auth="logged-in" data-owner="true"' }),
                '</div>',
            '</header>'
        ].join('');
    }

    function renderWorkspaceList() {
        return UI.dataList({
            className: 'vx-replica-list-container',
            columns: [
                {
                    className: 'vx-list-col-name',
                    headerHtml: [
                        '<button class="vx-list-checkbox" id="vx-ws-select-all" type="button"></button>',
                        '<span>Name</span>',
                        '<iconpark-icon name="sort-amount-down" class="vx-sort-icon active"></iconpark-icon>'
                    ].join('')
                },
                {
                    className: 'vx-list-col-size',
                    headerHtml: '<span>Size</span>'
                },
                {
                    className: 'vx-list-col-date',
                    headerHtml: '<span>Date</span>'
                },
                {
                    className: 'vx-list-col-actions',
                    headerHtml: '<span>Actions</span>'
                }
            ],
            rows: workspaceRows,
            rowBuilder: buildWorkspaceRow
        });
    }

    function renderWorkspaceAlbum() {
        const cardsHtml = workspaceRows.map(function (row) {
            return buildWorkspaceCard(row);
        }).join('');

        return [
            '<div class="vx-album-container vx-showcase-album-container">',
                '<div class="vx-showcase-album-grid">' + cardsHtml + '</div>',
            '</div>'
        ].join('');
    }

    function renderWorkspaceView() {
        return [
            renderWorkspaceToolbar(),
            '<section class="vx-content vx-content-list vx-replica-content">',
                showcaseState.workspaceMode === 'list' ? renderWorkspaceList() : renderWorkspaceAlbum(),
                UI.selectionBar({
                    id: 'vx-ws-selection-bar',
                    countId: 'vx-ws-selection-count',
                    caption: 'Selected',
                    actions: [
                        { icon: 'cloud-arrow-down', label: 'Download' },
                        { icon: 'copy', label: 'Copy Link' },
                        { icon: 'folder-open-e1ad2j7l', label: 'Move' },
                        { icon: 'trash', label: 'Delete', className: 'vx-btn vx-btn-ghost vx-btn-sm vx-text-danger' },
                        { label: 'Cancel', className: 'vx-btn vx-btn-secondary vx-btn-sm', attrs: 'id="vx-ws-selection-cancel"' }
                    ]
                }),
            '</section>'
        ].join('');
    }

    function renderSettingsView() {
        return [
            UI.moduleHeader({
                icon: 'gear',
                title: 'Settings',
                rightHtml: UI.iconButton({ icon: 'rotate', title: 'refresh' })
            }),
            '<div class="vx-content vx-account-content">',
                '<div class="vx-settings-section">',
                    '<h3 class="vx-settings-title"><iconpark-icon name="sliders"></iconpark-icon><span>Workspace Preferences</span></h3>',
                    '<div class="vx-settings-card">',
                        UI.switchItem({
                            title: 'Enable quick copy',
                            description: 'Copy links continuously without closing the action panel.',
                            checked: true,
                            attrs: 'data-setting-switch="quick-copy"'
                        }),
                        UI.switchItem({
                            title: 'Confirm before delete',
                            description: 'Show confirmation dialog before destructive actions.',
                            checked: true,
                            attrs: 'data-setting-switch="confirm-delete"'
                        }),
                        '<div class="vx-pref-item">',
                            '<div class="vx-pref-item-head"><iconpark-icon name="layer-group"></iconpark-icon><span class="vx-switch-label">Concurrent uploads</span></div>',
                            '<input class="vx-input" type="number" value="6" min="1" max="20">',
                        '</div>',
                        '<div class="vx-inline-actions">',
                            UI.button({ className: 'vx-btn vx-btn-secondary', icon: 'circle-info', label: 'Info modal', attrs: 'id="vx-open-info-modal"' }),
                            UI.button({ className: 'vx-btn vx-btn-primary', icon: 'circle-check', label: 'Confirm modal', attrs: 'id="vx-open-confirm-modal"' }),
                        '</div>',
                    '</div>',
                '</div>',
            '</div>'
        ].join('');
    }

    function renderProfileView() {
        return [
            UI.moduleHeader({
                icon: 'user',
                title: 'Profile',
                rightHtml: UI.iconButton({ icon: 'rotate', title: 'refresh' })
            }),
            '<div class="vx-content vx-account-content">',
                '<div class="vx-profile-card">',
                    '<div class="vx-profile-header">',
                        '<div class="vx-profile-avatar"><div class="vx-profile-avatar-placeholder"><iconpark-icon name="user"></iconpark-icon></div></div>',
                        '<div class="vx-profile-info">',
                            '<h2 class="vx-profile-name">' + escapeHtml(showcaseState.user.name) + '</h2>',
                            '<p class="vx-profile-intro">Generic framework profile for shell preview and permissions.</p>',
                            '<div class="vx-profile-badges">',
                                '<span class="vx-badge vx-badge-uid"><span class="vx-uid-text">UID: 1000001</span></span>',
                                '<span class="vx-badge vx-badge-rank">Framework Maintainer</span>',
                            '</div>',
                        '</div>',
                    '</div>',
                '</div>',
                '<div class="vx-stats-grid">',
                    '<div class="vx-stat-card"><div class="vx-stat-icon"><iconpark-icon name="file"></iconpark-icon></div><div class="vx-stat-content"><div class="vx-stat-label">Resources</div><div class="vx-stat-value">128</div></div></div>',
                    '<div class="vx-stat-card"><div class="vx-stat-icon"><iconpark-icon name="files"></iconpark-icon></div><div class="vx-stat-content"><div class="vx-stat-label">Shared folders</div><div class="vx-stat-value">26</div></div></div>',
                    '<div class="vx-stat-card"><div class="vx-stat-icon"><iconpark-icon name="database"></iconpark-icon></div><div class="vx-stat-content"><div class="vx-stat-label">Used storage</div><div class="vx-stat-value">927 MB</div></div></div>',
                    '<div class="vx-stat-card"><div class="vx-stat-icon"><iconpark-icon name="chart-network"></iconpark-icon></div><div class="vx-stat-content"><div class="vx-stat-label">Activity score</div><div class="vx-stat-value">150</div></div></div>',
                '</div>',
            '</div>'
        ].join('');
    }

    function renderReportsOverview() {
        return [
            '<section class="vx-points-balance-panel">',
                '<div class="vx-points-balance-label">Weekly Throughput</div>',
                '<div class="vx-points-balance-value">12.8 GB</div>',
            '</section>',
            '<section class="vx-points-actions-panel">',
                '<button class="vx-points-quick-btn is-primary" type="button"><iconpark-icon name="chart-line"></iconpark-icon><span>Open dashboard</span></button>',
                '<button class="vx-points-quick-btn" type="button"><iconpark-icon name="download"></iconpark-icon><span>Export CSV</span></button>',
            '</section>'
        ].join('');
    }

    function renderReportsEvents() {
        return UI.dataList({
            columns: [
                { className: 'vx-list-col-name', headerHtml: '<span>Event</span>' },
                { className: 'vx-list-col-size', headerHtml: '<span>Channel</span>' },
                { className: 'vx-list-col-date', headerHtml: '<span>Date</span>' },
                { className: 'vx-list-col-actions', headerHtml: '<span>Status</span>' }
            ],
            rows: reportsRows,
            rowBuilder: function (row) {
                return [
                    '<div class="vx-list-row">',
                        '<div class="vx-list-name"><span class="vx-list-icon vx-icon-file"><iconpark-icon name="file-lines"></iconpark-icon></span><div class="vx-list-filename"><a href="javascript:;">' + escapeHtml(row.event) + '</a></div></div>',
                        '<div class="vx-list-size">' + escapeHtml(row.channel) + '</div>',
                        '<div class="vx-list-date">' + escapeHtml(row.date) + '</div>',
                        '<div class="vx-list-actions"><span class="vx-muted">' + escapeHtml(row.status) + '</span></div>',
                    '</div>'
                ].join('');
            }
        });
    }

    function renderReportsView() {
        const tabs = UI.tabStrip({
            items: [
                { key: 'overview', label: 'Overview', active: showcaseState.reportsTab === 'overview' },
                { key: 'events', label: 'Events', active: showcaseState.reportsTab === 'events' },
                { key: 'exports', label: 'Exports', active: showcaseState.reportsTab === 'exports' }
            ]
        }).replace(/data-tab=/g, 'data-reports-tab=');

        let content = '';
        if (showcaseState.reportsTab === 'overview') {
            content = renderReportsOverview();
        } else if (showcaseState.reportsTab === 'events') {
            content = renderReportsEvents();
        } else {
            content = '<section class="vx-empty"><div class="vx-empty-icon"><iconpark-icon name="download"></iconpark-icon></div><h3>Export queue is empty</h3><p>Generated reports will appear here.</p></section>';
        }

        return [
            UI.moduleHeader({
                icon: 'funds',
                title: 'Reports',
                rightHtml: UI.iconButton({ icon: 'rotate', title: 'refresh' })
            }),
            '<section class="vx-points-shell">',
                tabs,
                content,
            '</section>'
        ].join('');
    }

    function renderLinksView() {
        const tabs = UI.tabStrip({
            items: [
                { key: 'dashboard', label: 'Dashboard', active: showcaseState.linksTab === 'dashboard' },
                { key: 'targets', label: 'Targets', active: showcaseState.linksTab === 'targets' },
                { key: 'domains', label: 'Domains', active: showcaseState.linksTab === 'domains' }
            ]
        }).replace(/data-tab=/g, 'data-links-tab=');

        let panel = '';
        if (showcaseState.linksTab === 'dashboard') {
            panel = [
                '<section class="vx-card">',
                    '<h3 class="vx-card-title">link-gateway.example.dev</h3>',
                    '<div class="vx-card-copy">3 active routes · 12.8K total visits · 99.9% uptime</div>',
                '</section>'
            ].join('');
        } else if (showcaseState.linksTab === 'targets') {
            panel = UI.dataList({
                columns: [
                    { className: 'vx-list-col-name', headerHtml: '<span>Name</span>' },
                    { className: 'vx-list-col-size', headerHtml: '<span>Target</span>' },
                    { className: 'vx-list-col-date', headerHtml: '<span>Visits</span>' },
                    { className: 'vx-list-col-actions', headerHtml: '<span>Status</span>' }
                ],
                rows: linkRows,
                rowBuilder: function (row) {
                    return [
                        '<div class="vx-list-row">',
                            '<div class="vx-list-name"><span class="vx-list-icon vx-icon-file"><iconpark-icon name="link"></iconpark-icon></span><div class="vx-list-filename"><a href="javascript:;">' + escapeHtml(row.name) + '</a></div></div>',
                            '<div class="vx-list-size">' + escapeHtml(row.target) + '</div>',
                            '<div class="vx-list-date">' + escapeHtml(row.visits) + '</div>',
                            '<div class="vx-list-actions"><span class="vx-muted">' + escapeHtml(row.status) + '</span></div>',
                        '</div>'
                    ].join('');
                }
            });
        } else {
            panel = '<section class="vx-empty"><div class="vx-empty-icon"><iconpark-icon name="globe"></iconpark-icon></div><h3>No custom domains yet</h3><p>Attach a domain to route friendly links.</p></section>';
        }

        return [
            UI.moduleHeader({
                icon: 'link',
                title: 'Links',
                rightHtml: UI.iconButton({ icon: 'rotate', title: 'refresh' })
            }),
            '<div class="vx-content vx-account-content">',
                tabs,
                panel,
            '</div>'
        ].join('');
    }

    function renderLibraryView() {
        const tabs = UI.tabStrip({
            items: [
                { key: 'catalog', label: 'Catalog', active: showcaseState.libraryTab === 'catalog' },
                { key: 'saved', label: 'Saved', active: showcaseState.libraryTab === 'saved' },
                { key: 'redeem', label: 'Redeem', active: showcaseState.libraryTab === 'redeem' }
            ]
        }).replace(/data-tab=/g, 'data-library-tab=');

        let content = '';
        if (showcaseState.libraryTab === 'catalog') {
            content = UI.dataList({
                columns: [
                    { className: 'vx-list-col-name', headerHtml: '<span>Name</span>' },
                    { className: 'vx-list-col-size', headerHtml: '<span>Type</span>' },
                    { className: 'vx-list-col-date', headerHtml: '<span>Updated</span>' },
                    { className: 'vx-list-col-actions', headerHtml: '<span>Action</span>' }
                ],
                rows: libraryRows,
                rowBuilder: function (row) {
                    return [
                        '<div class="vx-list-row">',
                            '<div class="vx-list-name"><span class="vx-list-icon vx-icon-file"><iconpark-icon name="file"></iconpark-icon></span><div class="vx-list-filename"><a href="javascript:;">' + escapeHtml(row.name) + '</a></div></div>',
                            '<div class="vx-list-size">' + escapeHtml(row.kind) + '</div>',
                            '<div class="vx-list-date">' + escapeHtml(row.date) + '</div>',
                            '<div class="vx-list-actions"><button class="vx-btn vx-btn-secondary vx-btn-sm" type="button">' + escapeHtml(row.action) + '</button></div>',
                        '</div>'
                    ].join('');
                }
            });
        } else if (showcaseState.libraryTab === 'saved') {
            content = '<section class="vx-empty"><div class="vx-empty-icon"><iconpark-icon name="bookmark"></iconpark-icon></div><h3>No saved items</h3><p>Save frequently used assets to access them quickly.</p></section>';
        } else {
            content = '<section class="vx-card"><h3 class="vx-card-title">Redeem Access Code</h3><div class="vx-card-copy">Enter a code to unlock premium patterns.</div><div class="vx-inline-actions" style="margin-top:10px;"><input class="vx-input" value="UI-KIT-2026"><button class="vx-btn vx-btn-primary" type="button">Apply</button></div></section>';
        }

        return [
            UI.moduleHeader({
                icon: 'bag-shopping',
                title: 'Library',
                rightHtml: UI.iconButton({ icon: 'rotate', title: 'refresh' })
            }),
            '<div class="vx-content vx-account-content">',
                tabs,
                content,
            '</div>'
        ].join('');
    }

    function renderNotesView() {
        return [
            UI.moduleHeader({
                icon: 'lock',
                title: 'Notes',
                rightHtml: UI.iconButton({ icon: 'rotate', title: 'refresh' })
            }),
            '<div class="vx-content vx-account-content">',
                '<section class="vx-card">',
                    '<h3 class="vx-card-title">Encrypted workspace notes</h3>',
                    '<div class="vx-card-copy">Use this area to capture release decisions and architecture shortcuts.</div>',
                    '<div class="vx-inline-actions" style="margin-top: 12px;">',
                        '<input class="vx-input" value="Implementation checklist" style="max-width: 280px;">',
                        '<button class="vx-btn vx-btn-primary" type="button">Save</button>',
                    '</div>',
                '</section>',
            '</div>'
        ].join('');
    }

    function renderAssistantView() {
        return [
            UI.moduleHeader({
                icon: 'comments',
                title: 'Assistant',
                rightHtml: UI.iconButton({ icon: 'rotate', title: 'refresh' })
            }),
            '<div class="vx-content vx-account-content">',
                '<section class="vx-card">',
                    '<h3 class="vx-card-title">Prompt Playground</h3>',
                    '<div class="vx-card-copy">This neutral sample previews a two-way assistant panel.</div>',
                    '<div class="vx-ai-msg-list" style="margin-top: 12px;">',
                        '<article class="vx-ai-msg vx-ai-msg-assistant"><div class="vx-ai-msg-bubble">Hello, what would you like to refine in the UI kit?</div></article>',
                        '<article class="vx-ai-msg vx-ai-msg-user"><div class="vx-ai-msg-bubble">Show me the datalist and modal component samples.</div></article>',
                    '</div>',
                    '<div class="vx-inline-actions" style="margin-top: 12px;">',
                        '<input class="vx-input" value="Ask the assistant...">',
                        '<button class="vx-btn vx-btn-primary" type="button">Send</button>',
                    '</div>',
                '</section>',
            '</div>'
        ].join('');
    }

    function updateWorkspaceSelectionUI() {
        const listRows = Array.from(document.querySelectorAll('.vx-list-body .vx-list-row'));
        const checkedRows = listRows.filter(function (row) {
            return row.classList.contains('is-selected');
        });

        const bar = document.getElementById('vx-ws-selection-bar');
        const countNode = document.getElementById('vx-ws-selection-count');
        if (!bar || !countNode) {
            return;
        }

        countNode.textContent = String(checkedRows.length);
        bar.style.display = checkedRows.length > 0 ? 'flex' : 'none';
    }

    function bindWorkspaceInteractions() {
        const listRows = Array.from(document.querySelectorAll('.vx-list-body .vx-list-row'));
        const rowCheckboxes = Array.from(document.querySelectorAll('.vx-list-body [data-row-checkbox]'));
        const selectAll = document.getElementById('vx-ws-select-all');
        const cancel = document.getElementById('vx-ws-selection-cancel');

        rowCheckboxes.forEach(function (button, index) {
            button.addEventListener('click', function () {
                const row = listRows[index];
                if (!row) {
                    return;
                }
                row.classList.toggle('is-selected');
                button.classList.toggle('is-checked');
                updateWorkspaceSelectionUI();
            });
        });

        if (selectAll) {
            selectAll.addEventListener('click', function () {
                const checked = selectAll.classList.toggle('is-checked');
                listRows.forEach(function (row, index) {
                    row.classList.toggle('is-selected', checked);
                    if (rowCheckboxes[index]) {
                        rowCheckboxes[index].classList.toggle('is-checked', checked);
                    }
                });
                updateWorkspaceSelectionUI();
            });
        }

        if (cancel) {
            cancel.addEventListener('click', function () {
                if (selectAll) {
                    selectAll.classList.remove('is-checked');
                }
                listRows.forEach(function (row, index) {
                    row.classList.remove('is-selected');
                    if (rowCheckboxes[index]) {
                        rowCheckboxes[index].classList.remove('is-checked');
                    }
                });
                updateWorkspaceSelectionUI();
            });
        }

        updateWorkspaceSelectionUI();
    }

    function bindSettingsActions(framework) {
        const infoButton = document.getElementById('vx-open-info-modal');
        const confirmButton = document.getElementById('vx-open-confirm-modal');

        if (infoButton) {
            infoButton.addEventListener('click', function () {
                framework.alert({
                    title: 'Component Modal',
                    message: 'This dialog uses the framework modal primitive.'
                });
            });
        }

        if (confirmButton) {
            confirmButton.addEventListener('click', async function () {
                const ok = await framework.confirm({
                    title: 'Apply Preferences',
                    message: 'Apply changes to this environment?'
                });

                if (ok) {
                    framework.toastSuccess('Preferences saved.');
                } else {
                    framework.toastInfo('No changes were applied.');
                }
            });
        }
    }

    function renderDynamicSidebar(viewName) {
        const dynamicContainer = document.getElementById('vx-sidebar-dynamic');
        if (!dynamicContainer) {
            return;
        }

        if (viewName === 'workspace') {
            dynamicContainer.innerHTML = [
                '<div class="vx-nav-section">',
                    '<div class="vx-nav-title">Current Collection</div>',
                    '<div class="vx-sidebar-folder-info">',
                        '<h3 class="vx-sidebar-folder-name">Workspace Root</h3>',
                        '<div class="vx-sidebar-stats">',
                            '<div class="vx-sidebar-stat-item"><iconpark-icon name="folder-open-e1ad2j7l"></iconpark-icon><div class="vx-sidebar-stat-text"><span class="vx-sidebar-stat-val">5</span><span class="vx-sidebar-stat-lbl">folders</span></div></div>',
                            '<div class="vx-sidebar-stat-item"><iconpark-icon name="file-lines"></iconpark-icon><div class="vx-sidebar-stat-text"><span class="vx-sidebar-stat-val">3</span><span class="vx-sidebar-stat-lbl">files</span></div></div>',
                            '<div class="vx-sidebar-stat-item"><iconpark-icon name="compact-disc"></iconpark-icon><div class="vx-sidebar-stat-text"><span class="vx-sidebar-stat-val">143 KB</span></div></div>',
                        '</div>',
                    '</div>',
                '</div>',
                '<div class="vx-nav-section">',
                    '<div class="vx-nav-title">Workspace Privacy</div>',
                    '<div class="vx-sidebar-module-info">',
                        '<button class="vx-switch is-active" type="button" data-vx-switch="private">',
                            '<span class="vx-switch-copy"><strong>Private workspace</strong><span>Only your team can access this collection.</span></span>',
                            '<span class="vx-switch-knob"></span>',
                        '</button>',
                    '</div>',
                '</div>',
                '<div class="vx-nav-section">',
                    '<div class="vx-nav-title">Indexing</div>',
                    '<div class="vx-sidebar-module-info">',
                        '<button class="vx-switch" type="button" data-vx-switch="index">',
                            '<span class="vx-switch-copy"><strong>Allow search indexing</strong><span>Enable this to include public metadata in search.</span></span>',
                            '<span class="vx-switch-knob"></span>',
                        '</button>',
                    '</div>',
                '</div>'
            ].join('');
        } else if (viewName === 'reports') {
            dynamicContainer.innerHTML = [
                '<div class="vx-nav-section">',
                    '<div class="vx-nav-title">Reports</div>',
                    '<button class="vx-nav-item" type="button" data-reports-tab="overview"><iconpark-icon name="chart-line"></iconpark-icon><span class="vx-nav-item-text">Overview</span></button>',
                    '<button class="vx-nav-item" type="button" data-reports-tab="events"><iconpark-icon name="list-check"></iconpark-icon><span class="vx-nav-item-text">Events</span></button>',
                    '<button class="vx-nav-item" type="button" data-reports-tab="exports"><iconpark-icon name="download"></iconpark-icon><span class="vx-nav-item-text">Exports</span></button>',
                '</div>'
            ].join('');
        } else if (viewName === 'links') {
            dynamicContainer.innerHTML = [
                '<div class="vx-nav-section">',
                    '<div class="vx-nav-title">Links</div>',
                    '<button class="vx-nav-item" type="button" data-links-tab="dashboard"><iconpark-icon name="gauge-circle-bolt"></iconpark-icon><span class="vx-nav-item-text">Dashboard</span></button>',
                    '<button class="vx-nav-item" type="button" data-links-tab="targets"><iconpark-icon name="file"></iconpark-icon><span class="vx-nav-item-text">Targets</span></button>',
                    '<button class="vx-nav-item" type="button" data-links-tab="domains"><iconpark-icon name="globe"></iconpark-icon><span class="vx-nav-item-text">Domains</span></button>',
                '</div>'
            ].join('');
        } else if (viewName === 'library') {
            dynamicContainer.innerHTML = [
                '<div class="vx-nav-section">',
                    '<div class="vx-nav-title">Library</div>',
                    '<button class="vx-nav-item" type="button" data-library-tab="catalog"><iconpark-icon name="bag-shopping"></iconpark-icon><span class="vx-nav-item-text">Catalog</span></button>',
                    '<button class="vx-nav-item" type="button" data-library-tab="saved"><iconpark-icon name="bookmark"></iconpark-icon><span class="vx-nav-item-text">Saved</span></button>',
                    '<button class="vx-nav-item" type="button" data-library-tab="redeem"><iconpark-icon name="gift-card"></iconpark-icon><span class="vx-nav-item-text">Redeem</span></button>',
                '</div>'
            ].join('');
        } else if (viewName === 'notes') {
            dynamicContainer.innerHTML = [
                '<div class="vx-nav-section">',
                    '<div class="vx-nav-title">Notes</div>',
                    '<button class="vx-nav-item is-active" type="button"><iconpark-icon name="lock"></iconpark-icon><span class="vx-nav-item-text">Implementation checklist</span></button>',
                    '<button class="vx-nav-item" type="button"><iconpark-icon name="lock"></iconpark-icon><span class="vx-nav-item-text">Component backlog</span></button>',
                    '<button class="vx-nav-item" type="button"><iconpark-icon name="lock"></iconpark-icon><span class="vx-nav-item-text">Release draft</span></button>',
                '</div>'
            ].join('');
        } else if (viewName === 'assistant') {
            dynamicContainer.innerHTML = [
                '<div class="vx-nav-section">',
                    '<div class="vx-nav-title">Sessions</div>',
                    '<button class="vx-nav-item is-active" type="button"><iconpark-icon name="message"></iconpark-icon><span class="vx-nav-item-text">UI review</span></button>',
                    '<button class="vx-nav-item" type="button"><iconpark-icon name="message"></iconpark-icon><span class="vx-nav-item-text">Migration notes</span></button>',
                '</div>'
            ].join('');
        } else {
            dynamicContainer.innerHTML = '';
        }

        syncDynamicSidebarState();
    }

    function syncDynamicSidebarState() {
        document.querySelectorAll('#vx-sidebar-dynamic [data-reports-tab]').forEach(function (button) {
            button.classList.toggle('is-active', button.getAttribute('data-reports-tab') === showcaseState.reportsTab);
        });

        document.querySelectorAll('#vx-sidebar-dynamic [data-links-tab]').forEach(function (button) {
            button.classList.toggle('is-active', button.getAttribute('data-links-tab') === showcaseState.linksTab);
        });

        document.querySelectorAll('#vx-sidebar-dynamic [data-library-tab]').forEach(function (button) {
            button.classList.toggle('is-active', button.getAttribute('data-library-tab') === showcaseState.libraryTab);
        });
    }

    function setAuthState(framework, loggedIn) {
        showcaseState.loggedIn = loggedIn;
        showcaseState.owner = loggedIn;

        framework.refreshAuth();
        framework.renderNavigation();

        if (!loggedIn && framework.currentView !== 'workspace') {
            framework.navigate('workspace');
        } else {
            framework.renderView(framework.currentView || 'workspace', framework.currentState);
        }

        renderDynamicSidebar(framework.currentView || 'workspace');
    }

    function bindGlobalEvents(framework) {
        const app = document.getElementById('vx-app');
        const logoutBtn = document.getElementById('showcase-logout-btn');
        const loginBtn = document.getElementById('showcase-login-btn');
        const registerBtn = document.getElementById('showcase-register-btn');

        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                setAuthState(framework, false);
            });
        }

        if (loginBtn) {
            loginBtn.addEventListener('click', function () {
                setAuthState(framework, true);
            });
        }

        if (registerBtn) {
            registerBtn.addEventListener('click', function () {
                setAuthState(framework, true);
            });
        }

        if (app) {
            app.addEventListener('vxui:viewchange', function (event) {
                const viewName = event.detail && event.detail.view ? event.detail.view : framework.currentView;
                renderDynamicSidebar(viewName || 'workspace');
            });

            app.addEventListener('click', function (event) {
                const modeButton = event.target.closest('[data-workspace-mode]');
                if (modeButton) {
                    const mode = modeButton.getAttribute('data-workspace-mode');
                    if (mode && (mode === 'list' || mode === 'album')) {
                        showcaseState.workspaceMode = mode;
                        framework.renderView('workspace', framework.currentState);
                    }
                    return;
                }

                const reportsTabButton = event.target.closest('[data-reports-tab]');
                if (reportsTabButton) {
                    const tab = reportsTabButton.getAttribute('data-reports-tab');
                    if (tab) {
                        showcaseState.reportsTab = tab;
                        if (framework.currentView !== 'reports') {
                            framework.navigate('reports');
                        } else {
                            framework.renderView('reports', framework.currentState);
                        }
                    }
                    return;
                }

                const linksTabButton = event.target.closest('[data-links-tab]');
                if (linksTabButton) {
                    const tab = linksTabButton.getAttribute('data-links-tab');
                    if (tab) {
                        showcaseState.linksTab = tab;
                        if (framework.currentView !== 'links') {
                            framework.navigate('links');
                        } else {
                            framework.renderView('links', framework.currentState);
                        }
                    }
                    return;
                }

                const libraryTabButton = event.target.closest('[data-library-tab]');
                if (libraryTabButton) {
                    const tab = libraryTabButton.getAttribute('data-library-tab');
                    if (tab) {
                        showcaseState.libraryTab = tab;
                        if (framework.currentView !== 'library') {
                            framework.navigate('library');
                        } else {
                            framework.renderView('library', framework.currentState);
                        }
                    }
                    return;
                }

                const sidebarSwitch = event.target.closest('[data-vx-switch]');
                if (sidebarSwitch) {
                    sidebarSwitch.classList.toggle('is-active');
                }
            });
        }
    }

    const framework = new window.VXUIFramework({
        root: '#vx-app',
        viewContainer: '#vx-view',
        sidebarNav: '#vx-sidebar-nav',
        mobileNav: '#vx-mobile-bar',
        sidebar: '#vx-sidebar',
        sidebarOverlay: '[data-vx-sidebar-overlay]',
        defaultView: 'workspace',
        unauthorizedView: 'workspace',
        initialTheme: 'system',
        authProvider: function () {
            return {
                loggedIn: showcaseState.loggedIn,
                owner: showcaseState.owner,
                user: showcaseState.loggedIn ? showcaseState.user : null
            };
        }
    });

    framework.registerViews({
        workspace: {
            title: 'Workspace',
            render: renderWorkspaceView,
            afterRender: bindWorkspaceInteractions
        },
        links: {
            title: 'Links',
            render: renderLinksView
        },
        notes: {
            title: 'Notes',
            render: renderNotesView,
            requiresAuth: true
        },
        assistant: {
            title: 'Assistant',
            render: renderAssistantView,
            requiresAuth: true
        },
        library: {
            title: 'Library',
            render: renderLibraryView,
            requiresAuth: true
        },
        reports: {
            title: 'Reports',
            render: renderReportsView,
            requiresAuth: true
        },
        profile: {
            title: 'Profile',
            render: renderProfileView,
            requiresAuth: true
        },
        settings: {
            title: 'Settings',
            render: renderSettingsView,
            requiresAuth: true,
            afterRender: function () {
                bindSettingsActions(framework);
            }
        }
    });

    framework.setNavigation([
        { view: 'workspace', label: 'Workspace', icon: 'folder-open-e1ad2j7l' },
        { view: 'links', label: 'Links', icon: 'link' },
        { view: 'notes', label: 'Notes', icon: 'lock', showWhenLoggedIn: true },
        { view: 'assistant', label: 'Assistant', icon: 'comments', showWhenLoggedIn: true },
        { view: 'library', label: 'Library', icon: 'bag-shopping', showWhenLoggedIn: true },
        { view: 'reports', label: 'Reports', icon: 'funds', showWhenLoggedIn: true },
        { view: 'profile', label: 'Profile', icon: 'user', showWhenLoggedIn: true },
        { view: 'settings', label: 'Settings', icon: 'gear', showWhenLoggedIn: true }
    ]);

    framework.init().then(function () {
        bindGlobalEvents(framework);
        renderDynamicSidebar(framework.currentView || 'workspace');
    });
})(window, document);
