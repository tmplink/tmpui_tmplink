const fs = require('fs');
let css = fs.readFileSync('vxui-framework/css/vxui-showcase.css', 'utf-8');

const regexToRemove = /\/\* ================================================\s+Sidebar structure overrides.*?=\s+\*\/\s+.*?\.vx-switch-shell input {[^}]*}/s;

css = css.replace(regexToRemove, `/* Showcase specific minor adjustments */
.vx-showcase-shell {
    --vx-primary: #2563eb;
    --vx-primary-strong: #1d4ed8;
    --vx-primary-soft: rgba(37, 99, 235, 0.12);
}
html.vx-dark .vx-showcase-shell {
    --vx-primary: #3b82f6;
    --vx-primary-strong: #2563eb;
    --vx-primary-soft: rgba(59, 130, 246, 0.14);
    --vx-surface: #1e293b;
    --vx-surface-strong: #1e293b;
    --vx-surface-hover: rgba(255,255,255,0.06);
    --vx-border: rgba(255,255,255,0.1);
}

.vx-guest-auth-section {
    margin-top: 6px;
}

.vx-docs-note-card {
    margin: 10px 12px 0;
    padding: 14px;
    border-radius: 14px;
    border: 1px solid var(--vx-border);
    background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--vx-primary-soft) 62%, transparent),
        color-mix(in srgb, var(--vx-surface-strong) 86%, transparent)
    );
    box-shadow: var(--vx-shadow-sm);
}

.vx-lang-switcher {
    width: 100%;
    border-radius: var(--vx-radius);
    transition: var(--vx-transition-fast);
    margin-bottom: 6px;
}

.vx-lang-switcher .vx-nav-item {
    width: 100%;
    justify-content: flex-start;
    position: relative;
}

.vx-lang-switcher .vx-lang-arrow {
    margin-left: auto;
    font-size: 12px;
}

.vx-sidebar-folder-info {
    padding: 0 10px 4px;
}

.vx-sidebar-folder-name {
    margin: 0 0 10px;
    font-size: 15px;
    font-weight: 600;
}

.vx-sidebar-stats {
    display: grid;
    gap: 8px;
}

.vx-sidebar-stat-item {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 12px;
    color: var(--vx-text-secondary);
}

.vx-sidebar-stat-item iconpark-icon {
    width: 16px;
    color: var(--vx-text-muted);
}

.vx-sidebar-stat-text {
    display: flex;
    align-items: baseline;
    gap: 4px;
}

.vx-sidebar-stat-val {
    font-size: 13px;
    font-weight: 600;
    color: var(--vx-text);
}

.vx-sidebar-module-info {
    margin: 0 4px;
    padding: 10px;
    border-radius: 12px;
    border: 1px solid var(--vx-border);
    background: color-mix(in srgb, var(--vx-surface-strong) 80%, transparent);
}

.vx-sidebar-module-info .vx-switch {
    width: 100%;
    border-radius: 12px;
    padding: 10px 12px;
}

.vx-sidebar-module-info .vx-switch-copy strong {
    font-size: 13px;
}

.vx-sidebar-module-info .vx-switch-copy span {
    font-size: 11px;
}

.vx-sidebar-stat-action {
    border: 0;
    background: transparent;
    color: var(--vx-primary);
    font-size: 12px;
    cursor: pointer;
    padding: 0;
}

.vx-switch-shell {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
    color: var(--vx-text-secondary);
}

.vx-switch-shell input {
    accent-color: var(--vx-primary);
}`);

fs.writeFileSync('vxui-framework/css/vxui-showcase.css', css);
