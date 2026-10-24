const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const read=require('../scripts/contract-loader.cjs')();
const {normalize,projection,round}=read(path.resolve('lib/sales-commander-model.ts'));
const store=read(path.resolve('lib/sales-target-reminder.ts'));
test('header targets use the dashboard projection and stay scoped to the current session',()=>{
 const saved=normalize({goal:12,rates:{contact:22,set:40,show:59,sold:40,buffer:2,workdays:22}});
 let notifications=0;const stop=store.subscribeSalesTargets(()=>notifications++);
 store.publishSalesTargets('account-A',saved);
 assert.deepEqual(store.readSalesTargets('account-A'),{...projection(saved).daily,sold:round(saved.goal/saved.rates.workdays)});
 assert.equal(store.readSalesTargets('account-B'),null);
 assert.equal(notifications,1);stop();
 store.publishSalesTargets('account-B',normalize({goal:20}));
 assert.equal(store.readSalesTargets('account-A'),null);assert.equal(notifications,1);
});
