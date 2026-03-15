import { test, expect } from '@playwright/test';

test.describe('MuJoCo Simulator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads and canvas is rendered', async ({ page }) => {
    // Wait for canvas to appear (Three.js renders into it)
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 30000 });
  });

  test('control panel is visible after loading', async ({ page }) => {
    // Wait for the simulator to initialize — control panel appears after load
    await page.waitForSelector('canvas', { timeout: 30000 });

    // Robot model selector should exist
    const modelSelect = page.locator('select').first();
    await expect(modelSelect).toBeVisible({ timeout: 15000 });
  });

  test('all three robot models are listed in dropdown', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 30000 });
    const modelSelect = page.locator('select').first();
    await expect(modelSelect).toBeVisible({ timeout: 15000 });

    const options = modelSelect.locator('option');
    await expect(options).toHaveCount(3);
    await expect(options.nth(0)).toHaveText('Humanoid');
    await expect(options.nth(1)).toHaveText('Unitree Go2');
    await expect(options.nth(2)).toHaveText('Unitree H1');
  });

  test('action dropdown contains expected options', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 30000 });
    const actionSelect = page.locator('select').nth(1);
    await expect(actionSelect).toBeVisible({ timeout: 15000 });

    const options = actionSelect.locator('option');
    await expect(options).toHaveCount(5);
  });

  test('Reset button is visible and clickable', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 30000 });
    const resetButton = page.getByRole('button', { name: /reset/i });
    await expect(resetButton).toBeVisible({ timeout: 15000 });
    await expect(resetButton).toBeEnabled();
    // Should not crash on click
    await resetButton.click();
  });

  test('Pause button toggles to Resume', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 30000 });
    const pauseButton = page.getByRole('button', { name: /pause/i });
    await expect(pauseButton).toBeVisible({ timeout: 15000 });

    await pauseButton.click();

    // After clicking, it should say Resume
    const resumeButton = page.getByRole('button', { name: /resume/i });
    await expect(resumeButton).toBeVisible();

    // Toggle back
    await resumeButton.click();
    await expect(page.getByRole('button', { name: /pause/i })).toBeVisible();
  });

  test('RUNNING status indicator is shown initially', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 30000 });
    await page.waitForSelector('text=RUNNING', { timeout: 15000 });
    await expect(page.getByText(/RUNNING/)).toBeVisible();
  });

  test('page title is set correctly', async ({ page }) => {
    await expect(page).toHaveTitle(/Shiven/);
  });
});
