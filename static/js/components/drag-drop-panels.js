/**
 * Drag and Drop Panel Reordering System
 * Allows users to customize the three-column layout by dragging panels to reorder them
 */

import Storage from '../core/storage.js';
import Utils from '../core/utils.js';

const DragDropPanels = {
    // Configuration
    STORAGE_KEY: 'redis-acl-builder-panel-order',

    // Default panel order
    DEFAULT_ORDER: ['acl-config-panel', 'blocked-commands-panel', 'granted-commands-panel'],

    // State
    state: {
        isInitialized: false,
        isDragging: false,
        draggedPanel: null,
        draggedIndex: -1,
        dropZoneIndex: -1,
        panelOrder: [],
        originalPositions: new Map(),
        mouseX: 0,
        mouseY: 0,
        dragStartX: 0,
        dragStartY: 0,
        panelStartX: 0,
        panelStartY: 0,
        lastDetectionTime: 0
    },

    // DOM elements
    elements: {
        threeColumnLayout: null,
        panels: [],
        dragHandles: []
    },

    /**
     * Initialize the drag-and-drop system
     */
    init() {
        try {
            this.findElements();
            this.loadPanelOrder();
            this.createDragHandles();
            this.applyPanelOrder();
            this.setupEventListeners();
            this.state.isInitialized = true;
            console.log('Drag-drop panels system initialized');
        } catch (error) {
            console.error('Failed to initialize drag-drop panels:', error);
        }
    },

    /**
     * Find required DOM elements
     */
    findElements() {
        this.elements.threeColumnLayout = document.querySelector('.three-column-layout');
        if (!this.elements.threeColumnLayout) {
            throw new Error('Three-column layout not found');
        }

        // Find all panels
        this.elements.panels = Array.from(this.elements.threeColumnLayout.querySelectorAll('.panel'));
        if (this.elements.panels.length !== 3) {
            throw new Error(`Expected 3 panels, found ${this.elements.panels.length}`);
        }

        console.log('Found panels:', this.elements.panels.map(p => p.className));
    },

    /**
     * Load saved panel order from localStorage or use pre-loaded order
     */
    loadPanelOrder() {
        // Check if panel order was pre-loaded to prevent flash
        if (window._initialPanelOrder && Array.isArray(window._initialPanelOrder) && window._initialPanelOrder.length === 3) {
            this.state.panelOrder = [...window._initialPanelOrder];
            console.log('Using pre-loaded panel order (no flash):', this.state.panelOrder);
            return;
        }

        // Fallback to localStorage if pre-load failed
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                const savedOrder = JSON.parse(saved);
                // Validate saved order contains all expected panels
                if (Array.isArray(savedOrder) && savedOrder.length === 3 &&
                    this.DEFAULT_ORDER.every(panel => savedOrder.includes(panel))) {
                    this.state.panelOrder = savedOrder;
                    console.log('Loaded saved panel order from localStorage:', this.state.panelOrder);
                    return;
                }
            }
        } catch (error) {
            console.warn('Failed to load panel order:', error);
        }

        // Use default order
        this.state.panelOrder = [...this.DEFAULT_ORDER];
        console.log('Using default panel order:', this.state.panelOrder);
    },

    /**
     * Save panel order to localStorage
     */
    savePanelOrder() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state.panelOrder));
            console.log('Saved panel order:', this.state.panelOrder);
        } catch (error) {
            console.warn('Failed to save panel order:', error);
        }
    },

    /**
     * Find existing drag handles (now in HTML) and set up references
     */
    createDragHandles() {
        this.elements.dragHandles = []; // Clear existing array
        this.elements.panels.forEach(panel => {
            const dragHandle = panel.querySelector('.panel-drag-handle');
            if (dragHandle) {
                this.elements.dragHandles.push(dragHandle);
            }
        });
    },

    /**
     * Update drag handle references after panel swapping
     */
    updateDragHandleReferences() {
        this.elements.dragHandles = []; // Clear existing array
        this.elements.panels.forEach(panel => {
            const dragHandle = panel.querySelector('.panel-drag-handle');
            if (dragHandle) {
                this.elements.dragHandles.push(dragHandle);
            }
        });
    },

    /**
     * Apply the current panel order to the DOM
     */
    applyPanelOrder() {
        const container = this.elements.threeColumnLayout;

        // Store original positions for reference
        this.state.originalPositions.clear();
        this.elements.panels.forEach((panel, index) => {
            this.state.originalPositions.set(panel, index);
        });

        // Reorder panels based on saved order
        const reorderedPanels = [];
        this.state.panelOrder.forEach(panelClass => {
            const panel = this.elements.panels.find(p => p.classList.contains(panelClass));
            if (panel) {
                reorderedPanels.push(panel);
            }
        });

        // Re-append panels in the correct order
        reorderedPanels.forEach(panel => {
            container.appendChild(panel);
        });

        // Update elements.panels to match new order
        this.elements.panels = reorderedPanels;

        // Show panels now that they're in the correct order (prevent flash)
        if (window._panelsHidden) {
            console.log('🔧 Showing panels after reordering (flash prevention)');
            document.documentElement.style.setProperty('--panels-opacity', '1');
            window._panelsHidden = false;
        }

        console.log('Applied panel order:', this.state.panelOrder);
    },

    /**
     * Setup event listeners for drag and drop
     */
    setupEventListeners() {
        this.setupDragHandleListeners();
        this.setupGlobalListeners();
        this.setupPanelHoverListeners();
    },

    /**
     * Setup drag handle listeners (can be called to refresh after swapping)
     */
    setupDragHandleListeners() {
        // Clear existing listeners by cloning elements (removes all event listeners)
        this.elements.dragHandles.forEach((handle, index) => {
            const newHandle = handle.cloneNode(true);
            handle.parentNode.replaceChild(newHandle, handle);
            this.elements.dragHandles[index] = newHandle;
        });

        // Add fresh event listeners
        this.elements.dragHandles.forEach((handle, index) => {
            // Prevent default drag behavior
            handle.addEventListener('dragstart', (e) => {
                e.preventDefault();
            });

            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                // Find current panel index dynamically
                const currentPanelIndex = this.findCurrentPanelIndex(handle);
                this.handleMouseDown(e, currentPanelIndex);
            });
        });
    },

    /**
     * Setup global mouse listeners
     */
    setupGlobalListeners() {
        // Global mouse tracking
        document.addEventListener('mousemove', (e) => {
            if (this.state.isDragging) {
                this.handleMouseMove(e);
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (this.state.isDragging) {
                this.handleMouseUp(e);
            }
        });
    },

    /**
     * Setup panel hover listeners (refresh after swapping)
     */
    setupPanelHoverListeners() {
        // Remove old listeners by clearing the layout container event listeners
        // We'll use a single mousemove listener on the container instead
        this.elements.threeColumnLayout.addEventListener('mousemove', (e) => {
            if (this.state.isDragging) {
                this.detectDropZone(e);
            }
        });
    },

    /**
     * Find the current index of a panel based on its drag handle
     */
    findCurrentPanelIndex(handle) {
        // Find the parent panel of this handle
        const parentPanel = handle.closest('.panel');
        if (!parentPanel) return -1;

        // Find the current index of this panel in the elements.panels array
        return this.elements.panels.findIndex(panel => panel === parentPanel);
    },

    /**
     * Handle mouse down (start of drag)
     */
    handleMouseDown(e, index) {
        this.state.isDragging = true;
        this.state.draggedIndex = index;
        this.state.draggedPanel = this.elements.panels[index];

        // Capture initial positions
        const rect = this.state.draggedPanel.getBoundingClientRect();
        this.state.dragStartX = e.clientX;
        this.state.dragStartY = e.clientY;
        this.state.panelStartX = rect.left;
        this.state.panelStartY = rect.top;

        // Add dragging class for visual feedback
        this.state.draggedPanel.classList.add('panel-dragging');
        document.body.classList.add('panel-drag-active');

        // Prevent text selection during drag
        document.body.style.userSelect = 'none';

        console.log('🚀 DRAG START:');
        console.log('  - Panel index:', index);
        console.log('  - Panel class:', this.state.draggedPanel.className);
        console.log('  - Initial position:', { left: rect.left, top: rect.top, width: rect.width });
        console.log('  - Mouse start:', { x: e.clientX, y: e.clientY });
        console.log('  - Current panel order:', this.state.panelOrder);
    },

    /**
     * Handle mouse move (during drag)
     */
    handleMouseMove(e) {
        if (!this.state.isDragging || !this.state.draggedPanel) return;

        this.state.mouseX = e.clientX;
        this.state.mouseY = e.clientY;

        const deltaX = e.clientX - this.state.dragStartX;
        const deltaY = e.clientY - this.state.dragStartY;

        // Apply transform to follow mouse
        this.state.draggedPanel.style.transform = `
            translateX(${12 + deltaX}px)
            translateY(${-12 + deltaY}px)
            scale(1.02)
        `;
    },

    /**
     * Detect which position the dragged panel should be inserted based on panel overlap
     */
    detectDropZone(e) {
        const draggedIndex = this.state.draggedIndex;
        if (!this.state.draggedPanel) return;

        // Throttle detection to prevent too frequent updates (smooth animations)
        const now = Date.now();
        if (now - this.state.lastDetectionTime < 16) return; // ~60fps throttling
        this.state.lastDetectionTime = now;

        // Get the current position of the dragged panel (accounting for transform)
        const draggedRect = this.state.draggedPanel.getBoundingClientRect();
        const draggedLeft = draggedRect.left;
        const draggedRight = draggedRect.right;

        // Get all other panel positions
        const panelRects = this.elements.panels.map((panel, index) => {
            if (index === draggedIndex) return null; // Skip dragged panel
            return {
                index,
                rect: panel.getBoundingClientRect(),
                element: panel
            };
        }).filter(p => p !== null);

        // Determine insertion position based on panel edge crossover
        let insertPosition = draggedIndex; // Default to original position

        // Track all crossovers to find the furthest insertion point
        const crossovers = [];

        for (const panelData of panelRects) {
            const { index, rect } = panelData;
            const targetLeft = rect.left;
            const targetRight = rect.right;

            if (draggedIndex < index) {
                // Dragging to the right: check if dragged panel's left edge crosses target's left edge
                if (draggedLeft > targetLeft) {
                    crossovers.push(index);
                    console.log(`    🔄 Right crossover: Panel ${draggedIndex} crosses panel ${index}`);
                }
            } else {
                // Dragging to the left: check if dragged panel's right edge crosses target's right edge
                if (draggedRight < targetRight) {
                    crossovers.push(index);
                    console.log(`    🔄 Left crossover: Panel ${draggedIndex} crosses panel ${index}`);
                }
            }
        }

        // Find the furthest insertion position
        if (crossovers.length > 0) {
            if (draggedIndex < Math.max(...crossovers)) {
                // Dragging right: use the rightmost crossover
                insertPosition = Math.max(...crossovers);
            } else {
                // Dragging left: use the leftmost crossover
                insertPosition = Math.min(...crossovers);
            }
            console.log(`    🎯 Crossovers detected: [${crossovers.join(', ')}], final insertPosition: ${insertPosition}`);
        }

        // Check if we've dragged past the last panel (need to insert at end)
        if (draggedIndex === 0 && insertPosition === 2) {
            // When leftmost crosses rightmost, it should go to the very end
            // We need to insert at position 3 (after removing the dragged panel from 0)
            // But since we'll remove index 0 first, the final position becomes 2
            insertPosition = 2; // After removal of index 0, this becomes the end position
            console.log(`    🎯 Special case: Leftmost past rightmost, insertPosition stays ${insertPosition}`);
        }

        // Add debug for the insertion logic
        console.log(`    📍 Final insertPosition: ${insertPosition} (panel will be placed at this index after removal)`);

        // Let's trace through the expected array operations:
        if (draggedIndex === 0 && insertPosition === 2) {
            console.log(`    🔍 Expected transformation: [A,B,C] → remove A → [B,C] → insert A at 2 → [B,C,A]`);
        }

        // Only update if position actually changed to prevent unnecessary animations
        if (insertPosition !== this.state.dropZoneIndex) {
            const isMultiShift = Math.abs(insertPosition - draggedIndex) > 1;
            console.log('🎯 CROSSOVER DETECTED:');
            console.log('  - Dragged panel:', draggedIndex, '→', insertPosition);
            console.log('  - Type:', isMultiShift ? '🔄 MULTI-PANEL SHIFT' : '↔️ SINGLE PANEL SWAP');
            console.log('  - Dragged bounds:', { left: draggedLeft, right: draggedRight });
            console.log('  - Affected panels:');

            // Show which panels will be affected
            for (let i = Math.min(draggedIndex, insertPosition); i <= Math.max(draggedIndex, insertPosition); i++) {
                if (i !== draggedIndex) {
                    const panel = this.elements.panels[i];
                    const direction = insertPosition > draggedIndex ? 'LEFT' : 'RIGHT';
                    console.log(`    [${i}] ${this.getPanelClass(panel)} will shift ${direction}`);
                }
            }

            this.state.dropZoneIndex = insertPosition;
            this.visualizeInsertion(draggedIndex, insertPosition);
        }
    },

    /**
     * Visualize where the panel will be inserted by moving panels to their actual destination positions
     */
    visualizeInsertion(draggedIndex, insertPosition) {
        // First, ensure all panels are in their clean state (no lingering transforms)
        this.elements.panels.forEach(panel => {
            if (panel !== this.state.draggedPanel) {
                panel.classList.remove('panel-make-room-left', 'panel-make-room-right', 'panel-preview-position');
                panel.style.transform = '';
            }
        });

        // Give DOM a moment to settle after clearing transforms
        requestAnimationFrame(() => {
            // Calculate what the final layout will look like
            const currentOrder = [...this.elements.panels];
            const previewOrder = [...currentOrder];

            // Only modify the order if insertPosition is different from current position
            if (insertPosition !== draggedIndex) {
                // Remove dragged panel and insert at new position
                const draggedPanel = previewOrder.splice(draggedIndex, 1)[0];
                previewOrder.splice(insertPosition, 0, draggedPanel);
            }

            console.log('🎬 VISUALIZATION UPDATE:');
            console.log('  - Current DOM order:', this.elements.panels.map(p => this.getPanelClass(p)));
            console.log('  - Preview order:', previewOrder.map(p => this.getPanelClass(p)));
            console.log('  - Multi-panel shift scenario:', draggedIndex === 0 && insertPosition === 2 ? 'LEFT→RIGHT (2 panels shift)' :
                       draggedIndex === 2 && insertPosition === 0 ? 'RIGHT→LEFT (2 panels shift)' : 'Single panel shift');

            // Show detailed position mapping
            console.log('  - Position changes:');
            this.elements.panels.forEach((panel, currentIndex) => {
                if (currentIndex !== draggedIndex) {
                    const previewIndex = previewOrder.findIndex(p => p === panel);
                    const change = previewIndex - currentIndex;
                    console.log(`    [${currentIndex}] ${this.getPanelClass(panel)} → [${previewIndex}] (Δ${change})`);
                }
            });

            // Calculate how far each panel needs to move to reach its preview position
            this.elements.panels.forEach((panel, currentIndex) => {
                if (currentIndex === draggedIndex) return; // Skip dragged panel

                // Find where this panel will be in the preview layout
                const previewIndex = previewOrder.findIndex(p => p === panel);
                const positionDifference = previewIndex - currentIndex;

                if (positionDifference !== 0) {
                    // Use a simple, stable calculation based on panel width
                    const panelWidth = panel.getBoundingClientRect().width;
                    const gap = 16; // Conservative gap that works reliably
                    const calculatedOffset = positionDifference * (panelWidth + gap);

                    console.log(`  - Panel [${currentIndex}] ${this.getPanelClass(panel)}: ${currentIndex} → ${previewIndex} (Δ${positionDifference})`);
                    console.log(`    Panel width: ${panelWidth}px, Gap: ${gap}px, Offset: ${calculatedOffset}px`);

                    // Apply the calculated transform
                    panel.classList.add('panel-preview-position');
                    panel.style.transform = `translateX(${calculatedOffset}px)`;
                } else {
                    // Panel stays in place
                    console.log(`  - Panel [${currentIndex}] ${this.getPanelClass(panel)}: staying in place`);
                    panel.classList.add('panel-preview-position');
                    panel.style.transform = '';
                }
            });
        });
    },

    /**
     * Handle mouse up (end of drag)
     */
    handleMouseUp(e) {
        if (!this.state.isDragging) return;

        console.log('🏁 DRAG END:');
        console.log('  - Final drop zone:', this.state.dropZoneIndex);
        console.log('  - Original index:', this.state.draggedIndex);

        // If we have a valid drop zone, perform the insertion
        if (this.state.dropZoneIndex !== -1 && this.state.dropZoneIndex !== this.state.draggedIndex) {
            console.log('  - ✅ Performing panel insertion');
            this.insertPanel(this.state.draggedIndex, this.state.dropZoneIndex);
            Utils.showNotification('Panel layout updated! 🔄', 'success');
        } else {
            console.log('  - ❌ No valid drop zone, returning to original position');
        }

        this.handleDragEnd();
    },


    /**
     * Make room for the dragged panel
     */
    makeRoomForPanel(targetIndex) {
        // Clear previous room-making effects
        this.elements.panels.forEach(panel => {
            panel.classList.remove('panel-make-room-left', 'panel-make-room-right');
        });

        // Determine which direction to move other panels
        const draggedIndex = this.state.draggedIndex;

        // Move panels to make room based on insertion point
        this.elements.panels.forEach((panel, index) => {
            if (index === draggedIndex) return; // Skip the dragged panel

            if (draggedIndex < targetIndex) {
                // Dragging right - panels between dragged and target move left
                if (index > draggedIndex && index <= targetIndex) {
                    panel.classList.add('panel-make-room-left');
                }
            } else {
                // Dragging left - panels between target and dragged move right
                if (index >= targetIndex && index < draggedIndex) {
                    panel.classList.add('panel-make-room-right');
                }
            }
        });
    },

    /**
     * Handle drag end
     */
    handleDragEnd() {
        if (!this.state.isDragging) return;

        // Clean up visual feedback
        this.elements.panels.forEach(panel => {
            panel.classList.remove('panel-dragging', 'panel-drop-zone', 'panel-swap-animation', 'panel-make-room-left', 'panel-make-room-right', 'panel-preview-position');
            // Reset any custom transforms
            panel.style.transform = '';
        });
        document.body.classList.remove('panel-drag-active');

        // Restore text selection
        document.body.style.userSelect = '';

        // Reset state
        this.state.isDragging = false;
        this.state.draggedPanel = null;
        this.state.draggedIndex = -1;
        this.state.dropZoneIndex = -1;

        console.log('Drag ended');
    },

    /**
     * Show drop zone indicator
     */
    showDropZone(index) {
        // Clear previous drop zones
        this.elements.panels.forEach(panel => {
            panel.classList.remove('panel-drop-zone');
        });

        // Add drop zone to target panel
        if (index >= 0 && index < this.elements.panels.length) {
            this.elements.panels[index].classList.add('panel-drop-zone');
        }
    },

    /**
     * Insert panel at a new position with proper shifting
     */
    insertPanel(draggedIndex, insertPosition) {
        const container = this.elements.threeColumnLayout;
        const draggedPanel = this.elements.panels[draggedIndex];

        console.log('🔄 PANEL INSERTION:');
        console.log(`  - Moving panel from index ${draggedIndex} to ${insertPosition}`);
        console.log('  - Before:', this.state.panelOrder);
        console.log('  - Before elements array:', this.elements.panels.map(p => this.getPanelClass(p)));

        // Add animation class to all affected panels
        this.elements.panels.forEach(panel => panel.classList.add('panel-swap-animation'));

        // Remove dragged panel from arrays temporarily
        const draggedPanelClass = this.state.panelOrder.splice(draggedIndex, 1)[0];
        const draggedPanelElement = this.elements.panels.splice(draggedIndex, 1)[0];

        console.log(`  - Removed: ${draggedPanelClass}`);

        // Insert at new position
        this.state.panelOrder.splice(insertPosition, 0, draggedPanelClass);
        this.elements.panels.splice(insertPosition, 0, draggedPanelElement);

        console.log(`  - Inserted at position ${insertPosition}`);
        console.log('  - After:', this.state.panelOrder);

        // Rebuild DOM in the new order
        this.elements.panels.forEach((panel, index) => {
            console.log(`  - DOM order [${index}]: ${this.getPanelClass(panel)}`);
            container.appendChild(panel);
        });

        // Save the new order
        this.savePanelOrder();

        // Refresh drag handle references after DOM manipulation
        this.updateDragHandleReferences();

        // Refresh event listeners so handles work with their new panels
        this.setupDragHandleListeners();

        // Remove animation class after animation completes
        setTimeout(() => {
            this.elements.panels.forEach(panel => {
                panel.classList.remove('panel-swap-animation');
            });
            console.log('🎉 Panel insertion complete!');
        }, 300);
    },

    /**
     * Swap two panels with smooth animation (kept for backward compatibility)
     */
    swapPanels(fromIndex, toIndex) {
        // Use insertPanel for proper shifting behavior
        this.insertPanel(fromIndex, toIndex);
    },

    /**
     * Get the identifying class name for a panel
     */
    getPanelClass(panel) {
        const classes = Array.from(panel.classList);
        return classes.find(cls => cls.includes('-panel')) || classes[1] || classes[0];
    },

    /**
     * Reset panels to default order
     */
    resetToDefault() {
        this.state.panelOrder = [...this.DEFAULT_ORDER];
        this.applyPanelOrder();
        this.savePanelOrder();
        Utils.showNotification('Panel layout reset to default! 🔄', 'success');
        console.log('Reset to default panel order');
    },

    /**
     * Get current panel order for debugging
     */
    getCurrentOrder() {
        return [...this.state.panelOrder];
    }
};

export default DragDropPanels;