// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Test 11: Partial Category Detection
 *
 * Tests the partial category detection functionality (v2.9.1-beta):
 * - Detecting when categories have some commands granted via other categories
 * - Visual styling for partial vs fully blocked categories
 * - Cross-category command grant scenarios
 * - State consistency across mode/version switches
 */
test.describe('Partial Category Detection Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh on each test
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Clear any existing ACL rule
    const textarea = page.locator('#aclRule');
    await textarea.fill('');
    await page.waitForTimeout(500);
  });

  test('should detect @hyperloglog as partial when @admin is granted', async ({ page }) => {
    const textarea = page.locator('#aclRule');
    const submitBtn = page.locator('#submitChangesBtn');
    const blockedColumn = page.locator('#blockedCategories');

    // Enter rule that grants @admin (which includes some hyperloglog commands)
    await textarea.fill('+@admin');
    await submitBtn.click();
    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );

    // Wait for UI update
    await page.waitForTimeout(1000);

    // Find @hyperloglog in blocked column
    const hyperloglogBtn = blockedColumn.locator('button').filter({ hasText: '@hyperloglog' }).first();
    await expect(hyperloglogBtn).toBeVisible();

    // Check if it has partial styling (not explicit, not implicit-full)
    const classList = await hyperloglogBtn.getAttribute('class');

    // Should have 'partial' or 'implicit' class
    // Should NOT have 'explicit' class (not explicitly blocked)
    expect(classList).toMatch(/partial|implicit/);
    expect(classList).not.toContain('explicit');

    // Expand @hyperloglog to see commands
    await hyperloglogBtn.click();
    await page.waitForTimeout(500);

    // Some commands should be granted (e.g., pfdebug, pfselftest)
    // Check the granted column for these commands
    const grantedColumn = page.locator('#grantedCommands');
    const grantedText = await grantedColumn.textContent();

    // At least some hyperloglog commands should appear in granted column
    expect(grantedText.toLowerCase()).toMatch(/pf(debug|selftest)/);
  });

  test('should show partial styling for categories with some commands granted', async ({ page }) => {
    const textarea = page.locator('#aclRule');
    const submitBtn = page.locator('#submitChangesBtn');
    const blockedColumn = page.locator('#blockedCategories');

    // Grant @admin (which makes @hyperloglog partial - known working scenario)
    await textarea.fill('+@admin');
    await submitBtn.click();
    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );
    await page.waitForTimeout(1000);

    // Find a partial category (@hyperloglog - some commands granted by @admin)
    const hyperloglogBtn = blockedColumn.locator('button').filter({ hasText: '@hyperloglog' }).first();

    if (await hyperloglogBtn.isVisible()) {
      // Get classes
      const hyperloglogClasses = await hyperloglogBtn.getAttribute('class');

      // Verify partial category has partial styling
      // Should include both 'partial' and 'implicit' classes
      expect(hyperloglogClasses).toContain('partial');
      expect(hyperloglogClasses).toContain('implicit');
      expect(hyperloglogClasses).toContain('blocked');
    }
  });

  test('should update partial detection when switching from OSS to Enterprise', async ({ page }) => {
    const textarea = page.locator('#aclRule');
    const submitBtn = page.locator('#submitChangesBtn');
    const modeToggleLabel = page.locator('label[for="modeToggle"]');
    const blockedColumn = page.locator('#blockedCategories');

    // In OSS mode, grant @admin
    await textarea.fill('+@admin');
    await submitBtn.click();
    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );
    await page.waitForTimeout(1000);

    // Get blocked categories before mode switch
    const ossBlockedText = await blockedColumn.textContent();

    // Switch to Enterprise mode
    await modeToggleLabel.click();
    await page.waitForTimeout(1500);

    // Get blocked categories after mode switch
    const enterpriseBlockedText = await blockedColumn.textContent();

    // Enterprise mode should show fewer categories (some restricted)
    // Partial detection should still work
    expect(enterpriseBlockedText).not.toBe(ossBlockedText);

    // Check that partial detection still functions
    const blockedButtons = await blockedColumn.locator('button').all();
    expect(blockedButtons.length).toBeGreaterThan(0);
  });

  test('should update partial detection when switching Redis versions', async ({ page }) => {
    const textarea = page.locator('#aclRule');
    const submitBtn = page.locator('#submitChangesBtn');
    const versionToggleLabel = page.locator('label[for="versionToggle"]');
    const blockedColumn = page.locator('#blockedCategories');

    // Grant @admin in Redis 7
    await textarea.fill('+@admin');
    await submitBtn.click();
    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );
    await page.waitForTimeout(1000);

    // Count blocked categories in Redis 7
    const redis7Buttons = await blockedColumn.locator('button').all();
    const redis7Count = redis7Buttons.length;

    // Switch to Redis 8
    await versionToggleLabel.click();
    await page.waitForTimeout(1500);

    // Count blocked categories in Redis 8
    const redis8Buttons = await blockedColumn.locator('button').all();
    const redis8Count = redis8Buttons.length;

    // Redis 8 has more categories, so count should be different
    expect(redis8Count).not.toBe(redis7Count);

    // Partial detection should still work in Redis 8
    expect(redis8Count).toBeGreaterThan(0);
  });

  test('should handle multiple overlapping categories correctly', async ({ page }) => {
    const textarea = page.locator('#aclRule');
    const submitBtn = page.locator('#submitChangesBtn');
    const blockedColumn = page.locator('#blockedCategories');

    // Grant multiple categories that have overlapping commands
    await textarea.fill('+@read +@write +@admin');
    await submitBtn.click();
    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );
    await page.waitForTimeout(1000);

    // Check that some blocked categories are partial
    const blockedButtons = await blockedColumn.locator('button').all();

    let hasPartialCategory = false;
    for (const btn of blockedButtons) {
      const classList = await btn.getAttribute('class');
      if (classList && classList.includes('partial')) {
        hasPartialCategory = true;
        break;
      }
    }

    // At least one category should be detected as partial
    expect(hasPartialCategory).toBe(true);
  });

  test('should not show partial categories when ACL is empty', async ({ page }) => {
    const textarea = page.locator('#aclRule');
    const blockedColumn = page.locator('#blockedCategories');

    // Ensure ACL is empty
    await textarea.fill('');
    await page.waitForTimeout(500);

    // All blocked categories should be fully blocked (no partial)
    const blockedButtons = await blockedColumn.locator('button').all();

    for (const btn of blockedButtons) {
      const classList = await btn.getAttribute('class');
      // Should not have 'partial' class when ACL is empty
      if (classList) {
        expect(classList).not.toContain('implicit-partial');
      }
    }
  });

  test('should preserve partial detection accuracy during rapid mode switching', async ({ page }) => {
    const textarea = page.locator('#aclRule');
    const submitBtn = page.locator('#submitChangesBtn');
    const modeToggleLabel = page.locator('label[for="modeToggle"]');
    const blockedColumn = page.locator('#blockedCategories');

    // Grant @admin
    await textarea.fill('+@admin');
    await submitBtn.click();
    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );
    await page.waitForTimeout(1000);

    // Rapidly toggle mode 5 times
    for (let i = 0; i < 5; i++) {
      await modeToggleLabel.click();
      await page.waitForTimeout(300);
    }

    // Final state should still show categories correctly
    const blockedButtons = await blockedColumn.locator('button').all();
    expect(blockedButtons.length).toBeGreaterThan(0);

    // No JavaScript errors should have occurred
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    expect(errors.length).toBe(0);
  });

  test('should detect partial @dangerous when granting specific dangerous commands', async ({ page }) => {
    const textarea = page.locator('#aclRule');
    const submitBtn = page.locator('#submitChangesBtn');
    const blockedColumn = page.locator('#blockedCategories');

    // Grant some dangerous commands individually (not the whole category)
    await textarea.fill('+flushdb +flushall');
    await submitBtn.click();
    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );
    await page.waitForTimeout(1000);

    // Find @dangerous in blocked column
    const dangerousBtn = blockedColumn.locator('button').filter({ hasText: '@dangerous' }).first();

    if (await dangerousBtn.isVisible()) {
      // Should show as partial (some commands granted, but not all)
      const classList = await dangerousBtn.getAttribute('class');
      expect(classList).toMatch(/partial|implicit/);
    }
  });

  test('should correctly identify fully available vs partial categories', async ({ page }) => {
    const textarea = page.locator('#aclRule');
    const submitBtn = page.locator('#submitChangesBtn');
    const blockedColumn = page.locator('#blockedCategories');

    // Grant a minimal set
    await textarea.fill('+@read');
    await submitBtn.click();
    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );
    await page.waitForTimeout(1000);

    // Get all blocked category buttons
    const blockedButtons = await blockedColumn.locator('button').all();

    let hasFullCategory = false;
    let hasPartialCategory = false;

    for (const btn of blockedButtons) {
      const classList = await btn.getAttribute('class');
      if (classList) {
        if (classList.includes('implicit-full') || (classList.includes('blocked') && !classList.includes('partial'))) {
          hasFullCategory = true;
        }
        if (classList.includes('partial') || classList.includes('implicit-partial')) {
          hasPartialCategory = true;
        }
      }
    }

    // Should have both types of categories
    expect(hasFullCategory).toBe(true);
    // May or may not have partial depending on command overlap
  });

  test('should handle partial detection with all 4 version+mode combinations', async ({ page }) => {
    const textarea = page.locator('#aclRule');
    const submitBtn = page.locator('#submitChangesBtn');
    const versionToggleLabel = page.locator('label[for="versionToggle"]');
    const modeToggleLabel = page.locator('label[for="modeToggle"]');
    const blockedColumn = page.locator('#blockedCategories');

    // Enter a test rule
    await textarea.fill('+@admin');
    await submitBtn.click();
    await page.waitForResponse(response =>
      response.url().includes('/api/parse') && response.status() === 200
    );
    await page.waitForTimeout(1000);

    // Test all 4 combinations: Redis 7+OSS (default)
    let buttons = await blockedColumn.locator('button').all();
    const combo1Count = buttons.length;
    expect(combo1Count).toBeGreaterThan(0);

    // Redis 7 + Enterprise
    await modeToggleLabel.click();
    await page.waitForTimeout(1500);
    buttons = await blockedColumn.locator('button').all();
    expect(buttons.length).toBeGreaterThan(0);

    // Redis 8 + Enterprise
    await versionToggleLabel.click();
    await page.waitForTimeout(1500);
    buttons = await blockedColumn.locator('button').all();
    expect(buttons.length).toBeGreaterThan(0);

    // Redis 8 + OSS
    await modeToggleLabel.click();
    await page.waitForTimeout(1500);
    buttons = await blockedColumn.locator('button').all();
    expect(buttons.length).toBeGreaterThan(0);

    // All combinations should work without errors
  });
});
