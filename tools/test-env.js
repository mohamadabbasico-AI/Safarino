const _s = new Map();
globalThis.localStorage = {
  getItem: k => (_s.has(k) ? _s.get(k) : null),
  setItem: (k,v) => { _s.set(k, String(v)); },
  removeItem: k => { _s.delete(k); },
  clear: () => _s.clear(),
  key: i => [..._s.keys()][i],
  get length(){ return _s.size; }
};
const noop = () => {};
const el = () => ({ classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},
  style:{}, value:'', textContent:'', innerHTML:'', dataset:{},
  appendChild:noop, removeChild:noop, remove:noop, querySelector:()=>null,
  querySelectorAll:()=>[], addEventListener:noop, focus:noop, setSelectionRange:noop,
  getBoundingClientRect:()=>({width:0,height:0}) });
globalThis.document = { getElementById: el, querySelector: ()=>null, querySelectorAll: ()=>[],
  addEventListener: noop, createElement: el, body:{classList:{add:noop,remove:noop,toggle:noop},style:{}},
  documentElement:{setAttribute:noop}, readyState:'loading' };
globalThis.window = { addEventListener: noop, print: noop, scrollTo: noop };
globalThis.navigator = { vibrate: noop };
globalThis.requestAnimationFrame = noop;
globalThis.performance = require('perf_hooks').performance;
globalThis.Blob = class {}; globalThis.File = class {}; globalThis.FileReader = class {};
globalThis.URL = globalThis.URL || class {};
