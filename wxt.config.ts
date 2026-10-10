import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  imports: false,
  manifest: ({ command }) => ({
    name: 'ToolX · 开发者工具箱',
    description: '离线开发者工具箱：JSON 树与 JSONPath、正则测试、Base64、URL、时间戳、UUID 和文本 Diff。',
    version: '1.0.0',
    minimum_chrome_version: '116',
    permissions: ['sidePanel'],
    action: { default_title: '在侧边栏打开 ToolX' },
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      128: '/icon/128.png',
    },
    content_security_policy: command === 'build' ? {
      extension_pages: "script-src 'self'; object-src 'self'; connect-src 'none'",
    } : undefined,
  }),
});
