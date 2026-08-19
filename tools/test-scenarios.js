console.log('===== S1: only part of the group shares an expense =====');
let t = use(trip(['علی','رضا','سارا','نازنین']));
t.expenses.push(exp({ amount: 30000, payerId: 'm0', splitBetween: ['m0','m1'] }));
ck('non-participants unaffected', balanceOf('m2') === 0 && balanceOf('m3') === 0, JSON.stringify(bals()));
ck('payer credited half', balanceOf('m0') === 15000, balanceOf('m0'));
ck('books balance', zeroSum());

console.log('\n===== S2: personal expense (payer alone in split) =====');
t = use(trip(['علی','رضا']));
t.expenses.push(exp({ amount: 5000, payerId: 'm0', splitBetween: ['m0'] }));
ck('no debt created', balanceOf('m0') === 0 && balanceOf('m1') === 0, JSON.stringify(bals()));
ck('no settlements suggested', calculateSettlements().length === 0);

console.log('\n===== S3: payer NOT in the split (treating others) =====');
t = use(trip(['علی','رضا','سارا']));
t.expenses.push(exp({ amount: 20000, payerId: 'm0', splitBetween: ['m1','m2'] }));
ck('payer fully credited', balanceOf('m0') === 20000, balanceOf('m0'));
ck('others owe half each', balanceOf('m1') === -10000 && balanceOf('m2') === -10000);
ck('books balance', zeroSum());

console.log('\n===== S4: circular debts cancel out =====');
t = use(trip(['A','B','C']));
['m0','m1','m2'].forEach(p => t.expenses.push(exp({ amount: 3000, payerId: p, splitBetween: ['m0','m1','m2'] })));
ck('everyone even', bals().every(b => b === 0), JSON.stringify(bals()));
ck('zero settlements needed', calculateSettlements().length === 0);

console.log('\n===== S5: one person funds the whole trip =====');
t = use(trip(['علی','ب','ج','د','ه']));
[50000,30000,20000].forEach(a => t.expenses.push(exp({ amount: a, payerId: 'm0', splitBetween: ['m0','m1','m2','m3','m4'] })));
ck('books balance', zeroSum(), JSON.stringify(bals()));
ck('exactly 4 settlements', calculateSettlements().length === 4);
ck('settlements equal total debt', S(calculateSettlements().map(s=>s.amount)) === totalDebt());
settleAll();
ck('all zero after settling', bals().every(b => Math.abs(b) < 1), JSON.stringify(bals()));

console.log('\n===== S6: a friend joins mid-trip =====');
t = use(trip(['علی','رضا']));
t.expenses.push(exp({ amount: 10000, payerId: 'm0', splitBetween: ['m0','m1'] }));
const snap = bals().slice();
t.members.push({ id: 'm9', name: 'دیرآمده', avatar: AVATARS[0], active: true, deviceId: null }); touch();
ck('not charged for earlier expenses', balanceOf('m9') === 0);
ck('existing balances untouched', JSON.stringify(bals().slice(0,2)) === JSON.stringify(snap));
t.expenses.push(exp({ amount: 9000, payerId: 'm9', splitBetween: ['m0','m1','m9'] })); touch();
ck('charged only for later ones', balanceOf('m9') === 6000, balanceOf('m9'));
ck('books balance', zeroSum());

console.log('\n===== S7: someone leaves mid-trip owing money =====');
t = use(trip(['علی','رضا','سارا']));
t.expenses.push(exp({ amount: 9000, payerId: 'm0', splitBetween: ['m0','m1','m2'] }));
t.members[2].active = false; touch();
ck('debt survives deactivation', balanceOf('m2') === -3000, balanceOf('m2'));
ck('still listed for settlement', calculateSettlements().some(s => s.from.id === 'm2'));
t.expenses.push(exp({ amount: 4000, payerId: 'm0', splitBetween: ['m0','m1'] }));
ck('excluded from later expenses', balanceOf('m2') === -3000, balanceOf('m2'));
settleAll();
ck('settles to zero', bals().every(b => Math.abs(b) < 1), JSON.stringify(bals()));
