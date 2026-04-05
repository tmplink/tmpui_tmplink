(function (window) {
    'use strict';

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function icon(name, className) {
        const cls = className ? ' class="' + escapeHtml(className) + '"' : '';
        return '<iconpark-icon name="' + escapeHtml(name) + '"' + cls + '></iconpark-icon>';
    }

    function button(options) {
        const config = options || {};
        const classes = config.className || 'vx-btn vx-btn-secondary';
        const type = config.type || 'button';
        const attrs = config.attrs || '';
        const iconHtml = config.icon ? icon(config.icon) : '';
        const label = config.label ? '<span>' + escapeHtml(config.label) + '</span>' : '';

        return '<button type="' + escapeHtml(type) + '" class="' + escapeHtml(classes) + '" ' + attrs + '>' + iconHtml + label + '</button>';
    }

    function iconButton(options) {
        const config = options || {};
        const classes = config.className || 'vx-btn-icon';
        const attrs = config.attrs || '';
        const title = config.title ? ' title="' + escapeHtml(config.title) + '"' : '';

        return '<button type="button" class="' + escapeHtml(classes) + '"' + title + ' ' + attrs + '>' + icon(config.icon || 'circle-info') + '</button>';
    }

    function moduleHeader(options) {
        const config = options || {};
        return [
            '<header class="vx-header vx-header-account vx-header-minimal vx-showcase-module-header">',
                '<div class="vx-header-left">',
                    iconButton({ className: 'vx-btn-icon vx-portrait-sidebar-btn', icon: 'bars', title: 'menu', attrs: 'data-vx-sidebar-toggle' }),
                    '<h1 class="vx-page-title">',
                        icon(config.icon || 'circle-info'),
                        '<span>' + escapeHtml(config.title || 'Module') + '</span>',
                    '</h1>',
                '</div>',
                '<div class="vx-header-right vx-showcase-module-header-right">',
                    config.rightHtml || '',
                '</div>',
            '</header>'
        ].join('');
    }

    function tabStrip(options) {
        const config = options || {};
        const items = Array.isArray(config.items) ? config.items : [];
        const className = config.className || 'vx-points-tab-strip';

        const buttons = items.map(function (item) {
            const activeClass = item.active ? ' is-active' : '';
            return '<button type="button" class="vx-points-tab-btn' + activeClass + '" data-tab="' + escapeHtml(item.key) + '">' + escapeHtml(item.label) + '</button>';
        });

        return '<div class="' + escapeHtml(className) + '">' + buttons.join('') + '</div>';
    }

    function dataList(options) {
        const config = options || {};
        const columns = Array.isArray(config.columns) ? config.columns : [];
        const rows = Array.isArray(config.rows) ? config.rows : [];
        const rowBuilder = typeof config.rowBuilder === 'function' ? config.rowBuilder : null;

        const headerHtml = columns.map(function (column) {
            return [
                '<div class="vx-list-col ' + escapeHtml(column.className || '') + '">',
                    column.headerHtml || ('<span>' + escapeHtml(column.label || '') + '</span>'),
                '</div>'
            ].join('');
        }).join('');

        const bodyHtml = rows.map(function (row, index) {
            if (rowBuilder) {
                return rowBuilder(row, index);
            }

            const cells = columns.map(function (column) {
                const value = row[column.key] == null ? '' : row[column.key];
                return '<div class="' + escapeHtml(column.cellClassName || column.className || '') + '">' + escapeHtml(value) + '</div>';
            }).join('');

            return '<div class="vx-list-row">' + cells + '</div>';
        }).join('');

        return [
            '<div class="vx-list-container ' + escapeHtml(config.className || '') + '">',
                '<div class="vx-list-header">' + headerHtml + '</div>',
                '<div class="vx-list-body">' + bodyHtml + '</div>',
            '</div>'
        ].join('');
    }

    function selectionBar(options) {
        const config = options || {};
        const actions = Array.isArray(config.actions) ? config.actions : [];
        const actionHtml = actions.map(function (action) {
            return button({
                className: action.className || 'vx-btn vx-btn-ghost vx-btn-sm',
                icon: action.icon,
                label: action.label,
                attrs: action.attrs || ''
            });
        }).join('');

        return [
            '<div class="vx-selection-bar" id="' + escapeHtml(config.id || 'vx-selection-bar') + '" style="display:none;">',
                '<div class="vx-inline-actions"><strong id="' + escapeHtml(config.countId || 'vx-selection-count') + '">0</strong><span class="vx-muted">' + escapeHtml(config.caption || 'Selected') + '</span></div>',
                '<div class="vx-inline-actions">',
                    actionHtml,
                '</div>',
            '</div>'
        ].join('');
    }

    function switchItem(options) {
        const config = options || {};
        return [
            '<label class="vx-switch-item">',
                '<div class="vx-switch-copy">',
                    '<strong>' + escapeHtml(config.title || 'Toggle') + '</strong>',
                    '<span>' + escapeHtml(config.description || '') + '</span>',
                '</div>',
                '<input type="checkbox" class="vx-switch" ' + (config.checked ? 'checked' : '') + ' ' + (config.attrs || '') + '>',
            '</label>'
        ].join('');
    }

    window.VXUIComponents = {
        escapeHtml: escapeHtml,
        icon: icon,
        button: button,
        iconButton: iconButton,
        moduleHeader: moduleHeader,
        tabStrip: tabStrip,
        dataList: dataList,
        selectionBar: selectionBar,
        switchItem: switchItem
    };
})(window);
