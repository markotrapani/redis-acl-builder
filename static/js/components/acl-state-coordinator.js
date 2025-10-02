/**
 * ACL State Coordinator
 * Main coordinator that ties all ACL builder modules together
 */

import ACLOptimizer from './acl-optimizer.js';
import ACLRuleParser from './acl-rule-parser.js';
import ACLCategoryManager from './acl-category-manager.js';
import ACLUIRenderer from './acl-ui-renderer.js';

const ACLStateCoordinator = {
    // Will be the main entry point, replacing interactive-acl-builder.js
    // Methods: init, loadAllData, initializeDefaultState, finalizeStateChange,
    // getCommandsGrantedByCategories, getCommandsGrantedByInclusions,
    // getCommandsBlockedByCategories, categoryOverlapsWithGranted,
    // setupEventListeners, safeAsyncOperation, executeEventHandler,
    // executeMultipleEventHandlers

    // References to specialized modules
    optimizer: ACLOptimizer,
    parser: ACLRuleParser,
    categoryManager: ACLCategoryManager,
    uiRenderer: ACLUIRenderer
};

export default ACLStateCoordinator;
