console.log('===== HOSTILE AND CLUMSY USERS =====');
const cases = {
  'members not an array':   { code:'AAA111', name:'x', members:'nope', expenses:[] },
  'member with no id':      { code:'AAA111', name:'x', members:[{name:'A'}], expenses:[] },
  'expense referencing ghost payer': { code:'AAA111', name:'x', members:[{id:'a',name:'A'}],
      expenses:[{id:'e',title:'t',amount:100,payerId:'ghost',splitBetween:['a']}] },
  'split includes a ghost': { code:'AAA111', name:'x', members:[{id:'a',name:'A'}],
      expenses:[{id:'e',title:'t',amount:100,payerId:'a',splitBetween:['a','ghost']}] },
  'weights all zero':       { code:'AAA111', name:'x', members:[{id:'a',name:'A'},{id:'b',name:'B'}],
      expenses:[{id:'e',title:'t',amount:100,payerId:'a',splitBetween:['a','b'],splitType:'shares',splitWeights:{a:0,b:0}}] },
  'negative weights':       { code:'AAA111', name:'x', members:[{id:'a',name:'A'},{id:'b',name:'B'}],
      expenses:[{id:'e',title:'t',amount:900,payerId:'a',splitBetween:['a','b'],splitType:'shares',splitWeights:{a:-5,b:3}}] },
  'percent summing to 7':   { code:'AAA111', name:'x', members:[{id:'a',name:'A'},{id:'b',name:'B'}],
      expenses:[{id:'e',title:'t',amount:1000,payerId:'a',splitBetween:['a','b'],splitType:'percent',splitWeights:{a:3,b:4}}] },
  'custom not matching':    { code:'AAA111', name:'x', members:[{id:'a',name:'A'},{id:'b',name:'B'}],
      expenses:[{id:'e',title:'t',amount:1000,payerId:'a',splitBetween:['a','b'],splitType:'custom',customAmounts:{a:1,b:1}}] },
  'rate of zero on foreign':{ code:'AAA111', name:'x', members:[{id:'a',name:'A'},{id:'b',name:'B'}],
      expenses:[{id:'e',title:'t',amount:50,payerId:'a',splitBetween:['a','b'],currency:'دلار',rate:0}] },
  'html in every string':   { code:'AAA111', name:'<img src=x onerror=alert(1)>',
      members:[{id:'a',name:'<script>bad()</script>',avatar:'<svg onload=1>'}],
      expenses:[{id:'e',title:'<b>t</b>',amount:100,payerId:'a',splitBetween:['a'],note:'<iframe>'}] },
  'absurd tombstones':      { code:'AAA111', name:'x', members:[{id:'a',name:'A'}], expenses:[],
      tombExpenses:'not an array', tombMembers:[{id:null,at:'soon'}] },
  'payment with no amount': { code:'AAA111', name:'x', members:[{id:'a',name:'A'},{id:'b',name:'B'}],
      expenses:[], payments:[{id:'p',from:'a',to:'b'}] },
  'deeply nested junk':     { code:'AAA111', name:'x', members:[{id:'a',name:'A'}],
      expenses:[{id:'e',title:'t',amount:{deep:{deeper:1}},payerId:'a',splitBetween:['a']}] }
};
for (const [label, data] of Object.entries(cases)) {
  let r, threw = null;
  try { r = sanitizeTrip(data); } catch (e) { threw = e.message; }
  if (threw) { ck('survives: ' + label, false, 'threw ' + threw); continue; }
  if (!r) { ck('rejected cleanly: ' + label, true, 'null'); continue; }
  use(r.trip);
  const okBalance = zeroSum();
  const okShares = r.trip.expenses.every(e => S(Object.values(expenseShares(e))) === baseAmount(e));
  const okNoNaN = r.trip.members.every(m => Number.isFinite(balanceOf(m.id)));
  ck('repaired: ' + label, okBalance && okShares && okNoNaN,
     'bal=' + okBalance + ' shares=' + okShares + ' finite=' + okNoNaN);
}

console.log('\n===== ESCAPING =====');
const evil = sanitizeTrip(cases['html in every string']);
use(evil.trip);
const m0 = evil.trip.members[0];
ck('avatar forced to a known preset', AVATAR_SET.has(m0.avatar), m0.avatar);
ck('name kept as literal text', m0.name.indexOf('<script>') === 0, m0.name.slice(0, 12));
ck('esc neutralises markup', esc('<b>x</b>').indexOf('&lt;') === 0, esc('<b>x</b>'));
ck('avatar render never echoes input', escAvatar('<svg onload=1>').indexOf('onload') < 0);

console.log('\n===== NUMBER INPUT, EVERY WAY A USER MIGHT TYPE IT =====');
const inputs = [['۱۲۳٬۴۵۶',123456],['123,456',123456],['١٢٣٤٥٦',123456],['12.5',13],['12/5',13],
  ['  9 000 ',9000],['-500',-500],['0',0],['',null],['abc',null],['۱۲abc۳',123],
  ['999999999999999999',999999999999],['1e5',15]];
for (const [raw, want] of inputs) {
  const got = parseAmount(raw);
  ck('parseAmount(' + JSON.stringify(raw) + ')', got === want || (want === null && got === null),
     'got ' + got + ' want ' + want);
}
