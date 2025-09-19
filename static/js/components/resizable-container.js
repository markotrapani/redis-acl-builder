/**
 * Resizable Container Manager
 * Handles container-level resizing with corner drag handles
 */

// Helper function to apply positioning styles consistently
const applyPositioningStyles = (element, left, top, options = {}) => {
    if (!element || !left || !top) return false;

    const {
        transition = 'none',
        includeTransform = false,
        setOpacity = false,
        useImportant = true,
        includeMargin = true
    } = options;

    if (useImportant) {
        element.style.setProperty('transition', transition, 'important');
        element.style.setProperty('position', 'fixed', 'important');
        element.style.setProperty('left', left, 'important');
        element.style.setProperty('top', top, 'important');
        if (includeMargin) {
            element.style.setProperty('margin', '0', 'important');
        }
        if (includeTransform) {
            element.style.setProperty('transform', 'none', 'important');
        }
    } else {
        element.style.position = 'fixed';
        element.style.left = left;
        element.style.top = top;
        if (includeMargin) {
            element.style.margin = '0';
        }
        if (includeTransform) {
            element.style.transform = 'none';
        }
    }

    if (setOpacity) {
        document.documentElement.style.setProperty('--container-opacity', '1');
    }

    return true;
};

// ULTRA-IMMEDIATE position fix - run as soon as possible
const applyImmediatePositioning = () => {
    const pageBackdrop = document.querySelector('.page-backdrop');
    if (pageBackdrop) {
        const cssLeft = getComputedStyle(document.documentElement).getPropertyValue('--saved-container-left').trim();
        const cssTop = getComputedStyle(document.documentElement).getPropertyValue('--saved-container-top').trim();

        if (cssLeft && cssTop) {
            return applyPositioningStyles(pageBackdrop, cssLeft, cssTop, { setOpacity: true });
        }
    }
    return false;
};

// Try to apply immediately when module loads
if (document.readyState === 'loading') {
    // If document is still loading, try every 10ms until element exists
    const immediateInterval = setInterval(() => {
        if (applyImmediatePositioning()) {
            clearInterval(immediateInterval);
        }
    }, 10);

    // Stop trying after 1 second
    setTimeout(() => clearInterval(immediateInterval), 1000);
} else {
    // Document already loaded, try immediately
    applyImmediatePositioning();
}

// IMMEDIATE position fix - run as soon as this module loads
document.addEventListener('DOMContentLoaded', () => {
    const pageBackdrop = document.querySelector('.page-backdrop');
    if (pageBackdrop) {
        const rect = pageBackdrop.getBoundingClientRect();

        // Check if inline script set custom properties
        const cssLeft = getComputedStyle(document.documentElement).getPropertyValue('--saved-container-left').trim();
        const cssTop = getComputedStyle(document.documentElement).getPropertyValue('--saved-container-top').trim();

        if (cssLeft && cssTop) {
            applyPositioningStyles(pageBackdrop, cssLeft, cssTop);
        }
    }
});

