// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Test 8: Theme Switching
 *
 * Tests light/dark theme toggle functionality.
 */
test.describe('Theme Switching Tests', () => {
  test('should toggle between light and dark themes', async ({ page }) => {
    await page.goto('/');

    // Find theme toggle button
    const themeToggle = page.locator('#themeToggle');
    await expect(themeToggle).toBeVisible();

    // Get current theme from data-theme attribute
    const html = page.locator('html');
    const initialTheme = await html.getAttribute('data-theme');

    // Click to toggle
    await themeToggle.click();
    await page.waitForTimeout(300);

    // Theme should have changed
    const newTheme = await html.getAttribute('data-theme');
    expect(newTheme).not.toBe(initialTheme);

    // Should toggle between 'light' and 'dark'
    if (initialTheme === 'dark') {
      expect(newTheme).toBe('light');
    } else {
      expect(newTheme).toBe('dark');
    }
  });

  test('should persist theme preference', async ({ page }) => {
    await page.goto('/');

    // Toggle theme to dark
    const themeToggle = page.locator('#themeToggle');
    await expect(themeToggle).toBeVisible();

    const html = page.locator('html');
    const initialTheme = await html.getAttribute('data-theme');

    // Toggle the theme
    await themeToggle.click();
    await page.waitForTimeout(300);

    const themeAfterToggle = await html.getAttribute('data-theme');

    // Reload page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Theme should be preserved from localStorage
    const themeAfterReload = await html.getAttribute('data-theme');
    expect(themeAfterReload).toBe(themeAfterToggle);
  });
});
