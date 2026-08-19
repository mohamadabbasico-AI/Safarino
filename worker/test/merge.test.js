let n=0,bad=[];
const ck=(l,c,x)=>{n++;if(!c)bad.push(l+(x!=null?'  ['+x+']':''));console.log((c?'PASS  ':'FAIL  ')+l+(x!=null?'   ['+x+']':''));};
const T=1700000000000;
const e=(id,amt,at)=>({id,title:id,amount:amt,createdAt:T,updatedAt:at,splitBetween:['a'],payerId:'a',splitType:'equal'});
const base=(ex,extra)=>Object.assign({code:'X',name:'T',currency:'تومان',adminId:'a',
  members:[{id:'a',name:'A',updatedAt:T}],expenses:ex,payments:[],lastModified:T},extra||{});

console.log('=== two phones each add a different expense (the classic loss case) ===');
let A=base([e('e1',100,T+10)]), B2=base([e('e2',200,T+20)]);
let m=mergeTrips(A,B2);
ck('both expenses survive', m.expenses.length===2, m.expenses.map(x=>x.id).join(','));

console.log('\n=== same expense edited on both, newer wins ===');
A=base([e('e1',100,T+10)]); B2=base([e('e1',999,T+50)]);
m=mergeTrips(A,B2);
ck('newer edit wins', m.expenses.length===1 && m.expenses[0].amount===999, m.expenses[0].amount);
m=mergeTrips(B2,A);
ck('merge is order-independent', m.expenses.length===1 && m.expenses[0].amount===999, m.expenses[0].amount);

console.log('\n=== deletion is not resurrected by a stale peer ===');
A=base([], {tombExpenses:[{id:'e1',at:T+100}]});      // I deleted it
B2=base([e('e1',100,T+10)]);                           // they still have the old copy
m=mergeTrips(A,B2);
ck('stale copy stays deleted', m.expenses.length===0, m.expenses.length);
ck('tombstone retained', m.tombExpenses.length===1);

console.log('\n=== but an edit made AFTER the delete resurrects it ===');
A=base([], {tombExpenses:[{id:'e1',at:T+100}]});
B2=base([e('e1',100,T+500)]);                          // edited after the deletion
m=mergeTrips(A,B2);
ck('later edit beats older delete', m.expenses.length===1, m.expenses.length);

console.log('\n=== members and payments merge the same way ===');
A=base([]); A.members=[{id:'a',name:'A',updatedAt:T},{id:'b',name:'B',updatedAt:T+5}];
B2=base([]); B2.members=[{id:'a',name:'A',updatedAt:T},{id:'c',name:'C',updatedAt:T+7}];
m=mergeTrips(A,B2);
ck('members union', m.members.length===3, m.members.map(x=>x.id).join(','));
A=base([]); A.payments=[{id:'p1',from:'a',to:'b',amount:50,updatedAt:T+1}];
B2=base([]); B2.payments=[{id:'p2',from:'b',to:'a',amount:70,updatedAt:T+2}];
m=mergeTrips(A,B2);
ck('payments union', m.payments.length===2);

console.log('\n=== trip name: last writer wins ===');
A=base([]); A.name='قدیمی'; A.lastModified=T+1;
B2=base([]); B2.name='جدید'; B2.lastModified=T+9;
ck('newer trip name wins', mergeTrips(A,B2).name==='جدید', mergeTrips(A,B2).name);

console.log('\n=== convergence: merging repeatedly is stable ===');
A=base([e('e1',100,T+10)]); B2=base([e('e2',200,T+20)]);
const once=mergeTrips(A,B2);
const twice=mergeTrips(once,mergeTrips(B2,A));
ck('idempotent', JSON.stringify(once.expenses.map(x=>x.id).sort())===
                 JSON.stringify(twice.expenses.map(x=>x.id).sort()));

console.log('\n=== fuzz: random concurrent edits always converge ===');
let fails=0;
for(let t=0;t<400;t++){
  const seed=[e('e1',1,T),e('e2',2,T),e('e3',3,T)];
  const P=base(JSON.parse(JSON.stringify(seed)));
  const Q=base(JSON.parse(JSON.stringify(seed)));
  for(const dev of [P,Q]){
    if(Math.random()<0.5){ const i=Math.floor(Math.random()*dev.expenses.length);
      if(dev.expenses[i]){dev.expenses[i].amount=Math.floor(Math.random()*1000);
        dev.expenses[i].updatedAt=T+Math.floor(Math.random()*1000);} }
    if(Math.random()<0.35){ const i=Math.floor(Math.random()*dev.expenses.length);
      const victim=dev.expenses[i];
      if(victim){ dev.expenses.splice(i,1);
        dev.tombExpenses=[{id:victim.id,at:T+Math.floor(Math.random()*1000)}]; } }
    if(Math.random()<0.4){ dev.expenses.push(e('n'+t+Math.random().toString(36).slice(2,5),9,T+900)); }
  }
  const ab=mergeTrips(JSON.parse(JSON.stringify(P)),JSON.parse(JSON.stringify(Q)));
  const ba=mergeTrips(JSON.parse(JSON.stringify(Q)),JSON.parse(JSON.stringify(P)));
  const ids=x=>x.expenses.map(y=>y.id).sort().join(',');
  const amts=x=>x.expenses.slice().sort((p,q)=>p.id<q.id?-1:1).map(y=>y.amount).join(',');
  if(ids(ab)!==ids(ba)||amts(ab)!==amts(ba)) fails++;
}
ck('400 concurrent-edit pairs converge identically both directions', fails===0, fails+' divergences');
console.log('\n'+n+' checks, '+bad.length+' failures');
