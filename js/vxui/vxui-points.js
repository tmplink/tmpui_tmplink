window.VX_POINTS = {
	currentTab: 'summary',
	_originalFooter: null,

	t(key, fallback) {
		return (typeof TL !== 'undefined' && TL.tpl && TL.tpl[key]) ? TL.tpl[key] : fallback;
	},

	isCN() {
		return typeof TL !== 'undefined' && TL.lang === 'cn';
	},

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
		}
	},

	formatPoints(value) {
		const num = Number(value);
		if (Number.isFinite(num)) {
			try {
				return num.toLocaleString();
			} catch (e) {
				return String(num);
			}
		}
		if (value === null || typeof value === 'undefined' || value === '') return '--';
		return String(value);
	},

	init(params = {}) {
		if (typeof TL !== 'undefined' && !TL.isLogin()) {
			VXUI.toastWarning(this.t('vx_need_login', '请先登录'));
			setTimeout(() => {
				app.open('/login');
			}, 800);
			return;
		}

		this.updateSidebar();

		if (typeof TL !== 'undefined' && TL.tpl_lang) {
			TL.tpl_lang();
		}

		const nextTab = (params && params.tab) ? String(params.tab) : 'summary';
		if (nextTab === 'summary' || nextTab === 'selling' || nextTab === 'mall') {
			this.showTab(nextTab);
		} else {
			this.showTab('summary');
		}

		// Fetch balance
		this.fetchBalance();
	},

	async fetchBalance() {
		const el = document.getElementById('vx-points-balance');
		if (!el) return;
		const userPoint = (typeof TL !== 'undefined' && typeof TL.user_point !== 'undefined') ? TL.user_point : 0;
		el.textContent = this.formatPoints(userPoint);
	},

	updateSidebar() {
		if (typeof VXUI !== 'undefined' && typeof VXUI.setSidebarDynamicFromTemplate === 'function') {
			VXUI.setSidebarDynamicFromTemplate('vx-points-sidebar-tpl');
		} else {
			const sidebarTpl = document.getElementById('vx-points-sidebar-tpl');
			const sidebarDynamic = document.getElementById('vx-sidebar-dynamic');
			if (sidebarTpl && sidebarDynamic) {
				sidebarDynamic.innerHTML = sidebarTpl.innerHTML;
			}
		}

		if (typeof TL !== 'undefined' && TL.tpl_lang) {
			TL.tpl_lang();
		}
	},

	showTab(tab) {
		this.currentTab = tab;
		this.trackUI(`vui_points[${tab}]`);

		if (typeof VXUI !== 'undefined' && VXUI && typeof VXUI.updateUrl === 'function') {
			const currentParams = (typeof VXUI.getUrlParams === 'function') ? (VXUI.getUrlParams() || {}) : {};
			delete currentParams.module;
			if (tab === 'summary') {
				delete currentParams.tab;
			} else {
				currentParams.tab = tab;
			}
			VXUI.updateUrl('points', currentParams);
		}

		document.querySelectorAll('#vx-sidebar-dynamic .vx-nav-item').forEach(item => {
			item.classList.remove('active');
		});
		const navItem = document.getElementById(`nav-points-${tab}`);
		if (navItem) navItem.classList.add('active');

		const subtitleEl = document.getElementById('vx-points-header-subtitle');
		if (subtitleEl) {
			if (tab === 'selling') {
				subtitleEl.textContent = ' - ' + this.t('vx_points_selling_tab', '出售文件');
			} else if (tab === 'mall') {
				subtitleEl.textContent = ' - ' + this.t('vx_points_mall_tab', '点数商城');
			} else {
				subtitleEl.textContent = '';
			}
		}

		const summaryEl = document.getElementById('vx-points-summary');
		const sellingEl = document.getElementById('vx-points-selling');
		const mallEl = document.getElementById('vx-points-mall');

		if (summaryEl) summaryEl.style.display = tab === 'summary' ? 'block' : 'none';
		if (sellingEl) sellingEl.style.display = tab === 'selling' ? 'flex' : 'none';
		if (mallEl) mallEl.style.display = tab === 'mall' ? 'block' : 'none';

		const pointsContentEl = document.querySelector('.vx-points-content');
		if (pointsContentEl) {
			pointsContentEl.classList.toggle('vx-points-content-selling', tab === 'selling');
		}

		if (tab === 'summary') {
			this.loadPointLog(0);
			this.fetchBalance();
		} else if (tab === 'selling') {
			this.loadSellingFiles(0);
		} else if (tab === 'mall') {
			this.renderMall();
		}
	},

	refresh() {
		if (this.currentTab === 'selling') {
			this.loadSellingFiles(0);
		} else if (this.currentTab === 'summary') {
			this.loadPointLog(0);
			// Re-fetch user info to get latest point balance from server
			if (typeof TL !== 'undefined' && typeof TL.get_details === 'function') {
				TL.get_details(() => { this.fetchBalance(); });
			} else {
				this.fetchBalance();
			}
		}
		VXUI.toastInfo(this.t('vx_refreshed', '已刷新'));
	},

	refreshDynamicText() {
		const subtitleEl = document.getElementById('vx-points-header-subtitle');
		if (subtitleEl) {
			if (this.currentTab === 'selling') {
				subtitleEl.textContent = ' - ' + this.t('vx_points_selling_tab', '出售文件');
			} else if (this.currentTab === 'mall') {
				subtitleEl.textContent = ' - ' + this.t('vx_points_mall_tab', '点数商城');
			} else {
				subtitleEl.textContent = '';
			}
		}

		if (this.currentTab === 'selling') {
			this.loadSellingFiles(0);
		} else if (this.currentTab === 'summary') {
			this.loadPointLog(0);
			this.fetchBalance();
		}
	},

	renderMall() {
		const container = document.getElementById('vx-mall-products');
		if (!container || this._mallRendered) return;
		this._mallRendered = true;

		const products = [
			{ id: 'jd_50',  denomination: 50,  points: 6500,  img: '/img/mall/jd_ecard_50.svg'  },
			{ id: 'jd_100', denomination: 100, points: 13000, img: '/img/mall/jd_ecard_100.svg' },
			{ id: 'jd_500', denomination: 500, points: 65000, img: '/img/mall/jd_ecard_500.svg' },
		];

		const nameText = this.t('vx_mall_jd_ecard', '京东 E 卡');
		const pointsUnit = this.t('vx_mall_points_unit', '点数');
		const exchangeText = this.t('vx_mall_exchange', '兑换');
		const soldOutText = this.t('vx_mall_sold_out', '已兑换完');

		let html = '<div class="vx-mall-grid">';
		for (const p of products) {
			html += `
			<div class="vx-mall-card" id="mall-card-${p.id}">
				<div class="vx-mall-card-image">
					<img src="${p.img}" alt="${nameText} ¥${p.denomination}" draggable="false">
					<div class="vx-mall-sold-out-overlay" id="sold-out-${p.id}" style="display:none;">
						<span class="vx-mall-sold-out-badge">${soldOutText}</span>
					</div>
				</div>
				<div class="vx-mall-card-body">
					<div class="vx-mall-card-name">${nameText}</div>
					<div class="vx-mall-card-denom">¥${p.denomination}</div>
					<div class="vx-mall-card-cost">${p.points.toLocaleString()} ${pointsUnit}</div>
					<button class="vx-mall-exchange-btn" id="btn-${p.id}" onclick="VX_POINTS.exchangeMallItem('${p.id}')">${exchangeText}</button>
				</div>
			</div>`;
		}
		html += '</div>';
		container.innerHTML = html;
	},

	exchangeMallItem(id) {
		const btn = document.getElementById(`btn-${id}`);
		const overlay = document.getElementById(`sold-out-${id}`);
		const soldOutText = this.t('vx_mall_sold_out', '已兑换完');
		if (btn) {
			btn.disabled = true;
			btn.textContent = soldOutText;
		}
		if (overlay) {
			overlay.style.display = 'flex';
		}
	},

	async loadSellingFiles(page = 0) {
		const listBody = document.getElementById('vx-points-selling-body');
		const paginationEl = document.getElementById('vx-points-selling-pagination');
		if (!listBody || !paginationEl) return;

		this._sellingPage = page;

		const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
		if (!token) {
			listBody.innerHTML = `<div class="vx-orders-empty">${this.t('vx_need_login', '请先登录')}</div>`;
			paginationEl.innerHTML = '';
			return;
		}

		listBody.innerHTML = `
			<div class="vx-skeleton-list">
				<div class="vx-skeleton-row">
					<div class="vx-skeleton-bone vx-skeleton-icon"></div>
					<div class="vx-skeleton-bone vx-skeleton-text" style="width: 58%"></div>
					<div class="vx-skeleton-bone vx-skeleton-text-sm"></div>
					<div class="vx-skeleton-bone vx-skeleton-text-date"></div>
					<div class="vx-skeleton-bone" style="width: 64px;"></div>
				</div>
				<div class="vx-skeleton-row">
					<div class="vx-skeleton-bone vx-skeleton-icon"></div>
					<div class="vx-skeleton-bone vx-skeleton-text" style="width: 45%"></div>
					<div class="vx-skeleton-bone vx-skeleton-text-sm"></div>
					<div class="vx-skeleton-bone vx-skeleton-text-date"></div>
					<div class="vx-skeleton-bone" style="width: 64px;"></div>
				</div>
				<div class="vx-skeleton-row">
					<div class="vx-skeleton-bone vx-skeleton-icon"></div>
					<div class="vx-skeleton-bone vx-skeleton-text" style="width: 66%"></div>
					<div class="vx-skeleton-bone vx-skeleton-text-sm"></div>
					<div class="vx-skeleton-bone vx-skeleton-text-date"></div>
					<div class="vx-skeleton-bone" style="width: 64px;"></div>
				</div>
			</div>
		`;
		paginationEl.innerHTML = '';

		try {
			const apiUrl = (typeof TL !== 'undefined' && TL.api_file) ? TL.api_file : '/api_v2/file';
			const response = await fetch(apiUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					action: 'file_selling_list',
					token,
					page
				}).toString()
			});
			const rsp = await response.json();

			if (rsp.status === 101 || !Array.isArray(rsp.data) || rsp.data.length === 0) {
				this._sellingList = [];
				listBody.innerHTML = `
					<div class="vx-orders-empty">
						<iconpark-icon name="folder-open" style="font-size:48px;color:var(--vx-text-muted);"></iconpark-icon>
						<p>${this.t('vx_no_selling_files', '暂无出售文件')}</p>
					</div>
				`;
				paginationEl.innerHTML = '';
				return;
			}

			this._sellingList = rsp.data;

			let html = '';
			for (const file of rsp.data) {
				html += this.renderSellingRow(file);
			}
			listBody.innerHTML = html;

			paginationEl.innerHTML = `
				<div class="vx-point-pagination">
					${page > 0 ? `<button class="vx-btn vx-btn-secondary" onclick="VX_POINTS.loadSellingFiles(${page - 1})">${this.t('vx_prev_page', '上一页')}</button>` : ''}
					<span>${this.t('vx_page', '第')} ${page + 1} ${this.t('vx_page_suffix', '页')}</span>
					${rsp.data.length >= 20 ? `<button class="vx-btn vx-btn-secondary" onclick="VX_POINTS.loadSellingFiles(${page + 1})">${this.t('vx_next_page', '下一页')}</button>` : ''}
				</div>
			`;
		} catch (e) {
			console.error('[VX_POINTS] loadSellingFiles error:', e);
			listBody.innerHTML = `
				<div class="vx-orders-empty">
					<iconpark-icon name="circle-exclamation" style="font-size:48px;color:var(--vx-danger);"></iconpark-icon>
					<p>${this.t('vx_load_failed', '加载失败')}</p>
				</div>
			`;
			paginationEl.innerHTML = '';
		}
	},

	renderSellingRow(file) {
		const sold = Number(file.sold_count || 0);
		const downloads = Number(file.downloads || 0);
		const dateText = this.formatDateOnly(file.price_set_time || file.ctime || '');
		const fullTime = this.formatTime(file.price_set_time || file.ctime || '');
		const iconInfo = this.getFileIcon(file.ftype);

		return `
			<div class="vx-list-row" data-ukey="${this.escapeHtml(file.ukey || '')}">
				<div class="vx-list-name">
					<div class="vx-list-icon ${iconInfo.class}"><iconpark-icon name="${iconInfo.icon}"></iconpark-icon></div>
					<div class="vx-list-filename">
						<a href="/file?ukey=${this.escapeHtml(file.ukey || '')}" tmpui-app="true" target="_blank" onclick="event.stopPropagation();">${this.escapeHtml(file.fname || '-')}</a>
						<span class="vx-price-tag" title="${this.t('vx_file_for_sale', '付费文件')}: ${file.price || 0} ${this.t('vx_points', '点数')}">
							<iconpark-icon name="funds"></iconpark-icon>${file.price || 0}
						</span>
						<span class="vx-selling-stats-inline">${this.t('vx_sold_count', '已售')} ${sold} · ${this.t('vx_download_count', '下载')} ${downloads}</span>
					</div>
				</div>
				<div class="vx-list-size">${this.escapeHtml(file.fsize_formated || this.formatSize(file.fsize || 0))}</div>
				<div class="vx-list-date vx-hide-mobile" title="${this.escapeHtml(fullTime)}">${this.escapeHtml(dateText)}</div>
				<div class="vx-list-actions">
					<button class="vx-list-action-btn" onclick="event.stopPropagation(); VX_POINTS.openSetPriceModal('${this.escapeHtml(file.ukey || '')}')" title="${this.t('vx_update_price', '调整价格')}">
						<iconpark-icon name="funds"></iconpark-icon>
					</button>
					<button class="vx-list-action-btn vx-action-danger" onclick="event.stopPropagation(); VX_POINTS.confirmRemoveFilePrice('${this.escapeHtml(file.ukey || '')}')" title="${this.t('vx_fl_menu_remove_price', '取消出售')}">
						<iconpark-icon name="circle-xmark"></iconpark-icon>
					</button>
				</div>
			</div>
		`;
	},

	openSetPriceModal(ukey) {
		const file = (this._sellingList || []).find(item => String(item.ukey) === String(ukey));
		if (!file) return;

		this._currentSetPriceUkey = ukey;
		const currentPrice = parseInt(file.price || 0, 10);
		const fname = file.fname || '';

		const modalTitle = document.getElementById('vx-points-modal-title');
		const modalBody = document.getElementById('vx-points-modal-body');
		const modalFooter = document.getElementById('vx-points-modal-footer');
		if (!modalTitle || !modalBody || !modalFooter) return;

		modalTitle.innerHTML = `<iconpark-icon name="funds"></iconpark-icon> ${currentPrice ? this.t('vx_update_price', '调整价格') : this.t('vx_sell_file', '出售')}`;
		modalBody.innerHTML = `
			<div style="display:flex;align-items:center;justify-content:center;gap:2px;font-size:14px;color:var(--vx-text-secondary);margin-bottom:8px;">
				<span>${this.t('vx_set_price_for_prefix', '为')}</span>
				<span style="display:inline-block;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom;">${this.escapeHtml(fname)}</span>
				<span>${this.t('vx_set_price_for_suffix', '设定售价。')}</span>
			</div>
			<input type="number" id="vx-points-price-input" class="vx-input"
				value="${currentPrice}" min="1" max="10000" step="1"
				placeholder="${this.t('vx_price_placeholder', '出售价格（点数）')}"
				style="width:100%;font-size:20px;text-align:center;padding:12px;">
		`;

		this._originalFooter = modalFooter.innerHTML;
		modalFooter.innerHTML = `
			<div></div>
			<div class="vx-modal-actions">
				<button class="vx-btn vx-btn-secondary" onclick="VX_POINTS.closeModal()">${this.t('btn_cancel', '取消')}</button>
				<button class="vx-btn vx-btn-primary" onclick="VX_POINTS.confirmSetFilePrice()">${this.t('vx_save', '保存')}</button>
			</div>
		`;

		this.showModal();
		setTimeout(() => {
			const input = document.getElementById('vx-points-price-input');
			if (input) input.focus();
		}, 100);
	},

	async confirmSetFilePrice() {
		const ukey = this._currentSetPriceUkey;
		if (!ukey) return;

		const priceInput = document.getElementById('vx-points-price-input');
		const price = priceInput ? parseInt(priceInput.value, 10) : 0;

		if (!price || price < 1 || price > 10000) {
			VXUI.toastWarning(this.t('vx_price_invalid', '售价必须在 1 到 10000 之间'));
			return;
		}

		const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
		if (!token) {
			VXUI.toastWarning(this.t('vx_need_login', '请先登录'));
			return;
		}

		const apiUrl = (typeof TL !== 'undefined' && TL.api_file) ? TL.api_file : '/api_v2/file';

		try {
			const rsp = await new Promise((resolve, reject) => {
				$.post(apiUrl, {
					action: 'file_price_set',
					ukey,
					token,
					price
				}, resolve, 'json').fail(reject);
			});

			if (rsp && rsp.status === 1) {
				VXUI.toastSuccess(this.t('vx_price_set_success', '售价设定成功'));
				this.closeModal();
				this.loadSellingFiles(this._sellingPage || 0);
			} else {
				const msg = (rsp && rsp.data && rsp.data.message) || this.t('vx_update_failed', '修改失败');
				VXUI.toastError(msg);
			}
		} catch (e) {
			console.error('[VX_POINTS] confirmSetFilePrice error:', e);
			VXUI.toastError(this.t('error_network', '网络错误'));
		}
	},

	async confirmRemoveFilePrice(ukey) {
		const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
		if (!token) {
			VXUI.toastWarning(this.t('vx_need_login', '请先登录'));
			return;
		}

		const confirmed = await new Promise(resolve => {
			if (typeof VXUI !== 'undefined' && typeof VXUI.confirm === 'function') {
				VXUI.confirm({
					title: this.t('vx_title_confirm', '确认'),
					message: this.t('vx_remove_price_confirm', '确定要取消此文件的售价吗？这将使文件恢复免费下载。'),
					confirmText: this.t('btn_confirm', '确认'),
					confirmClass: 'vx-btn-danger',
					onConfirm: () => resolve(true),
					onCancel: () => resolve(false)
				});
			} else {
				resolve(window.confirm(this.t('vx_remove_price_confirm', '确定要取消此文件的售价吗？这将使文件恢复免费下载。')));
			}
		});

		if (!confirmed) return;

		const apiUrl = (typeof TL !== 'undefined' && TL.api_file) ? TL.api_file : '/api_v2/file';

		try {
			const rsp = await new Promise((resolve, reject) => {
				$.post(apiUrl, {
					action: 'file_price_remove',
					ukey,
					token
				}, resolve, 'json').fail(reject);
			});

			if (rsp && rsp.status === 1) {
				VXUI.toastSuccess(this.t('vx_price_removed', '已取消售价'));
				this.loadSellingFiles(this._sellingPage || 0);
			} else {
				const msg = (rsp && rsp.data && rsp.data.message) || this.t('vx_update_failed', '操作失败');
				VXUI.toastError(msg);
			}
		} catch (e) {
			console.error('[VX_POINTS] confirmRemoveFilePrice error:', e);
			VXUI.toastError(this.t('error_network', '网络错误'));
		}
	},

	formatDateOnly(value) {
		if (!value) return '';
		const str = String(value);
		if (str.length >= 10 && str.includes('-')) return str.slice(0, 10);
		const d = new Date(str);
		if (Number.isNaN(d.getTime())) return str;
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	},

	formatTime(value) {
		if (!value) return '';
		const str = String(value);
		if (str.includes(':')) return str;
		const d = new Date(str);
		if (Number.isNaN(d.getTime())) return str;
		return d.toLocaleString();
	},

	formatSize(bytes) {
		let size = Number(bytes || 0);
		if (!size) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		let index = 0;
		while (size >= 1024 && index < units.length - 1) {
			size /= 1024;
			index += 1;
		}
		return `${size.toFixed(index > 0 ? 1 : 0)} ${units[index]}`;
	},

	getFileIcon(ftype) {
		const type = String(ftype || '').toLowerCase().replace('.', '').trim();

		// Delegate to VX_FILELIST if available
		if (typeof VX_FILELIST !== 'undefined' && typeof VX_FILELIST.getFileIcon === 'function') {
			return VX_FILELIST.getFileIcon(type);
		}

		// Try TL.fileicon first
		let icon = null;
		if (typeof TL !== 'undefined' && typeof TL.fileicon === 'function') {
			icon = TL.fileicon(type);
		}

		// Fallback mapping
		if (!icon) {
			const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
			const videoTypes = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'];
			const audioTypes = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
			const docTypes = ['doc', 'docx', 'pdf', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];
			const archiveTypes = ['zip', 'rar', '7z', 'tar', 'gz'];
			const codeTypes = ['js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'css', 'html', 'json'];

			if (imageTypes.includes(type)) icon = 'file-image';
			else if (videoTypes.includes(type)) icon = 'file-video';
			else if (audioTypes.includes(type)) icon = 'file-music';
			else if (docTypes.includes(type)) icon = 'file-word';
			else if (archiveTypes.includes(type)) icon = 'file-zipper';
			else if (codeTypes.includes(type)) icon = 'file-code';
			else icon = 'file-lines';
		}

		let cls = 'vx-icon-file';
		if (icon === 'file-image') cls = 'vx-icon-image';
		else if (icon === 'file-video') cls = 'vx-icon-video';
		else if (icon === 'file-music') cls = 'vx-icon-audio';
		else if (icon === 'file-zipper') cls = 'vx-icon-archive';
		else if (icon === 'file-code') cls = 'vx-icon-code';
		else if (['file-word', 'file-excel', 'file-powerpoint', 'file-pdf'].includes(icon)) cls = 'vx-icon-document';

		return { icon, class: cls };
	},

	async loadPointLog(page = 0) {
		const container = document.getElementById('vx-point-log-list');
		if (!container) return;

		const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
		if (!token) {
			container.innerHTML = `<div class="vx-orders-empty">${this.t('vx_need_login', '请先登录')}</div>`;
			return;
		}

		container.innerHTML = `
			<div class="vx-orders-loading">
				<div class="vx-spinner"></div>
				<span>${this.t('vx_loading', '加载中...')}</span>
			</div>
		`;

		try {
			const apiUrl = (typeof TL !== 'undefined' && TL.api_pay) ? TL.api_pay : '/api_v2/pay';
			const response = await fetch(apiUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: `action=point_log&token=${encodeURIComponent(token)}&page=${page}`
			});
			const rsp = await response.json();

			if (rsp.status === 101 || !rsp.data || !Array.isArray(rsp.data)) {
				container.innerHTML = `
					<div class="vx-orders-empty">
						<iconpark-icon name="folder-open" style="font-size:48px;color:var(--vx-text-muted);"></iconpark-icon>
						<p>${this.t('vx_no_point_log', '暂无点数变动记录')}</p>
					</div>
				`;
				return;
			}

			const actionLabels = {
				charge: this.t('vx_point_charge', '充値'),
				buy: this.t('vx_point_buy', '购买商品'),
				transfer_out: this.t('vx_point_transfer_out', '转出'),
				transfer_in: this.t('vx_point_transfer_in', '转入'),
				file_purchase: this.t('vx_point_file_purchase', '购买文件'),
				file_sale: this.t('vx_point_file_sale', '文件售出收入')
			};

			let html = '';
			for (const record of rsp.data) {
				const changeValue = Number(record.change || 0);
				const isIncome = changeValue >= 0;
				const changeClass = isIncome ? 'vx-point-income' : 'vx-point-expense';
				const changeText = isIncome ? `+${this.formatPoints(changeValue)}` : this.formatPoints(changeValue);
				const iconClass = isIncome ? 'vx-point-log-icon-income' : 'vx-point-log-icon-expense';
				const actionLabel = actionLabels[record.action] || record.action;
				html += `
					<div class="vx-point-log-item">
						<div class="vx-point-log-icon ${iconClass}">
							<iconpark-icon name="${isIncome ? 'income-one' : 'expenses-one'}"></iconpark-icon>
						</div>
						<div class="vx-point-log-info">
							<div class="vx-point-log-action">${this.escapeHtml(actionLabel)}</div>
							<div class="vx-point-log-content" title="${this.escapeHtml(record.content || '')}">
								${this.escapeHtml(record.content || '')}
							</div>
							<div class="vx-point-log-time">${record.ctime || ''}</div>
						</div>
						<div class="vx-point-log-amount">
							<span class="${changeClass}">${changeText}</span>
							<div class="vx-point-log-balance">${this.t('vx_point_after', '余额')}: ${this.formatPoints(record.now)}</div>
						</div>
					</div>
				`;
			}

			const paginationHtml = `
				<div class="vx-point-pagination">
					${page > 0 ? `<button class="vx-btn vx-btn-secondary" onclick="VX_POINTS.loadPointLog(${page - 1})">${this.t('vx_prev_page', '上一页')}</button>` : ''}
					<span>${this.t('vx_page', '第')} ${page + 1} ${this.t('vx_page_suffix', '页')}</span>
					${rsp.data.length >= 20 ? `<button class="vx-btn vx-btn-secondary" onclick="VX_POINTS.loadPointLog(${page + 1})">${this.t('vx_next_page', '下一页')}</button>` : ''}
				</div>
			`;

			container.innerHTML = html + paginationHtml;
		} catch (e) {
			console.error('[VX_POINTS] loadPointLog error:', e);
			container.innerHTML = `
				<div class="vx-orders-empty">
					<iconpark-icon name="circle-exclamation" style="font-size:48px;color:var(--vx-danger);"></iconpark-icon>
					<p>${this.t('vx_load_failed', '加载失败')}</p>
				</div>
			`;
		}
	},

	showModal() {
		const modal = document.getElementById('vx-points-modal');
		if (!modal) return;
		modal.classList.add('vx-modal-open');
		document.body.classList.add('vx-modal-body-open');
	},

	closeModal() {
		const modal = document.getElementById('vx-points-modal');
		if (!modal) return;
		modal.classList.remove('vx-modal-open');
		document.body.classList.remove('vx-modal-body-open');
		this.restoreModalFooter();
	},

	restoreModalFooter() {
		if (this._originalFooter) {
			const modalFooter = document.getElementById('vx-points-modal-footer');
			if (modalFooter) {
				modalFooter.innerHTML = this._originalFooter;
			}
			this._originalFooter = null;
		}
	},

	openPointTransfer() {
		this.trackUI('vui_points[point_transfer]');
		const modalTitle = document.getElementById('vx-points-modal-title');
		const modalBody = document.getElementById('vx-points-modal-body');
		const modalFooter = document.getElementById('vx-points-modal-footer');
		if (!modalTitle || !modalBody || !modalFooter) return;

		modalTitle.innerHTML = `<iconpark-icon name="expenses"></iconpark-icon> ${this.t('vx_point_transfer_title', '点数转账')}`;
		modalBody.innerHTML = `
			<p class="vx-modal-desc">${this.t('vx_transfer_desc', '将您账户内的点数转给其他用户。无手续费，收入方全额到账。最少 100 点。')}</p>
			<div class="vx-form-group" style="margin-bottom:16px;">
				<label style="font-size:14px;font-weight:500;color:var(--vx-text);display:block;margin-bottom:6px;">
					${this.t('vx_to_uid', '收款用户 UID')}
				</label>
				<input type="number" id="vx-transfer-uid" class="vx-input" min="1" placeholder="${this.t('vx_enter_uid', '请输入对方 UID')}" style="width:100%;">
			</div>
			<div class="vx-form-group">
				<label style="font-size:14px;font-weight:500;color:var(--vx-text);display:block;margin-bottom:6px;">
					${this.t('vx_transfer_amount', '转账点数')}
				</label>
				<input type="number" id="vx-transfer-amount" class="vx-input" min="100" placeholder="${this.t('vx_min_100_points', '最少 100 点')}" style="width:100%;">
			</div>
		`;

		this._originalFooter = modalFooter.innerHTML;
		modalFooter.innerHTML = `
			<div></div>
			<div class="vx-modal-actions">
				<button class="vx-btn vx-btn-secondary" onclick="VX_POINTS.closeModal()">${this.t('btn_cancel', '取消')}</button>
				<button class="vx-btn vx-btn-primary" id="vx-transfer-submit-btn" onclick="VX_POINTS.submitPointTransfer()">${this.t('vx_transfer_submit', '确认转账')}</button>
			</div>
		`;

		this.showModal();
		setTimeout(() => {
			const el = document.getElementById('vx-transfer-uid');
			if (el) el.focus();
		}, 100);
	},

	async submitPointTransfer() {
		const toUid = parseInt(document.getElementById('vx-transfer-uid')?.value || '0', 10);
		const amount = parseInt(document.getElementById('vx-transfer-amount')?.value || '0', 10);

		if (!toUid || toUid <= 0) {
			VXUI.toastWarning(this.t('vx_enter_valid_uid', '请输入有效的 UID'));
			return;
		}
		if (!amount || amount < 100) {
			VXUI.toastWarning(this.t('vx_min_transfer', '转账最少 100 点'));
			return;
		}

		const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
		if (!token) {
			VXUI.toastWarning(this.t('vx_need_login', '请先登录'));
			return;
		}

		const btn = document.getElementById('vx-transfer-submit-btn');
		if (btn) btn.disabled = true;

		try {
			const apiUrl = (typeof TL !== 'undefined' && TL.api_pay) ? TL.api_pay : '/api_v2/pay';
			const response = await fetch(apiUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					action: 'point_transfer',
					token,
					to_uid: toUid,
					amount
				}).toString()
			});
			const result = await response.json();

			if (result.status === 1) {
				VXUI.toastSuccess(this.t('vx_transfer_success', '转账成功'));
				this.closeModal();
				// Update local point balance
				if (typeof TL !== 'undefined' && typeof TL.user_point !== 'undefined') {
					TL.user_point = Math.max(0, (parseInt(TL.user_point, 10) || 0) - amount);
				}
				this.loadPointLog(0);
				this.fetchBalance();
			} else {
				const msg = (result.data && result.data.message) || this.t('vx_transfer_failed', '转账失败');
				VXUI.toastError(msg);
				if (btn) btn.disabled = false;
			}
		} catch (e) {
			console.error('[VX_POINTS] submitPointTransfer error:', e);
			VXUI.toastError(this.t('error_network', '网络错误'));
			if (btn) btn.disabled = false;
		}
	},

	openPointRecharge() {
		this.trackUI('vui_points[point_recharge]');
		const isCN = this.isCN();
		const rate = isCN ? 100 : 600;
		const minAmount = isCN ? 1 : 10;
		const maxAmount = 500;
		const currency = isCN ? '¥' : '$';

		const modalTitle = document.getElementById('vx-points-modal-title');
		const modalBody = document.getElementById('vx-points-modal-body');
		const modalFooter = document.getElementById('vx-points-modal-footer');
		if (!modalTitle || !modalBody || !modalFooter) return;

		modalTitle.innerHTML = `<iconpark-icon name="paper-money-two"></iconpark-icon> ${this.t('vx_recharge_title', '点数充值')}`;

		const presets = isCN ? [10, 30, 60, 100] : [10, 20, 50, 100];
		const presetsHtml = presets.map(p => `
			<div class="vx-recharge-preset" onclick="VX_POINTS._selectRechargePreset(${p})">
				${currency}${p}
				<span class="vx-recharge-preset-points">= ${p * rate} ${this.t('vx_points', '点数')}</span>
			</div>
		`).join('');

		modalBody.innerHTML = `
			<p class="vx-modal-desc">${this.t('vx_recharge_rate', isCN ? '1 元 = 100 点。' : '1 USD = 600 点。')}</p>
			<div class="vx-recharge-presets">${presetsHtml}</div>
			<div class="vx-recharge-custom">
				<label class="vx-recharge-custom-label">${this.t('vx_custom_amount', '自定义金额')}</label>
				<div class="vx-recharge-input-row">
					<span class="vx-recharge-currency">${currency}</span>
					<input type="number" id="vx-recharge-amount" class="vx-input" min="${minAmount}" max="${maxAmount}" step="1" value="${presets[0]}" placeholder="${currency}${minAmount} - ${currency}${maxAmount}" style="flex:1;" oninput="VX_POINTS._updateRechargePreview()">
				</div>
				<div id="vx-recharge-preview" class="vx-recharge-preview">= ${presets[0] * rate} ${this.t('vx_points', '点数')}</div>
			</div>
		`;

		this._rechargeIsCN = isCN;
		this._rechargeRate = rate;
		this._rechargeMinAmount = minAmount;
		this._rechargeMaxAmount = maxAmount;

		this._originalFooter = modalFooter.innerHTML;
		modalFooter.innerHTML = `
			<div></div>
			<div class="vx-modal-actions">
				<button class="vx-btn vx-btn-secondary" onclick="VX_POINTS.closeModal()">${this.t('btn_cancel', '取消')}</button>
				<button class="vx-btn vx-btn-primary" onclick="VX_POINTS.submitRecharge()">
					<iconpark-icon name="paper-money-two"></iconpark-icon>
					${this.t('btn_recharge_now', '立即充值')}
				</button>
			</div>
		`;

		this.showModal();
	},

	_selectRechargePreset(amount) {
		const input = document.getElementById('vx-recharge-amount');
		if (input) {
			input.value = amount;
			this._updateRechargePreview();
		}
		document.querySelectorAll('.vx-recharge-preset').forEach(el => {
			el.classList.toggle('vx-recharge-preset-active',
				parseInt(el.textContent, 10) === amount || el.textContent.trim().startsWith(
					(this._rechargeIsCN ? '¥' : '$') + amount
				));
		});
	},

	_updateRechargePreview() {
		const input = document.getElementById('vx-recharge-amount');
		const preview = document.getElementById('vx-recharge-preview');
		if (!input || !preview) return;
		const val = parseFloat(input.value) || 0;
		const points = Math.floor(val * (this._rechargeRate || 100));
		const currency = this._rechargeIsCN ? '¥' : '$';
		const min = this._rechargeMinAmount || 1;
		const max = this._rechargeMaxAmount || 500;
		if (val < min) {
			preview.textContent = this.t('vx_amount_too_low', `最少 ${currency}${min}`);
			preview.style.color = 'var(--vx-danger)';
		} else if (val > max) {
			preview.textContent = this.t('vx_amount_too_high', `单次最多 ${currency}${max}`);
			preview.style.color = 'var(--vx-danger)';
		} else {
			preview.textContent = `= ${points} ${this.t('vx_points', '点数')}`;
			preview.style.color = 'var(--vx-primary)';
		}
	},

	submitRecharge() {
		const token = (typeof TL !== 'undefined' && TL.api_token) ? TL.api_token : '';
		const input = document.getElementById('vx-recharge-amount');
		if (!input) return;
		const amount = parseFloat(input.value) || 0;
		const min = this._rechargeMinAmount || 1;
		const max = this._rechargeMaxAmount || 500;
		const currency = this._rechargeIsCN ? '¥' : '$';
		if (amount < min) {
			VXUI.toastWarning(this.t('vx_amount_too_low', `最少充值 ${currency}${min}`));
			input.focus();
			return;
		}
		if (amount > max) {
			VXUI.toastWarning(this.t('vx_amount_too_high', `单次最多充值 ${currency}${max}`));
			input.focus();
			return;
		}
		const payUrl = this._rechargeIsCN
			? `https://pay.vezii.com/id4/pay_v2?price=${amount}&token=${token}&prepare_type=POINT&prepare_code=POINT_CUSTOM`
			: `https://s12.tmp.link/payment/paypal/checkout_v2?price=${amount}&token=${token}&prepare_type=POINT&prepare_code=POINT_CUSTOM`;
		window.open(payUrl, '_blank');
	},

	escapeHtml(str) {
		if (!str) return '';
		const div = document.createElement('div');
		div.textContent = String(str);
		return div.innerHTML;
	}
};

VXUI.registerModule('points', {
	template: '/tpl/vxui/points.html',
	init: (params) => VX_POINTS.init(params)
});
