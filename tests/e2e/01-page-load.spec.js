// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Test 1: Basic Page Load
 *
 * Verifies that the application loads correctly with all essential elements.
 */
test.describe('Page Load Tests', () => {
  test('should load main page successfully', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/Redis ACL Builder/);

    // Check main UI elements are visible
    await expect(page.locator('h1')).toContainText('Redis ACL Builder');
    await expect(page.locator('#aclRule')).toBeVisible();
  });

  test('should load with default Redis 7 version', async ({ page }) => {
    await page.goto('/');

    // Check version detail text (not the toggle itself)
    const versionDetail = page.locator('#versionDetail');
    await expect(versionDetail).toBeVisible();
    await expect(versionDetail).toContainText('Redis 7');
    await expect(versionDetail).toContainText('21 categories, 379 commands');
  });

  test('should display three-column layout', async ({ page }) => {
    await page.goto('/');

    // Check three main columns exist
    await expect(page.locator('#blockedCategories')).toBeVisible();
    await expect(page.locator('#grantedCategories')).toBeVisible();
    await expect(page.locator('.acl-config-panel')).toBeVisible();
  });

  test('should load minified CSS successfully', async ({ page }) => {
    await page.goto('/');

    // Check that styles are applied (page has background color)
    const body = page.locator('body');
    const bgColor = await body.evaluate(el => window.getComputedStyle(el).backgroundColor);

    // Should have some background color (not empty or transparent)
    expect(bgColor).toBeTruthy();
    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('should load info page successfully', async ({ page }) => {
    await page.goto('/info');

    // Check page title
    await expect(page).toHaveTitle(/Info.*Redis ACL Builder/);

    // Check content is visible
    await expect(page.locator('h1')).toContainText('Redis ACL Builder');
    await expect(page.locator('body')).toContainText('What is Redis ACL Builder');
  });
});
