/**
 * Resizable Container Manager
 * Handles container-level resizing with corner drag handles
 */

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
        resizeType: null,   // 'both', 'height-only'
        startX: 0,
        startY: 0,
        startWidth: 0,
        startHeight: 0
    },

    // DOM elements
    elements: {
        container: null,
        threeColumnLayout: null,
        bottomRightHandle: null,
        bottomLeftHandle: null
    },

    /**
     * Initialize the resizable container system
     */
    init() {
        this.findElements();
        this.loadSavedDimensions();
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
        this.elements.container = document.querySelector('.page-backdrop');
        this.elements.threeColumnLayout = document.querySelector('.three-column-layout');

        if (!this.elements.container || !this.elements.threeColumnLayout) {
            console.error('Required elements not found for resizable container');
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
     * Create resize handles
     */
    createResizeHandles() {
        // Bottom-right handle (both width and height)
        this.elements.bottomRightHandle = document.createElement('div');
        this.elements.bottomRightHandle.className = 'resize-handle resize-handle-br';
        this.elements.bottomRightHandle.title = 'Drag to resize container (width + height)';
        this.elements.bottomRightHandle.innerHTML = '⤡';

        // Bottom-left handle (height only)
        this.elements.bottomLeftHandle = document.createElement('div');
        this.elements.bottomLeftHandle.className = 'resize-handle resize-handle-bl';
        this.elements.bottomLeftHandle.title = 'Drag to resize height only';
        this.elements.bottomLeftHandle.innerHTML = '⤢';

        // Add handles to container
        this.elements.container.appendChild(this.elements.bottomRightHandle);
        this.elements.container.appendChild(this.elements.bottomLeftHandle);

        // Make container position relative for handle positioning
        this.elements.container.style.position = 'relative';
    },

    /**
     * Setup event listeners for resize handles
     */
    setupEventListeners() {
        // Bottom-right handle (both dimensions)
        this.elements.bottomRightHandle.addEventListener('mousedown', (e) => {
            this.startResize(e, 'both');
        });

        // Bottom-left handle (height only)
        this.elements.bottomLeftHandle.addEventListener('mousedown', (e) => {
            this.startResize(e, 'height-only');
        });

        // Global mouse events
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.stopResize(e));

        // Prevent context menu on handles
        [this.elements.bottomRightHandle, this.elements.bottomLeftHandle].forEach(handle => {
            handle.addEventListener('contextmenu', (e) => e.preventDefault());
        });

        // Handle window resize
        window.addEventListener('resize', () => this.handleWindowResize());
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

        // Add visual feedback
        document.body.classList.add('resizing');
        document.body.classList.add(`resizing-${resizeType}`);

        // Update cursor
        document.body.style.cursor = resizeType === 'both' ? 'nw-resize' : 'ns-resize';

        // Show resize overlay to prevent visual artifacts during button reflow
        this.showResizeOverlay();
    },

    /**
     * Handle mouse move during resize
     */
    handleMouseMove(event) {
        if (!this.state.isResizing) return;

        const deltaX = event.clientX - this.state.startX;
        const deltaY = event.clientY - this.state.startY;

        let newWidth = this.state.startWidth;
        let newHeight = this.state.startHeight;

        // Calculate new dimensions based on resize type
        if (this.state.resizeType === 'both') {
            newWidth = this.state.startWidth + deltaX;
            newHeight = this.state.startHeight + deltaY;
        } else if (this.state.resizeType === 'height-only') {
            newHeight = this.state.startHeight + deltaY;
        }

        // Apply constraints
        newWidth = Math.max(this.defaults.minWidth, Math.min(this.defaults.maxWidth, newWidth));
        newHeight = Math.max(this.defaults.minHeight, Math.min(this.defaults.maxHeight, newHeight));

        // Update state
        this.state.width = newWidth;
        this.state.height = newHeight;

        // Apply dimensions immediately for smooth feedback
        this.applyDimensions();
    },

    /**
     * Stop resize operation
     */
    stopResize(event) {
        if (!this.state.isResizing) return;

        this.state.isResizing = false;
        this.state.resizeType = null;

        // Remove visual feedback
        document.body.classList.remove('resizing', 'resizing-both', 'resizing-height-only');
        document.body.style.cursor = '';

        // Hide resize overlay after a short delay to allow transitions to complete
        this.hideResizeOverlay();

        // Save final dimensions
        this.saveDimensions();
    },

    /**
     * Apply current dimensions to the layout
     */
    applyDimensions() {
        if (!this.elements.container || !this.elements.threeColumnLayout) return;

        // Set container max-width
        this.elements.container.style.maxWidth = `${this.state.width + 16}px`;

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
     * Apply dimensions immediately without transitions (for CSS sync)
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
    },

    /**
     * Handle window resize to ensure handles stay in correct position
     */
    handleWindowResize() {
        // Debounce window resize handling
        clearTimeout(this.windowResizeTimeout);
        this.windowResizeTimeout = setTimeout(() => {
            this.updateHandlePositions();
        }, 100);
    },

    /**
     * Update handle positions
     */
    updateHandlePositions() {
        // Handles are positioned via CSS, but we might need to adjust for edge cases
        // This is a placeholder for future refinements
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
     * Show resize overlay to prevent visual artifacts during resize
     */
    showResizeOverlay() {
        // Create overlay if it doesn't exist
        if (!this.resizeOverlay) {
            this.resizeOverlay = document.createElement('div');
            this.resizeOverlay.className = 'resize-overlay';
            this.resizeOverlay.innerHTML = `
                <div class="resize-overlay-content">
                    <div class="resize-spinner"></div>
                    <div class="resize-text">Resizing...</div>
                </div>
            `;
        }

        // Apply overlay to three-column layout to prevent button reflow artifacts
        if (this.elements.threeColumnLayout) {
            this.elements.threeColumnLayout.appendChild(this.resizeOverlay);
            // Force immediate display
            this.resizeOverlay.offsetHeight;
        }
    },

    /**
     * Hide resize overlay after transitions complete
     */
    hideResizeOverlay() {
        if (this.resizeOverlay && this.resizeOverlay.parentNode) {
            // Wait for backdrop and panel transitions to complete (max 0.2s)
            setTimeout(() => {
                if (this.resizeOverlay && this.resizeOverlay.parentNode) {
                    this.resizeOverlay.parentNode.removeChild(this.resizeOverlay);
                }
            }, 250); // Slightly longer than CSS transition (0.2s) to ensure completion
        }
    }
};

// Global function for resetting dimensions (can be called from DevTools)
window.resetContainerDimensions = () => ResizableContainer.resetDimensions();

export default ResizableContainer;