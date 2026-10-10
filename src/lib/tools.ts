import { Braces, Binary, Link2, Clock3, Fingerprint, ScanLine, Regex } from 'lucide-react';

export const tools = [
  { id: 'json', name: 'JSON 格式化', english: 'JSON Formatter', description: '格式化、树形查看与 JSONPath 查询，让数据井然有序。', category: '数据格式', icon: Braces, color: 'green', tags: ['树形查看', 'JSONPath', '转义'], keywords: 'json jsonpath 格式化 压缩 校验 sort 排序 escape unescape 转义 去转义 字符串 树 折叠 节点 搜索 字段 路径 查询' },
  { id: 'base64', name: 'Base64 编解码', english: 'Base64 Encoder', description: '文本与 Base64 轻松互转，完整支持中文和 Emoji。', category: '编解码', icon: Binary, color: 'violet', tags: ['Base64', 'UTF-8'], keywords: 'base64 encode decode 编码 解码 中文' },
  { id: 'url', name: 'URL 编解码', english: 'URL Encoder', description: '编码 URL 参数、还原转义字符，让链接清晰可读。', category: '编解码', icon: Link2, color: 'blue', tags: ['URL', '转义'], keywords: 'url uri percent encode decode 编码 解码 链接 参数' },
  { id: 'timestamp', name: '时间戳转换', english: 'Timestamp Converter', description: '在 Unix 时间戳和日期之间转换，告别心算时差。', category: '生成与转换', icon: Clock3, color: 'orange', tags: ['Unix', '时区'], keywords: 'timestamp unix 时间戳 日期 时间 date UTC' },
  { id: 'uuid', name: 'UUID 生成器', english: 'UUID Generator', description: '一键生成随机 UUID，支持批量、大小写与格式设置。', category: '生成与转换', icon: Fingerprint, color: 'pink', tags: ['UUID v4', '批量生成'], keywords: 'uuid guid id 随机 唯一 生成器' },
  { id: 'diff', name: '文本对比', english: 'Text Diff', description: '逐行对比两段文本，清楚找到每一处新增与删除。', category: '文本处理', icon: ScanLine, color: 'teal', tags: ['Diff', '逐行对比'], keywords: 'diff text compare 文本 对比 比较 差异' },
  { id: 'regex', name: '正则测试', english: 'Regex Tester', description: '实时高亮匹配，查看捕获组，快速验证文本替换。', category: '文本处理', icon: Regex, color: 'violet', tags: ['RegExp', '捕获组', '替换'], keywords: 'regex regexp regular expression 正则 表达式 测试 匹配 高亮 捕获组 替换' },
] as const;

export type Tool = typeof tools[number];
export type ToolId = Tool['id'];
export const categories = ['全部工具', '数据格式', '编解码', '生成与转换', '文本处理'] as const;
export type Category = typeof categories[number];
export const isToolId = (id: string): id is ToolId => tools.some((tool) => tool.id === id);
export const findTools = (query: string) => {
  const words = query.trim().toLowerCase().split(/\s+/);
  return tools.filter((tool) => words.every((word) =>
    `${tool.name} ${tool.english} ${tool.keywords}`.toLowerCase().includes(word)));
};

export const examples = {
  json: '{"project":"ToolX","description":"开发者的日常工具箱","version":"1.0.0","features":["快速","离线可用","保护隐私"],"settings":{"theme":"light","localOnly":true},"ready":true}',
  base64: 'Hello, developer! 你好，世界 👋',
  url: 'https://example.com/search?q=开发者工具&tag=hello world',
  diffBefore: '{\n  "name": "ToolX",\n  "version": "0.9.0",\n  "offline": false\n}',
  diffAfter: '{\n  "name": "ToolX",\n  "version": "1.0.0",\n  "offline": true,\n  "theme": "light"\n}',
};
