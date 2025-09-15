/**
 * Search Manager - Handles filtering of categories and commands
 * Provides real-time search functionality for command/category buttons
 */

import Utils from '../core/utils.js';

const SearchManager = {
    // State for search matching modes (independent for each search bar)
    searchModes: {
        blocked: false,  // Default to fuzzy matching for blocked search
        granted: false   // Default to fuzzy matching for granted search
    },

    /**
     * Initialize search functionality
     */
    init() {
        this.setupSearchHandlers();
        this.setupToggleButtons();
    },

    /**
     * Setup event handlers for all search inputs
     */
    setupSearchHandlers() {
        // Blocked search (categories and commands combined)
        const blockedSearch = document.getElementById('blockedSearch');
        if (blockedSearch) {
            blockedSearch.addEventListener('input',
                Utils.debounce((e) => this.filterAll('blocked', e.target.value), 150)
            );
            blockedSearch.addEventListener('keydown', (e) => this.handleKeydown(e, 'blockedSearch'));
        }

        // Granted search (categories and commands combined)
        const grantedSearch = document.getElementById('grantedSearch');
        if (grantedSearch) {
            grantedSearch.addEventListener('input',
                Utils.debounce((e) => this.filterAll('granted', e.target.value), 150)
            );
            grantedSearch.addEventListener('keydown', (e) => this.handleKeydown(e, 'grantedSearch'));
        }
    },

    /**
     * Setup toggle buttons for search mode switching
     */
    setupToggleButtons() {
        // Create toggle buttons for both search bars
        this.createToggleButton('blockedSearch');
        this.createToggleButton('grantedSearch');
    },

    /**
     * Create a toggle button next to a search input
     */
    createToggleButton(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;

        const container = input.parentElement;
        if (!container) return;

        // Determine which search type this is (blocked or granted)
        const searchType = inputId.includes('blocked') ? 'blocked' : 'granted';

        // Create toggle button
        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.className = 'search-mode-toggle';
        toggleButton.setAttribute('aria-label', 'Toggle between fuzzy and exact search');
        toggleButton.setAttribute('data-search-type', searchType);

        // Set initial text and appearance based on current mode for this search type
        this.updateToggleButtonAppearance(toggleButton, searchType);

        // Add click handler specific to this search type
        toggleButton.addEventListener('click', () => {
            this.toggleSearchMode(searchType);
            this.updateToggleButtonAppearance(toggleButton, searchType);
            this.refreshSearch(searchType);
        });

        // Insert button before the input (left side)
        container.insertBefore(toggleButton, input);
    },

    /**
     * Update toggle button appearance based on current mode for specific search type
     */
    updateToggleButtonAppearance(button, searchType) {
        const isExactMode = this.searchModes[searchType];

        if (isExactMode) {
            button.textContent = '=';
            button.title = 'Exact search mode - Click to switch to fuzzy search';
            button.classList.add('exact-mode');
            button.classList.remove('fuzzy-mode');
        } else {
            button.textContent = '≈';
            button.title = 'Fuzzy search mode - Click to switch to exact search';
            button.classList.add('fuzzy-mode');
            button.classList.remove('exact-mode');
        }
    },

    /**
     * Toggle between search modes for a specific search type
     */
    toggleSearchMode(searchType) {
        this.searchModes[searchType] = !this.searchModes[searchType];
    },

    /**
     * Refresh search for a specific search type
     */
    refreshSearch(searchType) {
        const inputId = searchType === 'blocked' ? 'blockedSearch' : 'grantedSearch';
        const searchInput = document.getElementById(inputId);

        if (searchInput) {
            // Always apply filtering, even with empty search (to reset display)
            this.filterAll(searchType, searchInput.value);
        }
    },

    /**
     * Refresh all active searches with new mode
     */
    refreshAllSearches() {
        this.refreshSearch('blocked');
        this.refreshSearch('granted');
    },

    /**
     * Handle keyboard shortcuts for search inputs
     */
    handleKeydown(event, inputId) {
        if (event.key === 'Escape') {
            this.clearSearch(inputId);
            event.target.blur();
        }
    },

    /**
     * Filter both categories and commands based on search term
     */
    filterAll(type, searchTerm) {
        this.filterCategories(type, searchTerm);
        this.filterCommands(type, searchTerm);
    },

    /**
     * Filter category buttons based on search term
     */
    filterCategories(type, searchTerm) {
        const containerId = type === 'blocked' ? 'blockedCategories' : 'grantedCategories';
        const container = document.getElementById(containerId);

        if (!container) return;

        const categoryButtons = container.querySelectorAll('.category-button');
        const searchTermLower = searchTerm.toLowerCase().trim();

        let visibleCount = 0;

        categoryButtons.forEach(button => {
            const categoryName = button.textContent.toLowerCase().trim();
            const matches = !searchTermLower || this.performSearch(categoryName, searchTermLower, type);

            button.style.display = matches ? '' : 'none';
            if (matches) visibleCount++;
        });

        // Update results count (optional enhancement)
        this.updateResultsCount(containerId, visibleCount, categoryButtons.length, 'categories');
    },

    /**
     * Filter command buttons based on search term
     */
    filterCommands(type, searchTerm) {
        const containerId = type === 'blocked' ? 'blockedCommands' : 'grantedCommands';
        const container = document.getElementById(containerId);

        if (!container) return;

        const commandButtons = container.querySelectorAll('.command-button');
        const searchTermLower = searchTerm.toLowerCase().trim();

        let visibleCount = 0;

        commandButtons.forEach(button => {
            const commandName = button.textContent.toLowerCase().trim();
            const matches = !searchTermLower || this.performSearch(commandName, searchTermLower, type);

            button.style.display = matches ? '' : 'none';
            if (matches) visibleCount++;
        });

        // Update results count (optional enhancement)
        this.updateResultsCount(containerId, visibleCount, commandButtons.length, 'commands');
    },


    /**
     * Update results count display (optional enhancement)
     */
    updateResultsCount(containerId, visibleCount, totalCount, type) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Remove existing count
        const existingCount = container.querySelector('.search-results-count');
        if (existingCount) {
            existingCount.remove();
        }

        // Add new count if filtered
        if (visibleCount !== totalCount && totalCount > 0) {
            const countElement = document.createElement('div');
            countElement.className = 'search-results-count';
            countElement.textContent = `Showing ${visibleCount} of ${totalCount} ${type}`;

            const buttonsContainer = container.querySelector('.category-buttons, .command-buttons');
            if (buttonsContainer) {
                buttonsContainer.parentNode.insertBefore(countElement, buttonsContainer.nextSibling);
            }
        }
    },

    /**
     * Clear search input and reset filters
     */
    clearSearch(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;

        input.value = '';
        input.focus();

        // Trigger filter to reset display
        const event = new Event('input', { bubbles: true });
        input.dispatchEvent(event);
    },

    /**
     * Clear all search filters
     */
    clearAllSearches() {
        const searchInputs = [
            'blockedSearch',
            'grantedSearch'
        ];

        searchInputs.forEach(inputId => {
            this.clearSearch(inputId);
        });
    },

    /**
     * Perform search based on current mode for specific search type
     */
    performSearch(target, searchTerm, searchType) {
        const isExactMode = this.searchModes[searchType];

        if (isExactMode) {
            return this.exactMatch(target, searchTerm);
        } else {
            return this.fuzzyMatch(target, searchTerm);
        }
    },

    /**
     * Exact matching - only substring matching
     */
    exactMatch(target, searchTerm) {
        return target.includes(searchTerm);
    },

    /**
     * Fuzzy matching algorithm for search functionality
     * Supports:
     * - Exact substring matching
     * - Partial character matching (characters in order)
     * - Abbreviation matching (first letters of words)
     */
    fuzzyMatch(target, searchTerm) {
        // Always include exact substring matches
        if (target.includes(searchTerm)) {
            return true;
        }

        // Handle abbreviation matching - match first letters of words
        const targetWords = target.split(/[_\-\s]/).filter(word => word.length > 0);
        const abbreviation = targetWords.map(word => word[0]).join('').toLowerCase();

        if (abbreviation.includes(searchTerm)) {
            return true;
        }

        // Character sequence matching - all characters must appear in order
        let searchIndex = 0;
        let targetIndex = 0;

        while (searchIndex < searchTerm.length && targetIndex < target.length) {
            if (searchTerm[searchIndex] === target[targetIndex]) {
                searchIndex++;
            }
            targetIndex++;
        }

        // Match if we found all search characters in sequence
        return searchIndex === searchTerm.length;
    }
};

// Global function for HTML onclick handlers
window.clearSearch = (inputId) => SearchManager.clearSearch(inputId);

export default SearchManager;