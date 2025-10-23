// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Test 3: Interactive ACL Builder
 *
 * Tests the interactive column-based ACL rule building functionality.
 */
test.describe('Interactive ACL Builder Tests', () => {
  test('should grant category by clicking in blocked column', async ({ page }) => {
    await page.goto('/');

    // Wait for page to fully load and interactive builder to initialize
    await page.waitForLoadState('domcontentloaded');

    // Wait for the blocked categories section to have buttons
    const blockedColumn = page.locator('#blockedCategories');
    await expect(blockedColumn.locator('button').first()).toBeVisible({ timeout: 5000 });

    // Find @read category button in blocked column
    const categoryBtn = blockedColumn.locator('button').filter({ hasText: '@read' }).first();

    // Click to grant
    await categoryBtn.click();

    // Wait for UI update (API call may be cached)
    await page.waitForTimeout(500);

    // Check it moved to granted column
    const grantedColumn = page.locator('#grantedCategories');
    await expect(grantedColumn).toContainText('@read');

    // Check textarea updated
    const textarea = page.locator('#aclRule');
    const value = await textarea.inputValue();
    expect(value).toContain('@read');
  });

  test('should revoke category by clicking in granted column', async ({ page }) => {
    await page.goto('/');

    // Wait for blocked categories to load
    const blockedColumn = page.locator('#blockedCategories');
    await expect(blockedColumn.locator('button').first()).toBeVisible({ timeout: 5000 });

    // First grant a category
    const categoryBtn = blockedColumn.locator('button').filter({ hasText: '@read' }).first();
    await categoryBtn.click();
    await page.waitForTimeout(500); // Wait for UI update (API call may be cached)

    // Now revoke it
    const grantedColumn = page.locator('#grantedCategories');
    const grantedBtn = grantedColumn.locator('button').filter({ hasText: '@read' }).first();
    await grantedBtn.click();

    await page.waitForTimeout(500); // Wait for UI update (API call may be cached)

    // Should be back in blocked column
    await expect(blockedColumn).toContainText('@read');
  });

  test('should expand/collapse categories', async ({ page }) => {
    await page.goto('/');

    // Grant a category first
    const blockedColumn = page.locator('#blockedCategories');
    const readBtn = blockedColumn.locator('button').filter({ hasText: '@read' }).first();
    await readBtn.click();
    await page.waitForTimeout(300);

    // Find the expand/collapse link
    const grantedColumn = page.locator('#grantedCategories');
    const expandLink = grantedColumn.locator('a.expand-link').first();

    if (await expandLink.isVisible()) {
      // Get current text
      const linkText = await expandLink.textContent();

      // Click to toggle
      await expandLink.click();
      await page.waitForTimeout(200);

      // Text should have changed
      const newText = await expandLink.textContent();
      expect(newText).not.toBe(linkText);
    }
  });

  test('should show category tooltips on hover', async ({ page }) => {
    await page.goto('/');

    // Hover over a category button
    const blockedColumn = page.locator('#blockedCategories');
    const categoryBtn = blockedColumn.locator('button').filter({ hasText: '@read' }).first();

    await categoryBtn.hover();

    // Wait for tooltip (they have 1s delay)
    await page.waitForTimeout(1200);

    // Check if tooltip is visible
    const tooltip = page.locator('.enhanced-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 2000 });
  });
});
