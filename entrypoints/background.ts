import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground(() => {
  const configureSidePanel = () => {
    void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error('ToolX 侧边栏入口设置失败', error));
  };

  browser.runtime.onInstalled.addListener(configureSidePanel);
  browser.runtime.onStartup.addListener(configureSidePanel);
  configureSidePanel();
});
