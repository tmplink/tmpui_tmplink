/**
 * VXUI Sort Module
 * 通用排序逻辑管理器
 * 用于 FileList 和 Direct 等模块
 */
class VxSort {
    /**
     * @param {Object} options
     * @param {string} options.key - storage key prefix (e.g. 'vx_room_')
     * @param {function} options.onSortChange - callback(by, type)
     * @param {string} options.iconPrefix - icon element id prefix (default: 'vx-sort-icon-')
     */
    constructor(options = {}) {
        this.key = options.key || 'vx_sort_';
        this.onSortChange = options.onSortChange || function() {};
        this.iconPrefix = options.iconPrefix || 'vx-sort-icon-';

        this.currentBy = 0;
        this.currentType = 0;
        this.id = 'default';
        this.isInit = false;
    }

    /**
     * Load sort for a specific ID (e.g. folder ID)
     * @param {string|number} id - Unique identifier for the context (e.g. mrid)
     * @param {number} defaultBy 
     * @param {number} defaultType 
     */
    load(id, defaultBy = 0, defaultType = 0) {
        this.id = id;
        this.isInit = true;

        const savedBy = localStorage.getItem(`${this.key}sort_by_${id}`);
        const savedType = localStorage.getItem(`${this.key}sort_type_${id}`);

        if (savedBy !== null) {
            this.currentBy = parseInt(savedBy);
        } else {
            this.currentBy = defaultBy;
        }

        if (savedType !== null) {
            this.currentType = parseInt(savedType);
        } else {
            this.currentType = defaultType;
        }
    }

    /**
     * Returns current state
     */
    get() {
        return {
            by: this.currentBy,
            type: this.currentType
        };
    }

    /**
     * Set sort manually (e.g. when user clicks header)
     * @param {number} column 
     * @param {boolean} triggerCallback 
     */
    set(column, triggerCallback = true) {
        if (!this.isInit) return;

        if (this.currentBy === column) {
            this.currentType = this.currentType === 0 ? 1 : 0;
        } else {
            this.currentBy = column;
            // Default rules:
            // 1 (Name): Asc (1)
            // 0 (Time), 2 (Size): Desc (0)
            if (column === 1) {
                this.currentType = 1; 
            } else {
                this.currentType = 0;
            }
        }

        this.save();
        this.updateIcons();

        if (triggerCallback) {
            this.onSortChange(this.currentBy, this.currentType);
        }
    }

    setRaw(by, type) {
        this.currentBy = by;
        this.currentType = type;
        this.save();
        this.updateIcons();
    }

    save() {
        if (!this.isInit) return;
        localStorage.setItem(`${this.key}sort_by_${this.id}`, this.currentBy);
        localStorage.setItem(`${this.key}sort_type_${this.id}`, this.currentType);
    }
    
    /**
     * Update UI icons based on current state
     * Assumes icons have IDs: {iconPrefix}{column}
     * Examples: vx-sort-icon-0, vx-sort-icon-1
     */
    updateIcons() {
        // Supported columns: 0 (Time), 1 (Name), 2 (Size), 3 (Type - optional)
        const columns = [0, 1, 2, 3];
        
        columns.forEach(col => {
            const el = document.getElementById(`${this.iconPrefix}${col}`);
            if (el) {
                if (col === this.currentBy) {
                    el.classList.add('active');
                    if (this.currentType === 1) {
                        el.setAttribute('name', 'sort-amount-up');
                    } else {
                        el.setAttribute('name', 'sort-amount-down');
                    }
                } else {
                    el.classList.remove('active');
                    el.setAttribute('name', 'sort-amount-down');
                }
            }
        });
    }

    /**
     * Helper to sort array of objects in memory
     * @param {Array} list 
     * @param {Object} getters - { 0: item => val, 1: item => val }
     */
    sortArray(list, getters = {}) {
        if (!list || list.length <= 1) return list;

        const by = this.currentBy;
        const type = this.currentType;

        return list.sort((a, b) => {
            let valA, valB;

            if (getters[by]) {
                valA = getters[by](a);
                valB = getters[by](b);
            } else {
                // Default fallbacks if getters not provided
                if (by === 0) { // Time
                     valA = parseInt(a.ctime || a.time || 0);
                     valB = parseInt(b.ctime || b.time || 0);
                } else if (by === 1) { // Name
                     valA = (a.name || a.fname || '').toLowerCase();
                     valB = (b.name || b.fname || '').toLowerCase();
                } else if (by === 2) { // Size
                     // Size might be undefined for folders
                     valA = parseInt(a.size || a.fsize || a.file_count || 0);
                     valB = parseInt(b.size || b.fsize || b.file_count || 0);
                } else {
                    return 0;
                }
            }

            if (valA < valB) return type === 0 ? 1 : -1;
            if (valA > valB) return type === 0 ? -1 : 1;
            return 0;
        });
    }

    /**
     * Clear all storage for this key prefix
     */
    clearAll() {
         const toRemove = [];
         for (let i = 0; i < localStorage.length; i++) {
             const k = localStorage.key(i);
             if (k && (k.startsWith(`${this.key}sort_by_`) || k.startsWith(`${this.key}sort_type_`))) {
                 toRemove.push(k);
             }
         }
         toRemove.forEach(k => localStorage.removeItem(k));
    }
}

// Export global
window.VxSort = VxSort;
