/**
 * Drag and Drop Testing Section Reordering System
 * Allows users to reorder the bottom testing sections (Command, Keyspace, Integrated testers)
 * Completely isolated from the main three-column panel drag system
 */

import Storage from '../core/storage.js';
import Utils from '../core/utils.js';

const DragDropTesters = {
    // Configuration
    STORAGE_KEY: 'redis-acl-builder-tester-order',

    // Default tester order
    DEFAULT_ORDER: ['command-tester-panel', 'keyspace-tester-panel', 'integrated-tester-panel'],

    // State
    state: {
        isInitialized: false,
        isDragging: false,
        draggedTester: null,
        draggedIndex: -1,
        dropZoneIndex: -1,
        testerOrder: [],
        originalPositions: new Map(),
        mouseX: 0,
        mouseY: 0,
        dragStartX: 0,
        dragStartY: 0,
        testerStartX: 0,
        testerStartY: 0,
        lastDetectionTime: 0
    },

    // DOM elements
    elements: {
        testingContainer: null,
        testers: [],
        dragHandles: []
    },

    /**
     * Initialize the drag-and-drop system for testing sections
     */
    init() {
        try {
            this.findElements();
            this.loadTesterOrder();
            this.createDragHandles();
            this.applyTesterOrder();
            this.setupEventListeners();
            this.state.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize drag-drop testers:', error);
        }
    },

    /**
     * Find required DOM elements
     */
    findElements() {
        this.elements.testingContainer = document.querySelector('.testing-container');
        if (!this.elements.testingContainer) {
            throw new Error('Testing container not found');
        }

        // Find all testing sections
        this.elements.testers = Array.from(this.elements.testingContainer.querySelectorAll('.test-section'));
        if (this.elements.testers.length < 2) {
            throw new Error(`Expected at least 2 testing sections, found ${this.elements.testers.length}`);
        }
    },

    /**
     * Load saved tester order from localStorage or use pre-loaded order
     */
    loadTesterOrder() {
        // Check if tester order was pre-loaded to prevent flash
        if (window._initialTesterOrder && Array.isArray(window._initialTesterOrder) && window._initialTesterOrder.length >= 2) {
            this.state.testerOrder = [...window._initialTesterOrder];
            return;
        }

        // Fallback to localStorage if pre-load failed
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                const savedOrder = JSON.parse(saved);
                // Validate saved order
                if (Array.isArray(savedOrder) && savedOrder.length >= 2) {
                    this.state.testerOrder = savedOrder;
                    return;
                }
            }
        } catch (error) {
            console.warn('Failed to load tester order:', error);
        }

        // Use default order
        this.state.testerOrder = [...this.DEFAULT_ORDER];
    },

    /**
     * Save tester order to localStorage
     */
    saveTesterOrder() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state.testerOrder));
        } catch (error) {
            console.warn('Failed to save tester order:', error);
        }
    },

    /**
     * Find existing drag handles in testing sections
     */
    createDragHandles() {
        this.elements.dragHandles = [];
        this.elements.testers.forEach(tester => {
            const dragHandle = tester.querySelector('.tester-drag-handle');
            if (dragHandle) {
                this.elements.dragHandles.push(dragHandle);
            }
        });
    },

    /**
     * Update drag handle references after tester swapping
     */
    updateDragHandleReferences() {
        this.elements.dragHandles = [];
        this.elements.testers.forEach(tester => {
            const dragHandle = tester.querySelector('.tester-drag-handle');
            if (dragHandle) {
                this.elements.dragHandles.push(dragHandle);
            }
        });
    },

    /**
     * Apply the current tester order to the DOM
     */
    applyTesterOrder() {
        const container = this.elements.testingContainer;

        // Store original positions for reference
        this.state.originalPositions.clear();
        this.elements.testers.forEach((tester, index) => {
            this.state.originalPositions.set(tester, index);
        });

        // Reorder testers based on saved order
        const reorderedTesters = [];
        this.state.testerOrder.forEach(testerId => {
            const tester = this.elements.testers.find(t => t.id === testerId);
            if (tester) {
                reorderedTesters.push(tester);
            }
        });

        // Add any testers not in saved order (for backward compatibility)
        this.elements.testers.forEach(tester => {
            if (!reorderedTesters.includes(tester)) {
                reorderedTesters.push(tester);
            }
        });

        // Re-append testers in the correct order
        reorderedTesters.forEach(tester => {
            container.appendChild(tester);
        });

        // Update elements.testers to match new order
        this.elements.testers = reorderedTesters;

        // Update tester order to match actual DOM order
        this.state.testerOrder = this.elements.testers.map(t => t.id);
    },

    /**
     * Setup event listeners for drag and drop
     */
    setupEventListeners() {
        this.setupDragHandleListeners();
        this.setupGlobalListeners();
        this.setupTesterHoverListeners();
    },

    /**
     * Setup drag handle listeners
     */
    setupDragHandleListeners() {
        // Clear existing listeners by cloning elements
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
                // Find current tester index dynamically
                const currentTesterIndex = this.findCurrentTesterIndex(handle);
                this.handleMouseDown(e, currentTesterIndex);
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
     * Setup tester hover listeners
     */
    setupTesterHoverListeners() {
        this.elements.testingContainer.addEventListener('mousemove', (e) => {
            if (this.state.isDragging) {
                this.detectDropZone(e);
            }
        });
    },

    /**
     * Find the current index of a tester based on its drag handle
     */
    findCurrentTesterIndex(handle) {
        const parentTester = handle.closest('.test-section');
        if (!parentTester) return -1;

        return this.elements.testers.findIndex(tester => tester === parentTester);
    },

    /**
     * Handle mouse down (start of drag)
     */
    handleMouseDown(e, index) {
        this.state.isDragging = true;
        this.state.draggedIndex = index;
        this.state.draggedTester = this.elements.testers[index];

        // Capture initial positions
        const rect = this.state.draggedTester.getBoundingClientRect();
        this.state.dragStartX = e.clientX;
        this.state.dragStartY = e.clientY;
        this.state.testerStartX = rect.left;
        this.state.testerStartY = rect.top;

        // Add dragging class for visual feedback
        this.state.draggedTester.classList.add('tester-dragging');
        document.body.classList.add('tester-drag-active');

        // Prevent text selection during drag
        document.body.style.userSelect = 'none';
    },

    /**
     * Handle mouse move (during drag)
     */
    handleMouseMove(e) {
        if (!this.state.isDragging || !this.state.draggedTester) return;

        this.state.mouseX = e.clientX;
        this.state.mouseY = e.clientY;

        const deltaX = e.clientX - this.state.dragStartX;
        const deltaY = e.clientY - this.state.dragStartY;

        // Apply transform to follow mouse
        this.state.draggedTester.style.transform = `
            translateX(${12 + deltaX}px)
            translateY(${-12 + deltaY}px)
            scale(1.02)
        `;
    },

    /**
     * Detect which position the dragged tester should be inserted
     */
    detectDropZone(e) {
        const draggedIndex = this.state.draggedIndex;
        if (!this.state.draggedTester) return;

        // Throttle detection to prevent too frequent updates
        const now = Date.now();
        if (now - this.state.lastDetectionTime < 16) return; // ~60fps
        this.state.lastDetectionTime = now;

        // Get the current position of the dragged tester
        const draggedRect = this.state.draggedTester.getBoundingClientRect();
        const draggedLeft = draggedRect.left;
        const draggedRight = draggedRect.right;

        // Get all other tester positions
        const testerRects = this.elements.testers.map((tester, index) => {
            if (index === draggedIndex) return null;
            return {
                index,
                rect: tester.getBoundingClientRect(),
                element: tester
            };
        }).filter(t => t !== null);

        // Determine insertion position based on edge crossover
        let insertPosition = draggedIndex;
        const crossovers = [];

        for (const testerData of testerRects) {
            const { index, rect } = testerData;
            const targetLeft = rect.left;
            const targetRight = rect.right;

            if (draggedIndex < index) {
                // Dragging to the right
                if (draggedLeft > targetLeft) {
                    crossovers.push(index);
                }
            } else {
                // Dragging to the left
                if (draggedRight < targetRight) {
                    crossovers.push(index);
                }
            }
        }

        // Find the furthest insertion position
        if (crossovers.length > 0) {
            if (draggedIndex < Math.max(...crossovers)) {
                insertPosition = Math.max(...crossovers);
            } else {
                insertPosition = Math.min(...crossovers);
            }
        }

        // Only update if position actually changed
        if (insertPosition !== this.state.dropZoneIndex) {
            this.state.dropZoneIndex = insertPosition;
            this.visualizeInsertion(draggedIndex, insertPosition);
        }
    },

    /**
     * Visualize where the tester will be inserted
     */
    visualizeInsertion(draggedIndex, insertPosition) {
        // Clear all previous states
        this.elements.testers.forEach(tester => {
            if (tester !== this.state.draggedTester) {
                tester.classList.remove('tester-make-room-left', 'tester-make-room-right', 'tester-preview-position');
                tester.style.transform = '';
            }
        });

        // Give DOM a moment to settle
        requestAnimationFrame(() => {
            // Calculate final layout
            const currentOrder = [...this.elements.testers];
            const previewOrder = [...currentOrder];

            if (insertPosition !== draggedIndex) {
                const draggedTester = previewOrder.splice(draggedIndex, 1)[0];
                previewOrder.splice(insertPosition, 0, draggedTester);
            }

            // Calculate how far each tester needs to move
            this.elements.testers.forEach((tester, currentIndex) => {
                if (currentIndex === draggedIndex) return;

                const previewIndex = previewOrder.findIndex(t => t === tester);
                const positionDifference = previewIndex - currentIndex;

                if (positionDifference !== 0) {
                    const testerWidth = tester.getBoundingClientRect().width;
                    const gap = 16; // Grid gap
                    const calculatedOffset = positionDifference * (testerWidth + gap);

                    tester.classList.add('tester-preview-position');
                    tester.style.transform = `translateX(${calculatedOffset}px)`;
                } else {
                    tester.classList.add('tester-preview-position');
                    tester.style.transform = '';
                }
            });
        });
    },

    /**
     * Handle mouse up (end of drag)
     */
    handleMouseUp(e) {
        if (!this.state.isDragging) return;

        // If we have a valid drop zone, perform the insertion
        if (this.state.dropZoneIndex !== -1 && this.state.dropZoneIndex !== this.state.draggedIndex) {
            this.insertTester(this.state.draggedIndex, this.state.dropZoneIndex);
            Utils.showNotification('Testing section layout updated! 🔄', 'success');
        }

        this.handleDragEnd();
    },

    /**
     * Handle drag end
     */
    handleDragEnd() {
        if (!this.state.isDragging) return;

        // Clean up visual feedback
        this.elements.testers.forEach(tester => {
            tester.classList.remove('tester-dragging', 'tester-drop-zone', 'tester-swap-animation', 'tester-make-room-left', 'tester-make-room-right', 'tester-preview-position');
            tester.style.transform = '';
        });
        document.body.classList.remove('tester-drag-active');

        // Restore text selection
        document.body.style.userSelect = '';

        // Reset state
        this.state.isDragging = false;
        this.state.draggedTester = null;
        this.state.draggedIndex = -1;
        this.state.dropZoneIndex = -1;
    },

    /**
     * Insert tester at a new position
     */
    insertTester(draggedIndex, insertPosition) {
        const container = this.elements.testingContainer;
        const draggedTester = this.elements.testers[draggedIndex];

        // Remove dragged tester from arrays
        const draggedTesterId = this.state.testerOrder.splice(draggedIndex, 1)[0];
        const draggedTesterElement = this.elements.testers.splice(draggedIndex, 1)[0];

        // Insert at new position
        this.state.testerOrder.splice(insertPosition, 0, draggedTesterId);
        this.elements.testers.splice(insertPosition, 0, draggedTesterElement);

        // Add animation class before DOM manipulation
        this.elements.testers.forEach(tester => tester.classList.add('tester-swap-animation'));

        // Use requestAnimationFrame to ensure smooth animation
        requestAnimationFrame(() => {
            // Rebuild DOM in new order
            this.elements.testers.forEach((tester, index) => {
                container.appendChild(tester);
            });

            // Save the new order
            this.saveTesterOrder();

            // Refresh drag handle references
            this.updateDragHandleReferences();

            // Refresh event listeners
            this.setupDragHandleListeners();

            // Remove animation class after animation completes
            setTimeout(() => {
                this.elements.testers.forEach(tester => {
                    tester.classList.remove('tester-swap-animation');
                });
            }, 300);
        });
    },

    /**
     * Reset testers to default order
     */
    resetToDefault() {
        this.state.testerOrder = [...this.DEFAULT_ORDER];
        this.applyTesterOrder();
        this.saveTesterOrder();
        Utils.showNotification('Testing section layout reset to default! 🔄', 'success');
    },

    /**
     * Get current tester order for debugging
     */
    getCurrentOrder() {
        return [...this.state.testerOrder];
    }
};

export default DragDropTesters;
