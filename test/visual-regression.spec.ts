import { test, expect, type Locator } from '@playwright/test';

test('visual regression', async ({ page }) => {
  async function monitoredClick(locator: Locator) {
    await locator.hover();
    await expect.soft(page).toHaveScreenshot();
    await page.mouse.down();
    await expect.soft(page).toHaveScreenshot();
    await page.mouse.up();
    await expect.soft(page).toHaveScreenshot();
  };

  test.setTimeout(3 * 60 * 1000);
  await page.setViewportSize({ width: 720, height: 720 });

  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('ffxiv-gearing.dt.promotion', '{}'));
  await expect.soft(page).toHaveScreenshot();
  await monitoredClick(page.getByRole('link', { name: '烹调师' }));
  await monitoredClick(page.getByRole('button', { name: '魔晶石' }));
  await monitoredClick(page.locator('css=.mdc-switch'));

  await page.setViewportSize({ width: 1080, height: 720 });
  await expect.soft(page).toHaveScreenshot();

  await page.goto('/?XfhfdubLR2sevCf9Tt0LEnEwO2hOBoF4J0fpgsordNU');
  await expect.soft(page).toHaveScreenshot();
  await monitoredClick(page.getByRole('button', { name: '显示阈值(差值)' }));
  await monitoredClick(page.getByRole('button', { name: '编辑' }));

  await monitoredClick(page.locator('css=.condition_job'));
  await monitoredClick(page.locator('css=.condition_level-input').nth(0));

  await page.locator('css=.condition_level-input').nth(1).hover();
  await expect.soft(page).toHaveScreenshot();
  await page.mouse.wheel(0, 10);
  await expect.soft(page).toHaveScreenshot();

  await monitoredClick(page.getByRole('button', { name: '筛选' }));
  await monitoredClick(page.getByRole('button', { name: '品级同步' }));
  await monitoredClick(page.getByText('90级'));
  await monitoredClick(page.getByRole('button', { name: '魔晶石' }));
  await monitoredClick(page.getByText('信念/直击分配优化'));
  await monitoredClick(page.getByRole('button', { name: '分享' }));
  await page.locator('css=.share_url').hover();
  await expect.soft(page).toHaveScreenshot();
  await monitoredClick(page.getByRole('button', { name: '导入' }));

  await monitoredClick(page.locator('css=.gears_name').nth(0));  // should close dropdown only
  await monitoredClick(page.locator('css=.gears_more').nth(1));
  await monitoredClick(page.getByText('复制道具名'));
  await monitoredClick(page.locator('css=.gears_name').nth(2));

  await monitoredClick(page.locator('css=.gears_materia').nth(10));
  await monitoredClick(page.getByText('+36').first());
  await monitoredClick(page.locator('css=.gears_materia').nth(11));

  await monitoredClick(page.getByRole('button', { name: '设置' }));
  await monitoredClick(page.getByText('浅色（高饱和）'));
  await monitoredClick(page.getByText('深色'));

  await monitoredClick(page.locator('css=.gears_materia').nth(28));
  await page.mouse.wheel(0, 100);
  await expect.soft(page).toHaveScreenshot();

  await monitoredClick(page.locator('css=.summary_clan'));

  await page.keyboard.press('Escape');
  await expect.soft(page).toHaveScreenshot();

  await page.locator('css=.summary_damage-tip').hover();
  await expect.soft(page).toHaveScreenshot();

  await page.keyboard.press('End');
  await expect.soft(page).toHaveScreenshot();

  await monitoredClick(page.getByRole('button', { name: '隐藏阈值(差值)' }));

  await page.goBack();
  await expect.soft(page).toHaveScreenshot();

  await page.goBack();
  await expect.soft(page).toHaveScreenshot();

  await page.goBack();
  await expect.soft(page).toHaveScreenshot();
});
