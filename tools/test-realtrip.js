console.log('===== REAL-TRIP SIMULATION: 6 friends, 10 days, everything =====');
let t = use(trip(['نازنین','محمد','سارا','امیر','رضا','مینا']));
const ids = t.members.map(m => m.id);
const spend = (title, amt, payer, who, days, opts) => {
  const e = exp(Object.assign({ title, amount: amt, payerId: ids[payer],
    splitBetween: who.map(i => ids[i]), spentAt: Date.now() - days * 86400000 }, opts || {}));
  t.expenses.push(e); touch(); return e;
};

// day 1: everyone travels
spend('بلیط قطار', 4800000, 0, [0,1,2,3,4,5], 10);
spend('صبحانه ایستگاه', 360000, 1, [0,1,2], 10);
// day 2: hotel, one couple shares a room -> weighted
spend('هتل ۳ شب', 9000000, 2, [0,1,2,3,4,5], 9, { splitType:'shares',
  splitWeights: { [ids[0]]:2, [ids[1]]:2, [ids[2]]:1, [ids[3]]:1, [ids[4]]:1, [ids[5]]:1 } });
// day 3: a foreign-currency purchase abroad
spend('خرید فرودگاه', 120, 3, [3], 8, { currency:'دلار', rate: 62000 });
// day 4: percentage split (someone ate much more)
spend('رستوران سنتی', 2400000, 4, [0,1,4], 7, { splitType:'percent',
  splitWeights: { [ids[0]]:25, [ids[1]]:25, [ids[4]]:50 } });
// day 5: exact custom amounts
spend('سوپرمارکت', 1650000, 5, [0,2,5], 6, { splitType:'custom',
  customAmounts: { [ids[0]]:500000, [ids[2]]:650000, [ids[5]]:500000 } });
// day 6: someone treats the others (payer excluded)
spend('بستنی', 480000, 0, [1,2,3,4,5], 5);
// day 7: a personal expense
spend('دارو', 220000, 3, [3], 4);
// day 8: a member leaves early and is deactivated
t.members[5].active = false; touch();
spend('شام خداحافظی', 3000000, 1, [0,1,2,3,4], 3);
// day 9: partial settlement between two people
t.payments.push(pay(ids[3], ids[0], 1000000)); touch();
// day 10: correction - the hotel was actually cheaper
t.expenses[2].amount = 8100000; touch();

ck('every expense allocates exactly its amount', t.expenses.every(e => {
  const sh = expenseShares(e); const sum = S(Object.values(sh));
  return sum === baseAmount(e);
}), t.expenses.map(e => S(Object.values(expenseShares(e))) - baseAmount(e)).join(','));
ck('books balance after 10 days', zeroSum(), JSON.stringify(bals()));
ck('foreign expense converted', baseAmount(t.expenses[3]) === 120 * 62000, baseAmount(t.expenses[3]));
ck('weighted room split: couple pays double',
   expenseShares(t.expenses[2])[ids[0]] === expenseShares(t.expenses[2])[ids[2]] * 2,
   expenseShares(t.expenses[2])[ids[0]] + ' vs ' + expenseShares(t.expenses[2])[ids[2]]);
ck('percent split honoured',
   expenseShares(t.expenses[4])[ids[4]] === 1200000, expenseShares(t.expenses[4])[ids[4]]);
ck('personal expense creates no debt', (() => {
   const before = balanceOf(ids[3]);
   return typeof before === 'number';
})());
ck('inactive member keeps their debt', balanceOf(ids[5]) !== 0, balanceOf(ids[5]));
ck('inactive member excluded from later expense',
   !t.expenses[t.expenses.length-1].splitBetween.includes(ids[5]));

const st = calculateSettlements();
const nz = t.members.filter(m => Math.abs(balanceOf(m.id)) >= 1).length;
ck('settlement count is minimal', st.length <= Math.max(0, nz - 1), st.length + ' for ' + nz);
ck('no self-payments', !st.some(s => s.from.id === s.to.id));
settleAll();
ck('everyone lands on zero', bals().every(b => Math.abs(b) < 1), JSON.stringify(bals()));

console.log('\n===== EXPORT / IMPORT MID-TRIP =====');
const snapshot = JSON.parse(JSON.stringify(currentTrip));
const round = sanitizeTrip(JSON.parse(JSON.stringify(snapshot)));
ck('round trip reports no issues', round.issues.length === 0, JSON.stringify(round.issues));
const before = bals().slice();
use(round.trip);
ck('balances identical after round trip', JSON.stringify(bals()) === JSON.stringify(before));
