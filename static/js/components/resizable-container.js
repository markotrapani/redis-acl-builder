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

// CONSOLIDATED position initialization - unified approach to eliminate redundancy
const initializeSavedPosition = () => {
    const panelContainer = document.querySelector('.panel-container');
    if (!panelContainer) return false;

    const cssLeft = getComputedStyle(document.documentElement).getPropertyValue('--saved-container-left').trim();
    const cssTop = getComputedStyle(document.documentElement).getPropertyValue('--saved-container-top').trim();

    if (cssLeft && cssTop) {
        return applyPositioningStyles(panelContainer, cssLeft, cssTop, { setOpacity: true });
    }
    return false;
};

// Unified position initialization with proper timing and fallbacks
const initializePosition = () => {
    if (initializeSavedPosition()) {
        return; // Successfully applied saved position
    }

    // If no saved position, ensure container opacity is set
    const panelContainer = document.querySelector('.panel-container');
    if (panelContainer) {
        document.documentElement.style.setProperty('--container-opacity', '1');
    }
};

// Apply position as soon as possible with proper fallback strategy
if (document.readyState === 'loading') {
    // Document still loading - try periodically until element exists
    const POSITION_RETRY_INTERVAL = 10; // ms
    const POSITION_TIMEOUT = 1000; // ms

    const positionInterval = setInterval(() => {
        if (initializeSavedPosition()) {
            clearInterval(positionInterval);
        }
    }, POSITION_RETRY_INTERVAL);

    // Stop trying after timeout and let DOMContentLoaded handle it
    setTimeout(() => clearInterval(positionInterval), POSITION_TIMEOUT);

    // Backup: ensure position is applied when DOM is ready
    document.addEventListener('DOMContentLoaded', initializePosition, { once: true });
} else {
    // Document already loaded - apply immediately
    initializePosition();
}

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
        resizeType: null,   // 'both', 'both-left', 'top-both', 'top-both-left', 'width-right', 'width-left', 'height-up', 'height-down'
        startX: 0,
        startY: 0,
        startWidth: 0,
        startHeight: 0,
        startLeft: 0,
        startTop: 0
    },

    // Responsive behavior state
    responsive: {
        viewport: { width: 0, height: 0 },
        lastUserInteraction: 0,  // Timestamp of last manual resize/drag
        userIntentTimeout: 5000, // 5 seconds after user action before auto-adjusting
        resizeDebounceTimeout: null,
        resizeDebounceDelay: 250, // ms
        isResponsiveAdjustment: false, // Flag to distinguish auto vs manual adjustments
        resizeControlsDisabled: false, // Flag when resize controls should be disabled
        viewportConstrained: false // Flag when viewport forces constraints
    },

    // DOM elements
    elements: {
        panelContainer: null,
        innerContainer: null,
        threeColumnLayout: null,
        header: null,
        bottomRightHandle: null,
        bottomLeftHandle: null,
        topRightHandle: null,
        topLeftHandle: null,
        topEdge: null,
        bottomEdge: null,
        leftEdge: null,
        rightEdge: null
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
        this.setupResponsiveListeners();

        // Initialize viewport tracking
        this.updateViewportTracking();

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
        this.elements.panelContainer = document.querySelector('.panel-container');
        this.elements.innerContainer = document.querySelector('.inner-container');
        this.elements.threeColumnLayout = document.querySelector('.three-column-layout');
        this.elements.header = document.querySelector('header');

        if (!this.elements.panelContainer || !this.elements.innerContainer || !this.elements.threeColumnLayout || !this.elements.header) {
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
     * Save current dimensions to localStorage and CSS custom properties
     */
    saveDimensions() {
        try {
            const dimensions = {
                width: this.state.width,
                height: this.state.height,
                timestamp: Date.now()
            };
            localStorage.setItem('redis-acl-builder-dimensions', JSON.stringify(dimensions));

            // Also set CSS custom properties for proper restoration
            document.documentElement.style.setProperty('--saved-container-width', `${this.state.width + 16}px`);
            document.documentElement.style.setProperty('--saved-panel-height', `${this.state.height}px`);
        } catch (error) {
            console.warn('Failed to save dimensions:', error);
        }
    },

    /**
     * Create resize handles (all 4 corners)
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

        // Top-right handle (both width and height, expanding up)
        this.elements.topRightHandle = document.createElement('div');
        this.elements.topRightHandle.className = 'resize-handle resize-handle-tr';
        this.elements.topRightHandle.title = 'Drag to resize container (width + height, bottom anchored)';

        // Top-left handle (both width and height, expanding left and up)
        this.elements.topLeftHandle = document.createElement('div');
        this.elements.topLeftHandle.className = 'resize-handle resize-handle-tl';
        this.elements.topLeftHandle.title = 'Drag to resize container (width + height, bottom anchored)';

        // Create edge handles for side resizing
        // Top edge (height resize, bottom anchored)
        this.elements.topEdge = document.createElement('div');
        this.elements.topEdge.className = 'resize-edge resize-edge-top';
        this.elements.topEdge.title = 'Drag to resize height (bottom anchored)';

        // Bottom edge (height resize)
        this.elements.bottomEdge = document.createElement('div');
        this.elements.bottomEdge.className = 'resize-edge resize-edge-bottom';
        this.elements.bottomEdge.title = 'Drag to resize height';

        // Left edge (width resize, right anchored)
        this.elements.leftEdge = document.createElement('div');
        this.elements.leftEdge.className = 'resize-edge resize-edge-left';
        this.elements.leftEdge.title = 'Drag to resize width (right anchored)';

        // Right edge (width resize)
        this.elements.rightEdge = document.createElement('div');
        this.elements.rightEdge.className = 'resize-edge resize-edge-right';
        this.elements.rightEdge.title = 'Drag to resize width';

        // Add handles to panel container (for positioning)
        this.elements.panelContainer.appendChild(this.elements.bottomRightHandle);
        this.elements.panelContainer.appendChild(this.elements.bottomLeftHandle);
        this.elements.panelContainer.appendChild(this.elements.topRightHandle);
        this.elements.panelContainer.appendChild(this.elements.topLeftHandle);

        // Add edge handles to panel container
        this.elements.panelContainer.appendChild(this.elements.topEdge);
        this.elements.panelContainer.appendChild(this.elements.bottomEdge);
        this.elements.panelContainer.appendChild(this.elements.leftEdge);
        this.elements.panelContainer.appendChild(this.elements.rightEdge);

        // Make container and header draggable
        // Only set position to relative if not already positioned by inline script
        const currentPosition = getComputedStyle(this.elements.panelContainer).position;
        if (currentPosition !== 'fixed') {
            this.elements.panelContainer.style.position = 'relative';
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

        // Top-right handle (both dimensions, expanding up, bottom anchored)
        this.elements.topRightHandle.addEventListener('mousedown', (e) => {
            this.startResize(e, 'top-both');
        });

        // Top-left handle (both dimensions, expanding left and up, bottom anchored)
        this.elements.topLeftHandle.addEventListener('mousedown', (e) => {
            this.startResize(e, 'top-both-left');
        });

        // Edge handles (single dimension resize)
        // Top edge (height only, bottom anchored)
        this.elements.topEdge.addEventListener('mousedown', (e) => {
            // Check if click is near corners - corners have priority
            if (this.isNearCorner(e, this.elements.topLeftHandle, this.elements.topRightHandle)) {
                return; // Let corner handle take precedence
            }
            this.startResize(e, 'height-up');
        });

        // Bottom edge (height only)
        this.elements.bottomEdge.addEventListener('mousedown', (e) => {
            // Check if click is near corners - corners have priority
            if (this.isNearCorner(e, this.elements.bottomLeftHandle, this.elements.bottomRightHandle)) {
                return; // Let corner handle take precedence
            }
            this.startResize(e, 'height-down');
        });

        // Left edge (width only, right anchored)
        this.elements.leftEdge.addEventListener('mousedown', (e) => {
            // Check if click is near corners - corners have priority
            if (this.isNearCorner(e, this.elements.topLeftHandle, this.elements.bottomLeftHandle)) {
                return; // Let corner handle take precedence
            }
            this.startResize(e, 'width-left');
        });

        // Right edge (width only)
        this.elements.rightEdge.addEventListener('mousedown', (e) => {
            // Check if click is near corners - corners have priority
            if (this.isNearCorner(e, this.elements.topRightHandle, this.elements.bottomRightHandle)) {
                return; // Let corner handle take precedence
            }
            this.startResize(e, 'width-right');
        });

        // Header drag functionality
        this.elements.header.addEventListener('mousedown', (e) => {
            // Don't interfere with theme toggle, info link, resize handles, or resize edges
            if (e.target.closest('.theme-toggle') ||
                e.target.closest('.info-link') ||
                e.target.closest('.resize-handle') ||
                e.target.closest('.resize-edge')) {
                return;
            }
            this.startDrag(e);
        });

        // Global mouse events
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.stopOperation(e));

        // Prevent context menu on handles, edges, and header
        [this.elements.bottomRightHandle, this.elements.bottomLeftHandle, this.elements.topRightHandle, this.elements.topLeftHandle,
         this.elements.topEdge, this.elements.bottomEdge, this.elements.leftEdge, this.elements.rightEdge, this.elements.header].forEach(element => {
            element.addEventListener('contextmenu', (e) => e.preventDefault());
        });

    },

    /**
     * Check if mouse event is near corner handles (priority system)
     */
    isNearCorner(event, corner1Handle, corner2Handle) {
        const cornerBuffer = 25; // 25px buffer around corners

        const isNearHandle = (handle) => {
            const rect = handle.getBoundingClientRect();
            const mouseX = event.clientX;
            const mouseY = event.clientY;

            return mouseX >= rect.left - cornerBuffer &&
                   mouseX <= rect.right + cornerBuffer &&
                   mouseY >= rect.top - cornerBuffer &&
                   mouseY <= rect.bottom + cornerBuffer;
        };

        return isNearHandle(corner1Handle) || isNearHandle(corner2Handle);
    },

    /**
     * Start resize operation
     */
    startResize(event, resizeType) {
        event.preventDefault();

        // Don't start resize if panels are being dragged
        if (document.body.classList.contains('panel-drag-active')) {
            return;
        }

        // Track user interaction for responsive behavior
        this.trackUserInteraction();

        this.state.isResizing = true;
        this.state.resizeType = resizeType;
        this.state.startX = event.clientX;
        this.state.startY = event.clientY;
        this.state.startWidth = this.state.width;
        this.state.startHeight = this.state.height;

        // Store initial position and disable CSS centering for anchored resize modes
        if (resizeType === 'both-left' || resizeType === 'top-both' || resizeType === 'top-both-left' ||
            resizeType === 'width-left' || resizeType === 'height-up') {
            const initialRect = this.elements.panelContainer.getBoundingClientRect();
            this.state.startLeft = initialRect.left;
            this.state.startTop = initialRect.top;

            // Disable CSS centering and set explicit positioning
            applyPositioningStyles(
                this.elements.panelContainer,
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
        } else if (resizeType === 'top-both') {
            document.body.style.cursor = 'ne-resize';
        } else if (resizeType === 'top-both-left') {
            document.body.style.cursor = 'nw-resize';
        } else if (resizeType === 'width-right') {
            document.body.style.cursor = 'e-resize';
        } else if (resizeType === 'width-left') {
            document.body.style.cursor = 'w-resize';
        } else if (resizeType === 'height-down') {
            document.body.style.cursor = 's-resize';
        } else if (resizeType === 'height-up') {
            document.body.style.cursor = 'n-resize';
        }

        // Force immediate layout recalculation for smooth real-time feedback
        this.elements.innerContainer.offsetHeight;
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

        // Calculate new dimensions based on resize type
        if (this.state.resizeType === 'both') {
            // Bottom-right corner: expand right and down
            newWidth = this.state.startWidth + deltaX;
            newHeight = this.state.startHeight + deltaY;
        } else if (this.state.resizeType === 'both-left') {
            // Bottom-left corner: expand left and down (width increases as we drag left)
            newWidth = this.state.startWidth - deltaX;
            newHeight = this.state.startHeight + deltaY;
        } else if (this.state.resizeType === 'top-both') {
            // Top-right corner: expand right and up (bottom anchored)
            newWidth = this.state.startWidth + deltaX;
            newHeight = this.state.startHeight - deltaY;
        } else if (this.state.resizeType === 'top-both-left') {
            // Top-left corner: expand left and up (bottom anchored)
            newWidth = this.state.startWidth - deltaX;
            newHeight = this.state.startHeight - deltaY;
        } else if (this.state.resizeType === 'width-right') {
            // Right edge: expand right only
            newWidth = this.state.startWidth + deltaX;
            newHeight = this.state.startHeight; // Keep height unchanged
        } else if (this.state.resizeType === 'width-left') {
            // Left edge: expand left only (right anchored)
            newWidth = this.state.startWidth - deltaX;
            newHeight = this.state.startHeight; // Keep height unchanged
        } else if (this.state.resizeType === 'height-down') {
            // Bottom edge: expand down only
            newWidth = this.state.startWidth; // Keep width unchanged
            newHeight = this.state.startHeight + deltaY;
        } else if (this.state.resizeType === 'height-up') {
            // Top edge: expand up only (bottom anchored)
            newWidth = this.state.startWidth; // Keep width unchanged
            newHeight = this.state.startHeight - deltaY;
        }

        // Get current position for viewport boundary calculations
        const currentRect = this.elements.panelContainer.getBoundingClientRect();

        // Calculate viewport-constrained maximum dimensions based on current position
        let maxAllowedWidth = newWidth;
        let maxAllowedHeight = newHeight;

        // For non-anchored resize operations, constrain dimensions to prevent exceeding viewport
        if (this.state.resizeType === 'both' || this.state.resizeType === 'width-right' ||
            this.state.resizeType === 'top-both') {
            // Calculate maximum width that won't exceed right edge of viewport
            const availableWidth = window.innerWidth - currentRect.left;
            maxAllowedWidth = Math.min(newWidth, availableWidth);
        }

        if (this.state.resizeType === 'both' || this.state.resizeType === 'height-down' ||
            this.state.resizeType === 'both-left') {
            // Calculate maximum height that won't exceed bottom edge of viewport
            // Account for header and other elements (estimate 200px total)
            const availableHeight = window.innerHeight - currentRect.top - 200;
            maxAllowedHeight = Math.min(newHeight, availableHeight);
        }

        // For upward resize operations, constrain height to prevent exceeding top edge
        if (this.state.resizeType === 'top-both' || this.state.resizeType === 'top-both-left' ||
            this.state.resizeType === 'height-up') {
            // For anchored resize modes, calculate based on final position after anchor adjustment
            // Maximum height is when the container's top edge would be at y=0
            const maxHeightForTopEdge = this.state.startHeight + this.state.startTop;
            maxAllowedHeight = Math.min(newHeight, maxHeightForTopEdge);
        }

        // For leftward resize operations, constrain width to prevent exceeding left edge
        if (this.state.resizeType === 'both-left' || this.state.resizeType === 'top-both-left' ||
            this.state.resizeType === 'width-left') {
            // For anchored resize modes, calculate based on final position after anchor adjustment
            // Maximum width is when the container's left edge would be at x=0
            const maxWidthForLeftEdge = this.state.startWidth + this.state.startLeft;
            maxAllowedWidth = Math.min(newWidth, maxWidthForLeftEdge);
        }

        // Apply all constraints: minimums, maximums, and viewport boundaries
        const constrainedWidth = Math.max(this.defaults.minWidth,
            Math.min(this.defaults.maxWidth, maxAllowedWidth));
        const constrainedHeight = Math.max(this.defaults.minHeight,
            Math.min(this.defaults.maxHeight, maxAllowedHeight));

        // Apply real-time position adjustments for anchored resize modes
        if (this.state.resizeType === 'both-left' || this.state.resizeType === 'top-both-left' || this.state.resizeType === 'width-left') {
            // Left anchor: adjust horizontal position when width changes
            const widthDelta = constrainedWidth - this.state.startWidth;
            const newLeft = this.state.startLeft - widthDelta;

            // Apply viewport constraints for left anchor positioning (allow flush with left edge)
            const constrainedLeft = Math.max(0, newLeft);
            this.elements.panelContainer.style.left = `${constrainedLeft}px`;
        }

        if (this.state.resizeType === 'top-both' || this.state.resizeType === 'top-both-left' || this.state.resizeType === 'height-up') {
            // Bottom anchor: adjust vertical position when height changes
            const heightDelta = constrainedHeight - this.state.startHeight;
            const newTop = this.state.startTop - heightDelta;

            // Apply viewport constraints for top anchor positioning (allow flush with top edge)
            const constrainedTop = Math.max(0, newTop);
            this.elements.panelContainer.style.top = `${constrainedTop}px`;
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

        // Remove visual feedback - all resize classes
        document.body.classList.remove('resizing', 'resizing-both', 'resizing-both-left', 'resizing-top-both', 'resizing-top-both-left',
            'resizing-width-right', 'resizing-width-left', 'resizing-height-down', 'resizing-height-up');
        document.body.style.cursor = '';

        // Force final layout recalculation and re-enable transitions
        requestAnimationFrame(() => {
            this.elements.innerContainer.offsetHeight;
        });

        // Clean up CSS overrides for proper state transitions
        if (resizeType === 'both-left' || resizeType === 'top-both' || resizeType === 'top-both-left' ||
            resizeType === 'width-left' || resizeType === 'height-up') {
            // Save position for anchored resize modes - keep explicit positioning
            this.savePosition();
        } else {
            // For non-anchored resize modes, ensure container can return to centered state if needed
            // Don't override the position: fixed from drag operations, but clear margin override
            if (this.elements.panelContainer.style.margin === '0') {
                this.elements.panelContainer.style.margin = '';
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

        // Track user interaction for responsive behavior
        this.trackUserInteraction();

        this.state.isDragging = true;
        this.state.startX = event.clientX;
        this.state.startY = event.clientY;

        // Get current position of panel container (the draggable container)
        const containerRect = this.elements.panelContainer.getBoundingClientRect();
        this.state.startLeft = containerRect.left;
        this.state.startTop = containerRect.top;

        // Add visual feedback
        document.body.classList.add('dragging');
        document.body.style.cursor = 'move';
        this.elements.panelContainer.classList.add('being-dragged');

        // Force immediate layout recalculation
        this.elements.innerContainer.offsetHeight;
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

        // Apply position constraints (allow flush positioning with viewport edges)
        const containerHeight = this.elements.panelContainer.offsetHeight || 600; // Use actual container height
        const containerWidth = this.state.width + 16; // Container = panel width + 8px padding on each side
        const maxLeft = window.innerWidth - containerWidth; // Allow flush with right edge
        const maxTop = window.innerHeight - containerHeight; // Allow flush with bottom edge

        const constrainedLeft = Math.max(0, Math.min(maxLeft, newLeft)); // Allow flush with left edge
        const constrainedTop = Math.max(0, Math.min(maxTop, newTop)); // Allow flush with top edge

        // Apply position to panel container (the draggable container)
        applyPositioningStyles(
            this.elements.panelContainer,
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
        this.elements.panelContainer.classList.remove('being-dragged');

        // Force final layout recalculation
        requestAnimationFrame(() => {
            this.elements.panelContainer.offsetHeight;
        });

        // Save final position
        this.savePosition();
    },

    /**
     * Save current position to localStorage
     */
    savePosition() {
        try {
            const containerRect = this.elements.panelContainer.getBoundingClientRect();
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
            applyPositioningStyles(this.elements.panelContainer, cssLeft, cssTop, {
                includeTransform: true
            });

            // Re-enable transitions after a brief delay
            setTimeout(() => {
                this.elements.panelContainer.style.setProperty('transition', 'max-width 0.1s ease-out');
            }, 50);

            return;
        }

        // Fallback: Load position via JavaScript (for cases where inline script didn't run)
        try {
            const saved = localStorage.getItem('redis-acl-builder-position');
            if (saved) {
                const position = JSON.parse(saved);

                // Apply position constraints (allow flush positioning with viewport edges)
                const containerHeight = this.elements.panelContainer.offsetHeight || 600; // Use actual container height
                const containerWidth = this.state.width + 16; // Container = panel width + 8px padding on each side
                const maxLeft = window.innerWidth - containerWidth; // Allow flush with right edge
                const maxTop = window.innerHeight - containerHeight; // Allow flush with bottom edge

                const constrainedLeft = Math.max(0, Math.min(maxLeft, position.left || 0)); // Allow flush with left edge
                const constrainedTop = Math.max(0, Math.min(maxTop, position.top || 0)); // Allow flush with top edge

                applyPositioningStyles(
                    this.elements.panelContainer,
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
        if (!this.elements.panelContainer || !this.elements.threeColumnLayout) return;


        // Set panel-container max-width
        this.elements.panelContainer.style.maxWidth = `${this.state.width + 16}px`;

        // Also set the inner container element max-width to ensure content fits
        if (this.elements.innerContainer) {
            this.elements.innerContainer.style.maxWidth = `${this.state.width + 16}px`;
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
        if (!this.elements.panelContainer || !this.elements.threeColumnLayout) return;

        // Temporarily disable transitions
        const originalTransition = this.elements.panelContainer.style.transition;
        this.elements.panelContainer.style.transition = 'none';

        // Apply dimensions
        this.applyDimensions();

        // Force a layout recalculation
        this.elements.panelContainer.offsetHeight;

        // Restore transitions
        this.elements.panelContainer.style.transition = originalTransition;
    },

    /**
     * Setup responsive event listeners
     */
    setupResponsiveListeners() {
        // Window resize listener with debouncing
        window.addEventListener('resize', () => {
            // Clear existing timeout
            if (this.responsive.resizeDebounceTimeout) {
                clearTimeout(this.responsive.resizeDebounceTimeout);
            }

            // Debounce the resize handling
            this.responsive.resizeDebounceTimeout = setTimeout(() => {
                this.handleViewportChange();
            }, this.responsive.resizeDebounceDelay);
        });

        // Also listen for orientation change on mobile devices
        window.addEventListener('orientationchange', () => {
            // Orientation change needs longer delay for viewport to stabilize
            setTimeout(() => {
                this.handleViewportChange();
            }, 300);
        });
    },

    /**
     * Update viewport tracking
     */
    updateViewportTracking() {
        this.responsive.viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };
    },

    /**
     * Track user interactions to respect user intent
     */
    trackUserInteraction() {
        this.responsive.lastUserInteraction = Date.now();
    },

    /**
     * Check if we should respect user intent (don't auto-adjust recently)
     */
    shouldRespectUserIntent() {
        const timeSinceLastInteraction = Date.now() - this.responsive.lastUserInteraction;
        return timeSinceLastInteraction < this.responsive.userIntentTimeout;
    },

    /**
     * Handle viewport changes - main responsive logic
     */
    handleViewportChange() {
        console.log('🔄 Viewport change detected');

        const previousViewport = { ...this.responsive.viewport };
        this.updateViewportTracking();

        // Check if viewport actually changed significantly
        const widthChange = Math.abs(this.responsive.viewport.width - previousViewport.width);
        const heightChange = Math.abs(this.responsive.viewport.height - previousViewport.height);

        if (widthChange < 10 && heightChange < 10) {
            console.log('📏 Viewport change too small, ignoring');
            return; // Ignore minor changes
        }

        console.log(`📐 Viewport changed: ${previousViewport.width}x${previousViewport.height} → ${this.responsive.viewport.width}x${this.responsive.viewport.height}`);

        // Check if we should respect user intent
        if (this.shouldRespectUserIntent()) {
            console.log('⏰ Respecting user intent, skipping auto-adjustment');
            return;
        }

        // Calculate if responsive adjustments are needed
        const adjustments = this.calculateResponsiveAdjustments();

        if (adjustments.needed) {
            console.log('✨ Applying responsive adjustments:', adjustments);
            this.applyResponsiveAdjustments(adjustments);
        } else {
            console.log('✅ No responsive adjustments needed');
        }

        // Update resize controls state based on viewport constraints
        this.updateResizeControlsState();
    },

    /**
     * Calculate what responsive adjustments are needed
     */
    calculateResponsiveAdjustments() {
        const currentRect = this.elements.panelContainer.getBoundingClientRect();
        const margins = 40; // Safe margins from viewport edges

        const adjustments = {
            needed: false,
            newWidth: this.state.width,
            newHeight: this.state.height,
            newLeft: currentRect.left,
            newTop: currentRect.top,
            reason: []
        };

        // Check if container width exceeds viewport
        const maxAllowedWidth = this.responsive.viewport.width - margins;
        if (this.state.width > maxAllowedWidth) {
            adjustments.needed = true;
            adjustments.newWidth = Math.max(this.defaults.minWidth, maxAllowedWidth);
            adjustments.reason.push(`width exceeds viewport (${this.state.width} > ${maxAllowedWidth})`);
        }

        // Check if container position + width exceeds viewport
        const rightEdge = currentRect.left + (adjustments.newWidth + 16); // +16 for padding
        if (rightEdge > this.responsive.viewport.width) {
            adjustments.needed = true;
            adjustments.newLeft = Math.max(0, this.responsive.viewport.width - (adjustments.newWidth + 16));
            adjustments.reason.push('right edge exceeds viewport');
        }

        // Check if container position + height exceeds viewport
        const containerHeight = currentRect.height;
        const bottomEdge = currentRect.top + containerHeight;
        if (bottomEdge > this.responsive.viewport.height) {
            adjustments.needed = true;
            adjustments.newTop = Math.max(0, this.responsive.viewport.height - containerHeight);
            adjustments.reason.push('bottom edge exceeds viewport');
        }

        return adjustments;
    },

    /**
     * Apply responsive adjustments to container
     */
    applyResponsiveAdjustments(adjustments) {
        // Set flag to indicate this is an automatic adjustment
        this.responsive.isResponsiveAdjustment = true;

        try {
            // Update dimensions if needed
            if (adjustments.newWidth !== this.state.width || adjustments.newHeight !== this.state.height) {
                this.state.width = adjustments.newWidth;
                this.state.height = adjustments.newHeight;
                this.applyDimensions();
                this.saveDimensions();
            }

            // Update position if needed
            if (adjustments.newLeft !== undefined || adjustments.newTop !== undefined) {
                applyPositioningStyles(
                    this.elements.panelContainer,
                    `${adjustments.newLeft}px`,
                    `${adjustments.newTop}px`,
                    { useImportant: false, includeTransform: true }
                );
                this.savePosition();
            }

        } finally {
            // Clear the responsive adjustment flag
            this.responsive.isResponsiveAdjustment = false;
        }
    },

    /**
     * Update resize controls state based on viewport constraints
     */
    updateResizeControlsState() {
        const margins = 40;
        const maxAllowedWidth = this.responsive.viewport.width - margins;
        const shouldDisableControls = maxAllowedWidth < this.defaults.minWidth;

        // Check if state changed
        if (shouldDisableControls !== this.responsive.resizeControlsDisabled) {
            this.responsive.resizeControlsDisabled = shouldDisableControls;
            this.responsive.viewportConstrained = shouldDisableControls;

            if (shouldDisableControls) {
                console.log(`🚫 Disabling resize controls - viewport too small (max allowed: ${maxAllowedWidth}px, min required: ${this.defaults.minWidth}px)`);
                this.disableResizeControls();
            } else {
                console.log('✅ Enabling resize controls - viewport allows normal operation');
                this.enableResizeControls();
            }
        }
    },

    /**
     * Disable resize controls when viewport is too constrained
     */
    disableResizeControls() {
        // Add disabled class to container for styling
        this.elements.panelContainer.classList.add('resize-controls-disabled');

        // Disable all resize handles
        const handles = [
            this.elements.bottomRightHandle,
            this.elements.bottomLeftHandle,
            this.elements.topRightHandle,
            this.elements.topLeftHandle,
            this.elements.topEdge,
            this.elements.bottomEdge,
            this.elements.leftEdge,
            this.elements.rightEdge
        ];

        handles.forEach(handle => {
            if (handle) {
                handle.style.pointerEvents = 'none';
                handle.style.opacity = '0.3';
                handle.title = 'Resize controls disabled - window too small';
            }
        });

        // Update header drag title
        if (this.elements.header) {
            this.elements.header.title = 'Drag to move container (resize disabled - window too small)';
        }
    },

    /**
     * Enable resize controls when viewport allows normal operation
     */
    enableResizeControls() {
        // Remove disabled class from container
        this.elements.panelContainer.classList.remove('resize-controls-disabled');

        // Re-enable all resize handles
        const handles = [
            this.elements.bottomRightHandle,
            this.elements.bottomLeftHandle,
            this.elements.topRightHandle,
            this.elements.topLeftHandle,
            this.elements.topEdge,
            this.elements.bottomEdge,
            this.elements.leftEdge,
            this.elements.rightEdge
        ];

        handles.forEach(handle => {
            if (handle) {
                handle.style.pointerEvents = '';
                handle.style.opacity = '';
                // Restore original titles
                if (handle.classList.contains('resize-handle-br')) {
                    handle.title = 'Drag to resize container (width + height)';
                } else if (handle.classList.contains('resize-handle-bl')) {
                    handle.title = 'Drag to resize container (width + height)';
                } else if (handle.classList.contains('resize-handle-tr')) {
                    handle.title = 'Drag to resize container (width + height, bottom anchored)';
                } else if (handle.classList.contains('resize-handle-tl')) {
                    handle.title = 'Drag to resize container (width + height, bottom anchored)';
                } else if (handle.classList.contains('resize-edge-top')) {
                    handle.title = 'Drag to resize height (bottom anchored)';
                } else if (handle.classList.contains('resize-edge-bottom')) {
                    handle.title = 'Drag to resize height';
                } else if (handle.classList.contains('resize-edge-left')) {
                    handle.title = 'Drag to resize width (right anchored)';
                } else if (handle.classList.contains('resize-edge-right')) {
                    handle.title = 'Drag to resize width';
                }
            }
        });

        // Restore header drag title
        if (this.elements.header) {
            this.elements.header.title = 'Drag to move container';
        }
    }
};

// Global functions for testing and debugging (can be called from DevTools)
window.resetContainerDimensions = () => ResizableContainer.resetDimensions();
window.debugResponsive = () => {
    console.log('🔍 Responsive Debug Info:');
    console.log('Viewport:', ResizableContainer.responsive.viewport);
    console.log('Container dimensions:', ResizableContainer.state.width + 'x' + ResizableContainer.state.height);
    console.log('Last user interaction:', new Date(ResizableContainer.responsive.lastUserInteraction));
    console.log('Should respect user intent:', ResizableContainer.shouldRespectUserIntent());

    const rect = ResizableContainer.elements.panelContainer.getBoundingClientRect();
    console.log('Container position:', Math.round(rect.left) + ',' + Math.round(rect.top));
    console.log('Container size:', Math.round(rect.width) + 'x' + Math.round(rect.height));

    // Test responsive calculation
    const adjustments = ResizableContainer.calculateResponsiveAdjustments();
    console.log('Responsive adjustments needed:', adjustments);
};
window.testResponsive = () => {
    console.log('🧪 Testing responsive behavior...');
    ResizableContainer.handleViewportChange();
};

export default ResizableContainer;