const ResizableContainer = {
    // Default and current dimensions
    defaults: {
        width: 1400,        // Default container width
        height: 600,        // Default three-column panel height
        testHeight: 175,    // Test panel height (fixed)
        minWidth: 1400,     // Minimum container width (same as default)
        maxWidth: 2400,     // Maximum container width
        minHeight: 600,     // Minimum panel height (same as default)
        maxHeight: 1000     // Maximum panel height
    },

    // Current state
    state: {
        width: 1400,
        height: 600,
        isResizing: false,
        isDragging: false,
        resizeType: null,   // 'both', 'both-left'
        startX: 0,
        startY: 0,
        startWidth: 0,
        startHeight: 0,
        startLeft: 0,
        startTop: 0
    },

    // DOM elements
    elements: {
        pageBackdrop: null,
        container: null,
        threeColumnLayout: null,
        header: null,
        bottomRightHandle: null,
        bottomLeftHandle: null
    },

    /**
     * Initialize the resizable container system
     */
    init() {
        this.findElements();
        this.loadSavedDimensions();

        // Apply position IMMEDIATELY to prevent visual shift
        this.loadSavedPosition();

        this.createResizeHandles();
        this.setupEventListeners();

        // Check if CSS custom properties are already set (inline script loaded saved dimensions)
        const savedContainerWidth = getComputedStyle(document.documentElement).getPropertyValue('--saved-container-width').trim();
        const savedPanelHeight = getComputedStyle(document.documentElement).getPropertyValue('--saved-panel-height').trim();


        // If CSS has saved dimensions, just sync state without applying
        const hasSavedDimensions = savedContainerWidth && savedPanelHeight;
        if (hasSavedDimensions) {
            // Only update internal state to match CSS - don't apply to DOM
            const cssWidth = parseInt(savedContainerWidth) - 16; // Remove the +16 padding
            const cssHeight = parseInt(savedPanelHeight);

            // Update state to match CSS but don't touch DOM since CSS already has correct values
            this.state.width = cssWidth;
            this.state.height = cssHeight;

        } else {
            // Only apply JavaScript dimensions if CSS doesn't have saved values
            const hasCustomDimensions = this.state.width !== this.defaults.width || this.state.height !== this.defaults.height;
            if (hasCustomDimensions) {
                // Delay application to prevent flash
                setTimeout(() => this.applyDimensions(), 0);
            }
        }
    },

    /**
     * Find required DOM elements
     */
    findElements() {
        this.elements.pageBackdrop = document.querySelector('.page-backdrop');
        this.elements.container = document.querySelector('.page-backdrop'); // Match working version - container IS pageBackdrop
        this.elements.threeColumnLayout = document.querySelector('.three-column-layout');
        this.elements.header = document.querySelector('header');

        if (!this.elements.pageBackdrop || !this.elements.container || !this.elements.threeColumnLayout || !this.elements.header) {
            return false;
        }

        return true;
    },

    /**
     * Load saved dimensions from localStorage
     */
    loadSavedDimensions() {
        try {
            const saved = localStorage.getItem('redis-acl-builder-dimensions');
            if (saved) {
                const dimensions = JSON.parse(saved);
                this.state.width = Math.max(this.defaults.minWidth,
                    Math.min(this.defaults.maxWidth, dimensions.width || this.defaults.width));
                this.state.height = Math.max(this.defaults.minHeight,
                    Math.min(this.defaults.maxHeight, dimensions.height || this.defaults.height));

            }
        } catch (error) {
            console.warn('Failed to load saved dimensions:', error);
        }
    },

    /**
     * Save current dimensions to localStorage
     */
    saveDimensions() {
        try {
            const dimensions = {
                width: this.state.width,
                height: this.state.height,
                timestamp: Date.now()
            };
            localStorage.setItem('redis-acl-builder-dimensions', JSON.stringify(dimensions));
        } catch (error) {
            console.warn('Failed to save dimensions:', error);
        }
    },

    /**
     * Create resize handles (simplified to 2 bottom corners only)
     */
    createResizeHandles() {
        // Bottom-right handle (both width and height)
        this.elements.bottomRightHandle = document.createElement('div');
        this.elements.bottomRightHandle.className = 'resize-handle resize-handle-br';
        this.elements.bottomRightHandle.title = 'Drag to resize container (width + height)';

        // Bottom-left handle (both width and height, expanding left)
        this.elements.bottomLeftHandle = document.createElement('div');
        this.elements.bottomLeftHandle.className = 'resize-handle resize-handle-bl';
        this.elements.bottomLeftHandle.title = 'Drag to resize container (width + height)';

        // Add handles to page backdrop (for positioning)
        this.elements.pageBackdrop.appendChild(this.elements.bottomRightHandle);
        this.elements.pageBackdrop.appendChild(this.elements.bottomLeftHandle);

        // Make container and header draggable
        // Only set position to relative if not already positioned by inline script
        const currentPosition = getComputedStyle(this.elements.pageBackdrop).position;
        if (currentPosition !== 'fixed') {
            this.elements.pageBackdrop.style.position = 'relative';
        }

        this.elements.header.style.cursor = 'move';
        this.elements.header.title = 'Drag to move container';
        this.elements.header.classList.add('draggable-header');
    },

    /**
     * Setup event listeners for resize handles and drag functionality
     */
    setupEventListeners() {
        // Bottom-right handle (both dimensions)
        this.elements.bottomRightHandle.addEventListener('mousedown', (e) => {
            this.startResize(e, 'both');
        });

        // Bottom-left handle (both dimensions, expanding left)
        this.elements.bottomLeftHandle.addEventListener('mousedown', (e) => {
            this.startResize(e, 'both-left');
        });

        // Header drag functionality
        this.elements.header.addEventListener('mousedown', (e) => {
            // Don't interfere with theme toggle, info link, or resize handle clicks
            if (e.target.closest('.theme-toggle') ||
                e.target.closest('.info-link') ||
                e.target.closest('.resize-handle')) {
                return;
            }
            this.startDrag(e);
        });

        // Global mouse events
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.stopOperation(e));

        // Prevent context menu on handles and header
        [this.elements.bottomRightHandle, this.elements.bottomLeftHandle, this.elements.header].forEach(element => {
            element.addEventListener('contextmenu', (e) => e.preventDefault());
        });

    },

    /**
     * Start resize operation
     */
    startResize(event, resizeType) {
        event.preventDefault();

        this.state.isResizing = true;
        this.state.resizeType = resizeType;
        this.state.startX = event.clientX;
        this.state.startY = event.clientY;
        this.state.startWidth = this.state.width;
        this.state.startHeight = this.state.height;

        // Store initial position and disable CSS centering for left-side anchor
        if (resizeType === 'both-left') {
            const initialRect = this.elements.pageBackdrop.getBoundingClientRect();
            this.state.startLeft = initialRect.left;
            this.state.startTop = initialRect.top;

            // Disable CSS centering and set explicit positioning
            applyPositioningStyles(
                this.elements.pageBackdrop,
                `${initialRect.left}px`,
                `${initialRect.top}px`,
                { useImportant: false }
            );
        }

        // Add visual feedback
        document.body.classList.add('resizing');
        document.body.classList.add(`resizing-${resizeType}`);

        // Set simple cursor based on resize type
        if (resizeType === 'both') {
            document.body.style.cursor = 'se-resize';
        } else if (resizeType === 'both-left') {
            document.body.style.cursor = 'sw-resize';
        }

        // Force immediate layout recalculation for smooth real-time feedback
        this.elements.container.offsetHeight;
    },

    /**
     * Handle mouse move during resize or drag
     */
    handleMouseMove(event) {
        if (!this.state.isResizing && !this.state.isDragging) return;

        if (this.state.isDragging) {
            this.handleDragMove(event);
            return;
        }

        const deltaX = event.clientX - this.state.startX;
        const deltaY = event.clientY - this.state.startY;

        let newWidth = this.state.startWidth;
        let newHeight = this.state.startHeight;

        // Calculate new dimensions based on resize type - ONLY 2 bottom corners
        if (this.state.resizeType === 'both') {
            // Bottom-right corner: expand right and down
            newWidth = this.state.startWidth + deltaX;
            newHeight = this.state.startHeight + deltaY;
        } else if (this.state.resizeType === 'both-left') {
            // Bottom-left corner: expand left and down (width increases as we drag left)
            newWidth = this.state.startWidth - deltaX;
            newHeight = this.state.startHeight + deltaY;
        }

        // Apply constraints
        const constrainedWidth = Math.max(this.defaults.minWidth, Math.min(this.defaults.maxWidth, newWidth));
        const constrainedHeight = Math.max(this.defaults.minHeight, Math.min(this.defaults.maxHeight, newHeight));

        // Apply real-time position adjustment for left anchor during drag
        if (this.state.resizeType === 'both-left') {
            const widthDelta = constrainedWidth - this.state.startWidth;
            const newLeft = this.state.startLeft - widthDelta;
            this.elements.pageBackdrop.style.left = `${newLeft}px`;
        }

        // Update state
        this.state.width = constrainedWidth;
        this.state.height = constrainedHeight;

        // Apply dimensions immediately for smooth feedback
        this.applyDimensions();
    },

    /**
     * Stop resize or drag operation
     */
    stopOperation(event) {
        if (this.state.isResizing) {
            this.stopResize(event);
        } else if (this.state.isDragging) {
            this.stopDrag(event);
        }
    },

    /**
     * Stop resize operation
     */
    stopResize() {
        if (!this.state.isResizing) return;

        const resizeType = this.state.resizeType; // Store before clearing

        // Position adjustment already applied during drag for left anchor

        this.state.isResizing = false;
        this.state.resizeType = null;

        // Remove visual feedback - simplified classes
        document.body.classList.remove('resizing', 'resizing-both', 'resizing-both-left');
        document.body.style.cursor = '';

        // Force final layout recalculation and re-enable transitions
        requestAnimationFrame(() => {
            this.elements.container.offsetHeight;
        });

        // Clean up CSS overrides for proper state transitions
        if (resizeType === 'both-left') {
            // Save position but don't restore margin yet - keep explicit positioning
            this.savePosition();
        } else {
            // For bottom-right resize, ensure container can return to centered state if needed
            // Don't override the position: fixed from drag operations, but clear margin override
            if (this.elements.pageBackdrop.style.margin === '0') {
                this.elements.pageBackdrop.style.margin = '';
            }
        }

        // Save final dimensions
        this.saveDimensions();
    },

    /**
     * Start drag operation
     */
    startDrag(event) {
        event.preventDefault();

        this.state.isDragging = true;
        this.state.startX = event.clientX;
        this.state.startY = event.clientY;

        // Get current position of page backdrop (the draggable container)
        const containerRect = this.elements.pageBackdrop.getBoundingClientRect();
        this.state.startLeft = containerRect.left;
        this.state.startTop = containerRect.top;

        // Add visual feedback
        document.body.classList.add('dragging');
        document.body.style.cursor = 'move';
        this.elements.pageBackdrop.classList.add('being-dragged');

        // Force immediate layout recalculation
        this.elements.container.offsetHeight;
    },

    /**
     * Handle mouse move during drag
     */
    handleDragMove(event) {
        const deltaX = event.clientX - this.state.startX;
        const deltaY = event.clientY - this.state.startY;

        // Calculate new position
        const newLeft = this.state.startLeft + deltaX;
        const newTop = this.state.startTop + deltaY;

        // Apply position constraints (keep container within viewport with some padding)
        const padding = 20;
        const maxLeft = window.innerWidth - this.state.width - padding;
        const maxTop = window.innerHeight - 200 - padding; // Leave room for bottom of container

        const constrainedLeft = Math.max(padding, Math.min(maxLeft, newLeft));
        const constrainedTop = Math.max(padding, Math.min(maxTop, newTop));

        // Apply position to page backdrop (the draggable container)
        applyPositioningStyles(
            this.elements.pageBackdrop,
            `${constrainedLeft}px`,
            `${constrainedTop}px`,
            { useImportant: false, includeTransform: true, includeMargin: false }
        );
    },

    /**
     * Stop drag operation
     */
    stopDrag() {
        if (!this.state.isDragging) return;

        this.state.isDragging = false;

        // Remove visual feedback
        document.body.classList.remove('dragging');
        document.body.style.cursor = '';
        this.elements.pageBackdrop.classList.remove('being-dragged');

        // Force final layout recalculation
        requestAnimationFrame(() => {
            this.elements.pageBackdrop.offsetHeight;
        });

        // Save final position
        this.savePosition();
    },

    /**
     * Save current position to localStorage
     */
    savePosition() {
        try {
            const containerRect = this.elements.pageBackdrop.getBoundingClientRect();
            const position = {
                left: containerRect.left,
                top: containerRect.top,
                timestamp: Date.now()
            };
            localStorage.setItem('redis-acl-builder-position', JSON.stringify(position));
        } catch (error) {
            console.warn('Failed to save position:', error);
        }
    },

    /**
     * Load saved position from localStorage
     */
    loadSavedPosition() {
        // Check if position was already loaded by inline script
        const savedContainerPosition = getComputedStyle(document.documentElement).getPropertyValue('--saved-container-position').trim();

        if (savedContainerPosition === 'fixed') {
            // Position already applied via CSS custom properties, just ensure transform is cleared
            const cssLeft = getComputedStyle(document.documentElement).getPropertyValue('--saved-container-left').trim();
            const cssTop = getComputedStyle(document.documentElement).getPropertyValue('--saved-container-top').trim();

            // Apply explicit positioning to override CSS custom properties
            // Disable transitions temporarily to prevent animated positioning
            applyPositioningStyles(this.elements.pageBackdrop, cssLeft, cssTop, {
                includeTransform: true
            });

            // Re-enable transitions after a brief delay
            setTimeout(() => {
                this.elements.pageBackdrop.style.setProperty('transition', 'max-width 0.1s ease-out');
            }, 50);

            return;
        }

        // Fallback: Load position via JavaScript (for cases where inline script didn't run)
        try {
            const saved = localStorage.getItem('redis-acl-builder-position');
            if (saved) {
                const position = JSON.parse(saved);

                // Apply position constraints
                const padding = 20;
                const maxLeft = window.innerWidth - this.state.width - padding;
                const maxTop = window.innerHeight - 200 - padding;

                const constrainedLeft = Math.max(padding, Math.min(maxLeft, position.left || 0));
                const constrainedTop = Math.max(padding, Math.min(maxTop, position.top || 0));

                applyPositioningStyles(
                    this.elements.pageBackdrop,
                    `${constrainedLeft}px`,
                    `${constrainedTop}px`,
                    { useImportant: false, includeTransform: true, includeMargin: false }
                );
            }
        } catch (error) {
            console.warn('Failed to load saved position:', error);
        }
    },

    /**
     * Apply current dimensions to the layout
     */
    applyDimensions() {
        if (!this.elements.container || !this.elements.threeColumnLayout) return;

        // Set page-backdrop max-width (this.elements.container is pageBackdrop now)
        this.elements.container.style.maxWidth = `${this.state.width + 16}px`;

        // Also set the inner .container element max-width to ensure content fits
        const innerContainer = document.querySelector('.container');
        if (innerContainer) {
            innerContainer.style.maxWidth = `${this.state.width + 16}px`;
        }

        // Set three-column panel height
        this.elements.threeColumnLayout.style.height = `${this.state.height}px`;

        // Update individual panels in three-column layout
        const panels = this.elements.threeColumnLayout.querySelectorAll('.panel');
        panels.forEach(panel => {
            panel.style.height = `${this.state.height}px`;
        });

        // Update CSS custom property for consistency
        document.documentElement.style.setProperty('--container-width', `${this.state.width}px`);
        document.documentElement.style.setProperty('--panel-height', `${this.state.height}px`);
    },

    /**
     * Reset to default dimensions
     */
    resetDimensions() {
        this.state.width = this.defaults.width;
        this.state.height = this.defaults.height;

        this.applyDimensions();
        this.saveDimensions();

    },

    /**
     * Get current dimensions
     */
    getDimensions() {
        return {
            width: this.state.width,
            height: this.state.height
        };
    },

    /**
     * Apply dimensions immediately without transitions (for smooth resize feedback)
     */
    applyDimensionsImmediate() {
        if (!this.elements.container || !this.elements.threeColumnLayout) return;

        // Temporarily disable transitions
        const originalTransition = this.elements.container.style.transition;
        this.elements.container.style.transition = 'none';

        // Apply dimensions
        this.applyDimensions();

        // Force a layout recalculation
        this.elements.container.offsetHeight;

        // Restore transitions
        this.elements.container.style.transition = originalTransition;
    }
};

// Global function for resetting dimensions (can be called from DevTools)
window.resetContainerDimensions = () => ResizableContainer.resetDimensions();

export default ResizableContainer;