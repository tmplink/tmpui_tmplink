const fs = require('fs');
let css = fs.readFileSync('vxui-framework/css/vxui-framework.css', 'utf-8');

const oldHeader = `.vx-sidebar-header,
.vx-sidebar-footer,
.vx-sidebar-body {
    display: flex;
    flex-direction: column;
}

.vx-sidebar-header {
    gap: 0;
}

.vx-sidebar-body {
    flex: 1;
    gap: 8px;
    overflow-y: auto;
}

.vx-brand {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border: 1px solid var(--vx-border);
    border-radius: 22px;
    background: linear-gradient(135deg, rgba(15, 118, 110, 0.12), rgba(3, 105, 161, 0.08));
    color: var(--vx-text);
    text-align: left;
}

.vx-brand-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 14px;
    background: var(--vx-primary);
    color: var(--vx-text-inverse);
    font-size: 18px;
    font-weight: 800;
    box-shadow: var(--vx-shadow-sm);
}

.vx-brand-copy {
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.vx-brand-title {
    font-size: 18px;
    font-weight: 700;
}

.vx-brand-subtitle {
    font-size: 12px;
    color: var(--vx-text-secondary);
}

.vx-section-label {
    padding: 0 12px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--vx-text-muted);
}

.vx-nav-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.vx-nav-item,
.vx-mobile-btn,
.vx-icon-button,
.vx-btn,
.vx-btn-chip,
.vx-brand {
    appearance: none;
    border: none;
    cursor: pointer;
    font: inherit;
}`;

const newHeader = `.vx-sidebar-header,
.vx-sidebar-footer,
.vx-sidebar-body {
    display: flex;
    flex-direction: column;
}

.vx-sidebar-header {
    height: var(--vx-header-height);
    display: flex;
    align-items: center;
    padding: 0 20px;
    border-bottom: 1px solid var(--vx-border);
    flex-shrink: 0;
}

.vx-sidebar-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    background: transparent;
    padding: 0;
    appearance: none;
    border: none;
    cursor: pointer;
    font: inherit;
    text-align: left;
}

.vx-sidebar-brand-logo {
    width: 32px;
    height: 32px;
    border-radius: var(--vx-radius-sm);
}

.vx-sidebar-brand-text {
    font-size: var(--vx-text-xl);
    font-weight: 600;
    color: var(--vx-text);
}

.vx-sidebar-body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
}

.vx-sidebar-nav {
    flex: 0 0 auto;
    overflow: visible;
    padding: 12px 0;
    display: flex;
    flex-direction: column;
}

.vx-sidebar-bottom-menu {
    padding: 12px 0;
    border-top: 1px solid var(--vx-border);
    flex-shrink: 0;
    margin-top: auto;
}

.vx-sidebar-footer {
    padding: 12px;
    border-top: 1px solid var(--vx-border);
    flex-shrink: 0;
    position: relative;
    overflow: visible;
}

.vx-nav-section {
    padding: 0 12px;
    margin-bottom: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.vx-sidebar-bottom-menu .vx-nav-section {
    margin-bottom: 0;
}

.vx-nav-divider {
    height: 1px;
    background: var(--vx-border);
    margin: 10px 12px;
    flex-shrink: 0;
}

.vx-nav-title {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    font-size: var(--vx-text-xs);
    font-weight: 600;
    color: var(--vx-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.vx-nav-item,
.vx-mobile-btn,
.vx-icon-button,
.vx-btn,
.vx-btn-chip {
    appearance: none;
    border: none;
    cursor: pointer;
    font: inherit;
}`;

css = css.replace(oldHeader, newHeader);

// Now finding .is-active for .vx-nav-item and replacing it with the solid blue active state
const oldActive = `.vx-nav-item.is-active {
    background: var(--vx-primary-light);
    color: var(--vx-primary);
}`;

const newActive = `.vx-nav-item.is-active, .vx-nav-item.active {
    background: var(--vx-primary-light);
    color: var(--vx-primary);
}`;

// NOTE: We need the light blue background with blue text.
css = css.replace(oldActive, newActive);

fs.writeFileSync('vxui-framework/css/vxui-framework.css', css);
