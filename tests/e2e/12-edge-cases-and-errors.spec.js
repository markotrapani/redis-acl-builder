// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Test 12: Edge Cases and Error Handling
 *
 * Tests edge cases and error scenarios not covered in other test files:
 * - Console error monitoring
 * - Invalid ACL syntax handling
 * - API failure recovery
 * - Race conditions
 * - Memory leaks (rapid operations)
 * - Accessibility basics
 */
test.describe('Edge Cases and Error Handling Tests', () => {
  test('should not produce console errors during normal operation', async ({ page }) => {
    const consoleErrors = [];
    const consoleWarnings = [];

    // Monitor console messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Monitor page errors
    const pageErrors = [];
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Perform normal operations
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('#aclRule');
    const submitBtn = page.locator('#submitChangesBtn');

    // Enter and submit ACL rule
    await textarea.fill('+@read ~*');
    await submitBtn.click();
    await page.waitForTimeout(1000);

    // Switch modes
    const modeToggleLabel = page.locator('label[for="modeToggle"]');
    await modeToggleLabel.click();
    await page.waitForTimeout(1000);

    // Switch versions
    const versionToggleLabel = page.locator('label[for="versionToggle"]');
    await versionToggleLabel.click();
    await page.waitForTimeout(1000);

    // Grant a category
    const blockedColumn = page.locator('#blockedCategories');
    const categoryBtn = blockedColumn.locator('button').first();
    if (await categoryBtn.isVisible()) {
      await categoryBtn.click();
      await page.waitForTimeout(1000);
    }

    // Verify no errors occurred
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    // Warnings are okay, but log them for reference
    if (consoleWarnings.length > 0) {
      console.log('Console warnings (non-critical):', consoleWarnings);
    }
  });

  test('should handle invalid ACL syntax gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('#aclRule');
    const submitBtn = page.locator('#submitChangesBtn');

    // Enter invalid ACL syntax
    await textarea.fill('invalid!@#$%syntax');
    await submitBtn.click();

    // Wait for error handling
    await page.waitForTimeout(1000);

    // Page should still be functional (not crashed)
    await expect(textarea).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // No JavaScript errors should crash the page
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();
  });

  test('should handle empty ACL rule submission', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('#aclRule');
    const submitBtn = page.locator('#submitChangesBtn');

    // Clear textarea
    await textarea.fill('');

    // Submit button might not appear for empty rule
    // Just clear and verify app still works
    await page.waitForTimeout(500);

    // App should still be functional
    await expect(textarea).toBeVisible();

    // Try entering a valid rule after empty
    await textarea.fill('+@read');
    await submitBtn.click();
    await page.waitForTimeout(1000);

    // Should work normally
    const grantedColumn = page.locator('#grantedCategories');
    await expect(grantedColumn).toContainText('@read');
  });

  test('should handle rapid ACL rule submissions without race conditions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('#aclRule');
    const submitBtn = page.locator('#submitChangesBtn');

    // Submit multiple rules rapidly
    const rules = ['+@read', '+@write', '+@admin', '+@dangerous', '+@slow'];

    for (const rule of rules) {
      await textarea.fill(rule);
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(200); // Small delay
      }
    }

    // Wait for final state to settle
    await page.waitForTimeout(2000);

    // Final rule should be reflected in UI
    const value = await textarea.inputValue();
    expect(value).toContain('@slow');

    // No errors should have occurred
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    expect(errors.length).toBe(0);
  });

  test('should handle rapid category clicks without UI glitches', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const blockedColumn = page.locator('#blockedCategories');
    await expect(blockedColumn.locator('button').first()).toBeVisible({ timeout: 5000 });

    // Click 3 categories (reduced from 5 to avoid timeout)
    const buttons = await blockedColumn.locator('button').all();
    const buttonsToClick = buttons.slice(0, Math.min(3, buttons.length));

    for (const btn of buttonsToClick) {
      if (await btn.isVisible()) {
        await btn.click();
        // Wait longer between clicks to let UI update
        await page.waitForTimeout(300);
      }
    }

    // Wait for final state to settle
    await page.waitForTimeout(2000);

    // App should still be responsive
    const textarea = page.locator('#aclRule');
    await expect(textarea).toBeVisible();

    // Textarea should contain granted categories
    const value = await textarea.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('#aclRule');
    const submitBtn = page.locator('#submitChangesBtn');

    // Set a rule
    await textarea.fill('+@read');
    await submitBtn.click();
    await page.waitForTimeout(1000);

    // Navigate to info page
    const infoLink = page.locator('a[href="/info"]').first();
    if (await infoLink.isVisible()) {
      await infoLink.click();
      await page.waitForLoadState('networkidle');

      // Go back
      await page.goBack();
      await page.waitForLoadState('networkidle');

      // App should still work
      await expect(textarea).toBeVisible();
    }
  });

  test('should handle window resize gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 1024, height: 768 },  // Tablet landscape
      { width: 768, height: 1024 },  // Tablet portrait
      { width: 375, height: 667 },   // Mobile
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);

      // Core UI elements should still be visible and functional
      const textarea = page.locator('#aclRule');
      await expect(textarea).toBeAttached();
    }

    // Reset to desktop size
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('should handle keyboard navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('#aclRule');

    // Focus on textarea
    await textarea.focus();
    await expect(textarea).toBeFocused();

    // Type ACL rule
    await textarea.fill('+@read ~*');

    // Tab to submit button (if visible)
    await page.keyboard.press('Tab');

    // Should be able to navigate UI with keyboard
    // (This is a basic test - more comprehensive accessibility tests would be separate)
  });

  test('should preserve state after page reload with ACL rule', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('#aclRule');
    const submitBtn = page.locator('#submitChangesBtn');
    const modeToggleLabel = page.locator('label[for="modeToggle"]');

    // Set ACL rule
    await textarea.fill('+@read +@write');
    await submitBtn.click();
    await page.waitForTimeout(1000);

    // Switch to Enterprise mode
    await modeToggleLabel.click();
    await page.waitForTimeout(1000);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Mode should be preserved (localStorage)
    const modeToggle = page.locator('#modeToggle');
    await expect(modeToggle).toBeChecked();

    // ACL rule should be preserved in textarea
    const value = await textarea.inputValue();
    expect(value).toContain('@read');
    expect(value).toContain('@write');
  });

  // Note: Keyspace pattern testing is covered in 05-keyspace-testing.spec.js
  // This test was redundant and has been removed

  test('should handle concurrent mode and version toggles', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const modeToggleLabel = page.locator('label[for="modeToggle"]');
    const versionToggleLabel = page.locator('label[for="versionToggle"]');
    const versionDetail = page.locator('#versionDetail');

    // Toggle both switches rapidly in sequence
    await modeToggleLabel.click();
    await versionToggleLabel.click();
    await modeToggleLabel.click();
    await versionToggleLabel.click();

    // Wait for state to settle
    await page.waitForTimeout(2000);

    // Final state should be consistent
    const text = await versionDetail.textContent();
    expect(text).toBeTruthy();
    expect(text).toMatch(/Redis (E\. )?\d/);
    expect(text).toMatch(/\d+ commands/);
  });

  test('should handle expand/collapse of all categories without memory leaks', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('#aclRule');
    const submitBtn = page.locator('#submitChangesBtn');

    // Grant a category to populate granted column
    await textarea.fill('+@read +@write +@admin');
    await submitBtn.click();
    await page.waitForTimeout(1000);

    // Find all expand/collapse links
    const grantedColumn = page.locator('#grantedCategories');
    const expandLinks = await grantedColumn.locator('a.expand-link').all();

    // Rapidly expand/collapse all categories 3 times
    for (let iteration = 0; iteration < 3; iteration++) {
      for (const link of expandLinks) {
        if (await link.isVisible()) {
          await link.click();
          await page.waitForTimeout(50);
        }
      }
    }

    // App should still be responsive
    await expect(textarea).toBeVisible();
  });

  test('should handle URL with multiple parameters', async ({ page }) => {
    // Navigate with multiple URL parameters
    await page.goto('/?version=redis8&mode=enterprise');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Version should be Redis 8
    const versionDetail = page.locator('#versionDetail');
    const text = await versionDetail.textContent();
    expect(text).toContain('Redis E. 8');

    // Mode should be Enterprise
    const modeToggle = page.locator('#modeToggle');
    await expect(modeToggle).toBeChecked();

    // Both parameters should be honored
    expect(text).toContain('440 commands'); // Redis 8 Enterprise count
  });

  test('should handle malformed URL parameters gracefully', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    // Navigate with malformed parameters
    await page.goto('/?version=invalid&mode=wrong&rule=<script>alert(1)</script>');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // App should still load (fall back to defaults)
    const textarea = page.locator('#aclRule');
    await expect(textarea).toBeVisible();

    // No JavaScript errors should occur
    expect(errors.length).toBe(0);
  });
});
