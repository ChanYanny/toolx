import { chromium, expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

test('native side panel launch and extension workspace behavior work offline', async () => {
  const extensionPath = resolve('.output/chrome-mv3');
  const id = createHash('sha256').update(extensionPath).digest('hex').slice(0, 32)
    .replace(/[0-9a-f]/g, (hex) => String.fromCharCode(97 + parseInt(hex, 16)));
  mkdirSync('artifacts', { recursive: true });
  const profile = mkdtempSync(resolve('artifacts/extension-profile-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    // CDP toolbar-action testing is enabled only in this disposable profile.
    args: ['--enable-unsafe-extension-debugging', '--disable-crashpad-for-testing', '--window-size=1440,1000', `--crash-dumps-dir=${resolve('artifacts/crashpad')}`, `--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    viewport: null,
    reducedMotion: 'reduce',
  });
  try {
    const errors: string[] = [];
    const externalRequests: string[] = [];
    context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
    context.on('request', (request) => { if (/^https?:/.test(request.url())) externalRequests.push(request.url()); });
    await context.setOffline(true);
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate('chrome.sidePanel.getPanelBehavior()')).toEqual({ openPanelOnActionClick: true });
    const manifest = await worker.evaluate<{
      manifest_version: number; permissions: string[]; side_panel: { default_path: string }; action: { default_popup?: string };
    }>('chrome.runtime.getManifest()');
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(['sidePanel']);
    expect(manifest.side_panel.default_path).toBe('sidepanel.html');
    expect(manifest.action.default_popup).toBeUndefined();
    expect(await worker.evaluate('chrome.sidePanel.getOptions({})')).toMatchObject({ enabled: true, path: 'sidepanel.html' });
    const underlyingPage = context.pages()[0];
    await underlyingPage.setContent('<button>网页上的按钮</button>');
    const cdp = await context.browser()!.newBrowserCDPSession();
    const { targetInfos } = await cdp.send('Target.getTargets', { filter: [{ type: 'tab', exclude: false }, { exclude: true }] });
    await cdp.send('Extensions.triggerAction', { id, targetId: targetInfos[0].targetId });
    const nativePanelTarget = async () => (await cdp.send('Target.getTargets')).targetInfos
      .find((target) => target.url === `chrome-extension://${id}/sidepanel.html`);
    await expect.poll(nativePanelTarget).toBeTruthy();
    const nativePanelId = (await nativePanelTarget())!.targetId;

    // Chrome's native panel target is not exposed as a Playwright Page.
    // Verify its lifetime through CDP, and exercise the same extension document in a narrow page.
    const sidepanel = await context.newPage();
    await sidepanel.setViewportSize({ width: 360, height: 820 });
    await sidepanel.goto(`chrome-extension://${id}/sidepanel.html`);
    await expect(sidepanel).toHaveURL(`chrome-extension://${id}/sidepanel.html`);
    await expect(sidepanel.locator('.sidepanel-tool')).toHaveCount(7);
    const width = await sidepanel.evaluate(() => innerWidth);
    expect(width).toBeGreaterThanOrEqual(300);
    expect(width).toBeLessThan(800);
    await sidepanel.screenshot({ path: 'artifacts/extension-sidepanel-home.png' });
    await sidepanel.getByLabel('收藏JSON 格式化', { exact: true }).click();
    await sidepanel.getByRole('link', { name: /JSON 格式化 JSON Formatter/ }).click();
    await expect(sidepanel.getByRole('heading', { name: 'JSON 格式化', exact: true })).toBeVisible();
    expect(context.pages()).toHaveLength(2);
    const input = sidepanel.getByRole('textbox', { name: '输入内容', exact: true });
    await input.fill('{"id":9223372036854775807,"source":"sidepanel"}');
    await sidepanel.getByRole('button', { name: '格式化 JSON', exact: true }).click();
    await expect(sidepanel.locator('.code-output')).toContainText('9223372036854775807');
    expect(await sidepanel.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await underlyingPage.getByRole('button', { name: '网页上的按钮' }).click();
    await expect(input).toHaveValue('{"id":9223372036854775807,"source":"sidepanel"}');
    expect((await nativePanelTarget())?.targetId).toBe(nativePanelId);
    await sidepanel.screenshot({ path: 'artifacts/extension-sidepanel-json.png' });
    await sidepanel.getByRole('link', { name: '全部工具', exact: true }).click();
    await sidepanel.getByRole('link', { name: /UUID 生成器 UUID Generator/ }).click();
    await sidepanel.getByRole('button', { name: '生成 UUID', exact: true }).click();
    await expect(sidepanel.locator('.uuid-row')).toHaveCount(5);
    await sidepanel.getByRole('link', { name: '全部工具', exact: true }).click();
    await sidepanel.getByRole('link', { name: /正则测试 Regex Tester/ }).click();
    await expect(sidepanel.locator('.regex-status')).toContainText('2 处匹配');
    await expect(sidepanel.locator('.regex-highlight mark')).toHaveCount(2);
    await sidepanel.getByLabel('正则表达式', { exact: true }).fill('\\d+');
    await sidepanel.getByLabel('正则测试文本', { exact: true }).fill('离线 123 测试 456');
    await expect(sidepanel.locator('.regex-highlight mark').first()).toHaveText('123');
    await expect(sidepanel.locator('.regex-highlight mark')).toHaveCount(2);
    await sidepanel.getByLabel('替换模板', { exact: true }).fill('[$&]');
    await expect(sidepanel.locator('.regex-replace > .code-output')).toHaveText('离线 [123] 测试 [456]');
    expect(await sidepanel.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await sidepanel.screenshot({ path: 'artifacts/extension-sidepanel-regex.png', fullPage: true });
    await sidepanel.getByRole('link', { name: '全部工具', exact: true }).click();
    await sidepanel.getByRole('link', { name: /JSON 格式化 JSON Formatter/ }).click();
    await expect(input).toHaveValue('{"id":9223372036854775807,"source":"sidepanel"}');
    await sidepanel.getByRole('button', { name: '树形', exact: true }).click();
    await expect(sidepanel.locator('.json-tree')).toContainText('9223372036854775807');
    await sidepanel.getByRole('button', { name: 'JSONPath', exact: true }).click();
    await sidepanel.getByLabel('JSONPath 表达式', { exact: true }).fill('$.id');
    await sidepanel.getByRole('button', { name: '查询', exact: true }).click();
    await expect(sidepanel.locator('.query-result .code-output')).toContainText('9223372036854775807');
    const newPage = context.waitForEvent('page');
    await sidepanel.getByRole('link', { name: '在标签页打开', exact: true }).click();
    const workspace = await newPage;
    await workspace.setViewportSize({ width: 1440, height: 1024 });
    await expect(workspace.getByRole('heading', { name: 'JSON 格式化', exact: true })).toBeVisible();
    await expect(workspace.getByLabel('取消收藏JSON 格式化', { exact: true })).toHaveAttribute('aria-pressed', 'true');
    await workspace.getByRole('button', { name: '载入示例' }).click();
    await workspace.getByRole('button', { name: '格式化 JSON', exact: true }).click();
    await expect(workspace.locator('.code-output')).toContainText('"project": "ToolX"');
    await workspace.getByLabel('取消收藏JSON 格式化', { exact: true }).click();
    await expect(sidepanel.getByRole('button', { name: '收藏JSON 格式化', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(input).toHaveValue('{"id":9223372036854775807,"source":"sidepanel"}');
    await sidepanel.reload();
    await expect(input).toHaveValue('');
    expect(errors).toEqual([]);
    expect(externalRequests).toEqual([]);
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  }
});
