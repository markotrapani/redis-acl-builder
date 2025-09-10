/**
 * Application State Management
 * Centralized state for the Redis ACL Builder application
 */

const AppState = {
    currentVersion: 'redis7',
    isLoading: false,
    debounceTimer: null
};

export default AppState;