console.log('===== PROPERTY FUZZ: 3000 random trips =====');
const rnd = n => Math.floor(Math.random() * n);
let bad = [];
for (let trial = 0; trial < 3000; trial++) {
  const size = 2 + rnd(8);
  const t = use(trip(Array.from({length:size},(_,i)=>'P'+i)));
  // random expenses, mixed equal/custom, sometimes payer outside the split
  for (let k = 0; k < rnd(15); k++) {
    const amount = 1 + rnd(1000000);
    const ids = t.members.map(m=>m.id).sort(()=>Math.random()-0.5).slice(0, 1 + rnd(size));
    let splitType = 'equal', customAmounts = null;
    if (Math.random() < 0.45) {
      splitType = 'custom'; customAmounts = {}; let left = amount;
      ids.forEach((id,i) => { const v = (i===ids.length-1) ? left : rnd(left+1); customAmounts[id]=v; left-=v; });
    }
    t.expenses.push(exp({ amount, payerId: t.members[rnd(size)].id,
      splitBetween: ids, splitType, customAmounts }));
  }
  // random deactivations
  t.members.forEach(m => { if (m.id !== 'm0' && Math.random() < 0.2) m.active = false; });
  // random pre-existing payments
  for (let k = 0; k < rnd(4); k++) {
    const a = rnd(size), b = rnd(size);
    if (a !== b) t.payments.push(pay(t.members[a].id, t.members[b].id, 1 + rnd(200000)));
  }
  touch();

  // INVARIANT 1: books balance
  if (S(bals()) !== 0) bad.push('trial '+trial+': balances sum '+S(bals()));
  // INVARIANT 2: each expense's shares equal its amount, none negative
  for (const e of t.expenses) {
    const sh = expenseShares(e);
    const tot = S(Object.values(sh));
    if (tot !== e.amount) { bad.push('trial '+trial+': expense sum '+tot+' != '+e.amount); break; }
    if (Object.values(sh).some(v => v < 0)) { bad.push('trial '+trial+': negative share'); break; }
    if (Object.keys(sh).length !== e.splitBetween.length) { bad.push('trial '+trial+': share count mismatch'); break; }
  }
  // INVARIANT 3: settlements move exactly the outstanding debt
  const st = calculateSettlements();
  const debt = t.members.reduce((s,m) => s + Math.max(0,-balanceOf(m.id)), 0);
  const moved = S(st.map(s=>s.amount));
  if (Math.abs(debt - moved) > size) bad.push('trial '+trial+': moved '+moved+' vs debt '+debt);
  // INVARIANT 4: settlements are minimal (n-1 upper bound)
  const nz = t.members.filter(m => Math.abs(balanceOf(m.id)) >= 1).length;
  if (st.length > Math.max(0, nz - 1)) bad.push('trial '+trial+': '+st.length+' settlements for '+nz+' parties');
  // INVARIANT 5: no settlement is self-directed or non-positive
  if (st.some(s => s.from.id === s.to.id || s.amount <= 0)) bad.push('trial '+trial+': degenerate settlement');
  // INVARIANT 6: applying all settlements zeroes everyone
  const rounds = settleAll();
  if (rounds >= 300) bad.push('trial '+trial+': settlement did not terminate');
  if (!bals().every(b => Math.abs(b) < 1)) bad.push('trial '+trial+': not zero after settling '+JSON.stringify(bals()));
  // INVARIANT 7: a full save/load cycle changes nothing
  if (trial % 100 === 0) {
    const b1 = bals().slice();
    const rr = sanitizeTrip(JSON.parse(JSON.stringify(currentTrip)));
    use(rr.trip);
    if (JSON.stringify(bals()) !== JSON.stringify(b1)) bad.push('trial '+trial+': round trip changed balances');
  }
}
console.log('violations: ' + bad.length);
bad.slice(0,10).forEach(b => console.log('  - ' + b));
ck('3000 random trips satisfy all 7 accounting invariants', bad.length === 0, bad.length + ' violations');
