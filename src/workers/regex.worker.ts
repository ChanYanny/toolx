import { evaluateRegex, type RegexRequest, type RegexResponse } from '../lib/regex';

self.onmessage = (event: MessageEvent<RegexRequest>) => {
  let response: RegexResponse;
  try { response = { result: evaluateRegex(event.data) }; }
  catch (error) { response = { error: `表达式无法执行：${error instanceof Error ? error.message : '请检查语法。'}` }; }
  self.postMessage(response);
};
