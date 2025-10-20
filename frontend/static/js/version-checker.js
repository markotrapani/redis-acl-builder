/**
 * Version checker module for Docker update detection
 */

export class VersionChecker {
    constructor() {
        this.checkInProgress = false;
    }

    /**
     * Check for Docker image updates
     * @returns {Promise<Object>} Update information
     */
    async checkForUpdates() {
        if (this.checkInProgress) {
            return { error: 'Update check already in progress' };
        }

        this.checkInProgress = true;

        try {
            const response = await fetch('/api/check-updates');
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error checking for updates:', error);
            return {
                error: `Network error: ${error.message}`
            };
        } finally {
            this.checkInProgress = false;
        }
    }

    /**
     * Display update notification modal
     * @param {Object} updateInfo - Update information from API
     */
    showUpdateModal(updateInfo) {
        // Remove existing modal if present
        const existingModal = document.getElementById('update-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'update-modal';
        modal.className = 'update-modal';

        let content;

        if (updateInfo.error) {
            content = `
                <div class="update-modal-content">
                    <h2>Update Check Failed</h2>
                    <p class="error-message">${this.escapeHtml(updateInfo.error)}</p>
                    <p>Current version: <strong>${this.escapeHtml(updateInfo.current_version || 'unknown')}</strong></p>
                    <button class="close-modal-btn">Close</button>
                </div>
            `;
        } else if (updateInfo.update_available) {
            content = `
                <div class="update-modal-content">
                    <h2>🎉 Update Available!</h2>
                    <p>A new version is available.</p>
                    <div class="version-info">
                        <p>Current version: <strong>${this.escapeHtml(updateInfo.current_version)}</strong></p>
                        <p>Latest version: <strong class="highlight">${this.escapeHtml(updateInfo.latest_version)}</strong></p>
                    </div>

                    <h3>Upgrade Instructions:</h3>
                    <p>Run this command to upgrade your Docker installation:</p>

                    <div class="code-block">
                        <code>${this.escapeHtml(updateInfo.docker_upgrade_command)}</code>
                        <button class="copy-btn" data-copy="${this.escapeHtml(updateInfo.docker_upgrade_command)}">Copy</button>
                    </div>

                    <p style="margin-top: 15px; font-style: italic; color: #666;">After running the command, refresh your browser to load the updated version.</p>

                    <button class="close-modal-btn">Close</button>
                </div>
            `;
        } else {
            content = `
                <div class="update-modal-content">
                    <h2>✅ You're Up to Date!</h2>
                    <p>You're running the latest version.</p>
                    <div class="version-info">
                        <p>Current version: <strong>${this.escapeHtml(updateInfo.current_version)}</strong></p>
                        <p>Latest version: <strong>${this.escapeHtml(updateInfo.latest_version)}</strong></p>
                    </div>
                    <button class="close-modal-btn">Close</button>
                </div>
            `;
        }

        modal.innerHTML = content;
        document.body.appendChild(modal);

        // Add event listeners
        const closeBtn = modal.querySelector('.close-modal-btn');
        closeBtn.addEventListener('click', () => this.closeModal());

        const copyBtns = modal.querySelectorAll('.copy-btn');
        copyBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const textToCopy = e.target.getAttribute('data-copy');
                this.copyToClipboard(textToCopy, e.target);
            });
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    /**
     * Close the update modal
     */
    closeModal() {
        const modal = document.getElementById('update-modal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     * @param {HTMLElement} button - Button element to show feedback
     */
    async copyToClipboard(text, button) {
        try {
            await navigator.clipboard.writeText(text);
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            button.classList.add('copied');
            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('copied');
            }, 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
            button.textContent = 'Failed';
            setTimeout(() => {
                button.textContent = 'Copy';
            }, 2000);
        }
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
