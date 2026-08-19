globalThis.fails = []; globalThis.n = 0;
globalThis.ck = function (label, cond, extra) {
  n++;
  if (!cond) fails.push(label + (extra != null ? '  [' + extra + ']' : ''));
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra != null ? '   [' + extra + ']' : ''));
};
globalThis.S = a => a.reduce((x, y) => x + y, 0);
globalThis.trip = function (names) {
  const members = names.map((nm, i) => ({ id: 'm' + i, name: nm, avatar: AVATARS[0], active: true, deviceId: null }));
  return { code: 'TRIP01', name: 'T', date: 'd', currency: 'تومان', adminId: 'm0', members, expenses: [], payments: [] };
};
globalThis.exp = function (o) {
  return Object.assign({ id: 'e' + Math.random().toString(36).slice(2, 8), title: 't', category: 'food',
    splitType: 'equal', customAmounts: null, createdAt: Date.now() }, o);
};
globalThis.pay = function (from, to, amount) {
  return { id: 'p' + Math.random().toString(36).slice(2, 8), from, to, amount, createdAt: Date.now() };
};
globalThis.use = function (t) { currentTrip = t; touch(); return t; };
globalThis.bals = () => currentTrip.members.map(m => balanceOf(m.id));
globalThis.zeroSum = () => S(bals()) === 0;
globalThis.totalDebt = () => currentTrip.members.reduce((s, m) => s + Math.max(0, -balanceOf(m.id)), 0);
globalThis.settleAll = function () {
  let guard = 0;
  while (calculateSettlements().length && guard++ < 300) {
    const s = calculateSettlements()[0];
    currentTrip.payments.push(pay(s.from.id, s.to.id, s.amount));
    touch();
  }
  return guard;
};
globalThis.report = function () {
  console.log('\n=========== RESULT ===========');
  console.log(n + ' checks, ' + fails.length + ' failures');
  if (fails.length) { console.log('FAILURES:'); fails.forEach(f => console.log('  - ' + f)); }
};
