/**
 * Application State Management
 * Centralized state for the Redis ACL Builder application
 */

/**
 * Get initial state from URL parameters, localStorage, or defaults
 * Priority: URL params > localStorage > defaults
 */
function getInitialState() {
    const urlParams = new URLSearchParams(window.location.search);

    // Get version (default: redis8)
    let version = urlParams.get('version') ||
                  localStorage.getItem('redis-acl-builder-version') ||
                  'redis8';

    // Validate version
    if (!['redis7', 'redis8'].includes(version)) {
        console.warn(`Invalid version from URL/storage: ${version}, defaulting to redis8`);
        version = 'redis8';
    }

    // Get mode (default: oss)
    let mode = urlParams.get('mode') ||
               localStorage.getItem('redis-acl-builder-mode') ||
               'oss';

    // Validate mode
    if (!['oss', 'enterprise'].includes(mode)) {
        console.warn(`Invalid mode from URL/storage: ${mode}, defaulting to oss`);
        mode = 'oss';
    }

    // Save to localStorage for next visit (URL params take precedence)
    if (urlParams.has('version')) {
        localStorage.setItem('redis-acl-builder-version', version);
    }
    if (urlParams.has('mode')) {
        localStorage.setItem('redis-acl-builder-mode', mode);
    }

    return {
        currentVersion: version,
        currentMode: mode,
        isLoading: false,
        debounceTimer: null
    };
}

const AppState = getInitialState();

/**
 * Update application state and persist to localStorage
 * @param {Object} updates - State updates to apply
 */
AppState.update = function(updates) {
    Object.assign(this, updates);

    // Persist version and mode to localStorage
    if (updates.currentVersion) {
        localStorage.setItem('redis-acl-builder-version', updates.currentVersion);
    }
    if (updates.currentMode) {
        localStorage.setItem('redis-acl-builder-mode', updates.currentMode);
    }
};

/**
 * Update URL parameters without reloading the page
 * @param {string} version - Redis version
 * @param {string} mode - Redis mode (oss/enterprise)
 */
AppState.updateURL = function(version, mode) {
    const url = new URL(window.location);
    url.searchParams.set('version', version);
    url.searchParams.set('mode', mode);
    window.history.replaceState({}, '', url);
};

/**
 * Get current state for API requests
 */
AppState.getAPIState = function() {
    return {
        version: this.currentVersion,
        mode: this.currentMode
    };
};

export default AppState;