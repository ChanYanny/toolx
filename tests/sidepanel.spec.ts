import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 360, height: 820 }, reducedMotion: 'reduce' });

test('side panel navigation, favorites, search and keyboard shortcut preserve drafts', async ({ page }) => {
  await page.goto('/?view=sidepanel');
  await expect(page.locator('.sidepanel-tool')).toHaveCount(7);
  await page.getByLabel('收藏JSON 格式化', { exact: true }).click();
  await page.getByRole('button', { name: /收藏 1/ }).click();
  await expect(page.locator('.sidepanel-tool')).toHaveCount(1);
  await page.getByRole('link', { name: /JSON 格式化 JSON Formatter/ }).click();
  await page.getByRole('textbox', { name: '输入内容', exact: true }).fill('{"draft":"保留输入"}');
  await page.getByRole('button', { name: '格式化 JSON', exact: true }).click();
  await page.keyboard.press('ControlOrMeta+k');
  const search = page.getByRole('textbox', { name: '搜索工具', exact: true });
  await expect(search).toBeFocused();
  await search.fill('base64');
  await expect(page.locator('.sidepanel-tool')).toHaveCount(1);
  await page.getByRole('link', { name: /Base64 编解码 Base64 Encoder/ }).click();
  await page.getByRole('textbox', { name: '输入内容', exact: true }).fill('侧边栏 👋');
  await page.getByRole('button', { name: '开始编码' }).click();
  await page.getByRole('button', { name: '反向转换' }).click();
  await page.getByRole('button', { name: '开始解码' }).click();
  await expect(page.locator('.code-output:visible')).toHaveText('侧边栏 👋');
  await page.getByRole('link', { name: '全部工具', exact: true }).click();
  await search.fill('');
  await page.getByRole('button', { name: '最近', exact: true }).click();
  await expect(page.locator('.sidepanel-tool')).toHaveCount(2);
  await page.getByRole('link', { name: /JSON 格式化 JSON Formatter/ }).click();
  await expect(page.getByRole('textbox', { name: '输入内容', exact: true })).toHaveValue('{"draft":"保留输入"}');
  await expect(page.locator('.code-output:visible')).toContainText('"draft": "保留输入"');
  await expect(page.getByRole('link', { name: '在标签页打开', exact: true })).toHaveAttribute('href', 'http://127.0.0.1:4173/#json');
  await page.getByLabel('切换深色或浅色主题').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'artifacts/sidepanel-dark.png' });
});

test('all tools remain usable at narrow side panel widths', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/?view=sidepanel#json');
  await page.getByRole('button', { name: '载入示例', exact: true }).click();
  await page.getByRole('button', { name: '转义', exact: true }).click();
  await page.getByRole('button', { name: '回填输入', exact: true }).click();
  await page.getByRole('button', { name: '去转义', exact: true }).click();
  await expect(page.locator('.code-output:visible')).toContainText('"project":"ToolX"');
  const run = await page.getByRole('button', { name: '格式化 JSON', exact: true }).boundingBox();
  const output = await page.locator('.code-output:visible').boundingBox();
  expect(run!.y).toBeLessThan(output!.y);
  const noOverflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await noOverflow();

  await page.getByRole('link', { name: '全部工具', exact: true }).click();
  await page.getByRole('link', { name: /URL 编解码 URL Encoder/ }).click();
  await page.getByRole('textbox', { name: '输入内容', exact: true }).fill('hello world');
  await page.getByRole('button', { name: '开始编码' }).click();
  await expect(page.locator('.code-output:visible')).toHaveText('hello%20world');
  await noOverflow();

  await page.getByRole('link', { name: '全部工具', exact: true }).click();
  await page.getByRole('link', { name: /时间戳转换 Timestamp Converter/ }).click();
  await page.getByLabel('Unix 时间戳', { exact: true }).fill('0');
  await page.getByRole('button', { name: '转换为日期', exact: true }).click();
  await expect(page.locator('.result-list:visible')).toContainText('1970-01-01T00:00:00.000Z');
  await noOverflow();

  await page.getByRole('link', { name: '全部工具', exact: true }).click();
  await page.getByRole('link', { name: /UUID 生成器 UUID Generator/ }).click();
  await page.getByLabel('生成数量', { exact: true }).fill('2');
  await page.getByRole('button', { name: '生成 UUID', exact: true }).click();
  await expect(page.locator('.uuid-row')).toHaveCount(2);
  await noOverflow();

  await page.getByRole('link', { name: '全部工具', exact: true }).click();
  await page.getByRole('link', { name: /文本对比 Text Diff/ }).click();
  await page.getByRole('button', { name: '载入示例', exact: true }).click();
  await page.getByRole('button', { name: '开始对比', exact: true }).click();
  await expect(page.locator('.diff-line.added')).toHaveCount(3);
  await noOverflow();
  await page.setViewportSize({ width: 520, height: 900 });
  await noOverflow();
});
