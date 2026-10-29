import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';

test('isolated PostgreSQL acceptance, authorization, accounting and retry safety',async t=>{
 const source=process.env.TEST_DATABASE_URL;if(!source)throw new Error('Set TEST_DATABASE_URL to the isolated PostgreSQL test server; never use production.');
 const url=new URL(source);if(!url.pathname.endsWith('_test'))throw new Error('Test bootstrap database must end in _test');
 const admin=new Client({connectionString:source});await admin.connect();const name='trolley_'+randomUUID().replaceAll('-','')+'_test';await admin.query(`CREATE DATABASE "${name}"`);url.pathname='/'+name;process.env.DATABASE_URL=url.toString();process.env.BOOTSTRAP_OWNER_EMAIL='owner@example.test';process.env.BOOTSTRAP_OWNER_PASSWORD='initial-test-password';
 const {db}=require('../dist/database/database');const {migrate}=require('../dist/database/migrate');const {bootstrap}=require('../dist/auth/bootstrap');const {createApp}=require('../dist/main');
 let app:any;
 try{
  await migrate();await bootstrap();await bootstrap();app=await createApp();await app.init();const http=app.getHttpServer();
  const login=async(identity:string,password:string)=>{const r=await request(http).post('/auth/login').set('X-Native-Client','1').send({identity,password});assert.equal(r.status,201,JSON.stringify(r.body));return r.body;};
  let owner=await login('owner@example.test','initial-test-password'),token=owner.token;const api=(method:string,path:string,body?:any,tok=token)=>{let r=(request(http) as any)[method](path).set('Authorization',`Bearer ${tok}`);if(body!==undefined)r=r.send(body);return r;};
  const cmd=async(kind:string,data:any,key=randomUUID(),tok=token)=>{const r=await api('post','/commands/'+kind,data,tok).set('Idempotency-Key',key);assert.equal(r.status,201,JSON.stringify(r.body));return r.body;};
  await t.test('fresh bootstrap, forced change, no public signup and persistent credentials',async()=>{
   assert.equal((await db.query('SELECT count(*) FROM app_user'))[0].count,'1');assert.equal((await db.query('SELECT count(*) FROM document'))[0].count,'0');assert.equal((await api('get','/shop/state')).status,403);
   assert.equal((await request(http).post('/auth/register').send({})).status,404);assert.equal((await request(http).get('/shop/state')).status,401);
   assert.equal((await api('post','/auth/password',{currentPassword:'initial-test-password',password:'changed-test-password'})).status,201);assert.equal((await api('get','/auth/me')).status,401);
   await bootstrap();owner=await login('OWNER@example.test','changed-test-password');token=owner.token;assert.equal(owner.user.must_change,false);
   const state=(await api('get','/shop/state')).body;for(const value of Object.values(state.balances))assert.equal(value,'0.00');assert.equal(state.units.length,0);
  });
  const createParty=async(kind:string,name:string)=>{const r=await api('post','/parties',{kind,name,phone:''});assert.equal(r.status,201);return r.body.id;};
  const supplier=await createParty('supplier','Test supplier'),customer=await createParty('customer','Test customer'),person=await createParty('person','Test borrower');let purchase:any,sale:any;
  const buy=(imei:string,cost='70000',paid='20000',procurement='500')=>({model:'Test phone',brand:'Test brand',variant:'128 GB',category:'phone',condition:'used',imei,battery:null,box:'unspecified',supplierId:supplier,cost,procurement,treatment:'capitalize',paid,account:'cash',note:''});
  await t.test('opening is mandatory, atomic and once only; reference accounting B–F',async()=>{
   assert.equal((await api('post','/commands/purchase',buy('000000000000001')).set('Idempotency-Key',randomUUID())).status,409);
   await cmd('opening',{cash:'100000',bank:'50000'});assert.equal((await api('post','/commands/opening',{cash:'0',bank:'0'}).set('Idempotency-Key',randomUUID())).status,409);
   purchase=await cmd('purchase',buy('000000000000001'));let state=(await api('get','/shop/state')).body;assert.equal(state.balances.cash,'79500.00');assert.equal(state.balances.payable,'50000.00');assert.equal(state.units[0].cost,'70500.00');assert.equal(state.report.netProfit,'0.00');assert.equal(state.units[0].imei,'000000000000001');
   sale=await cmd('sale',{unitId:state.units[0].id,price:'76000',discount:'1000',cash:'25000',bank:'40000',customerId:customer,note:''});state=(await api('get','/shop/state')).body;assert.equal(state.report.revenue,'75000.00');assert.equal(state.report.cogs,'70500.00');assert.equal(state.report.grossProfit,'4500.00');assert.equal(state.balances.receivable,'10000.00');assert.equal(state.balances.cash,'104500.00');assert.equal(state.balances.bank,'90000.00');assert.equal(state.units[0].status,'SOLD');
   await cmd('expense',{categoryId:state.categories[0].id,amount:'150',account:'cash',note:'Acceptance expense'});state=(await api('get','/shop/state')).body;assert.equal(state.balances.cash,'104350.00');assert.equal(state.report.netProfit,'4350.00');
   await cmd('collection',{documentId:sale.id,amount:'10000',account:'bank',note:''});await cmd('supplierPayment',{documentId:purchase.id,amount:'50000',account:'bank',note:''});state=(await api('get','/shop/state')).body;assert.equal(state.balances.bank,'50000.00');assert.equal(state.balances.receivable,'0.00');assert.equal(state.balances.payable,'0.00');assert.equal(state.report.netProfit,'4350.00');
   const receipt=(await api('get',`/documents/${sale.id}/receipt`)).body;assert.equal(receipt.originalDue,'10000.00');assert.equal(receipt.outstandingDue,'0.00');assert.ok(!JSON.stringify(receipt).includes('cogs'));assert.ok(!JSON.stringify(receipt).includes('70500'));
  });
  await t.test('concurrent sales, persisted duplicate results, changed-key payload and rollback',async()=>{
   const p=await cmd('purchase',buy('000000000000002','100','100','0'));const state=(await api('get','/shop/state')).body;const u=state.units.find((x:any)=>x.purchase_id===p.id),data={unitId:u.id,price:'90',discount:'0',cash:'0',bank:'0',customerId:customer,note:''};
   const key=randomUUID();const both=await Promise.all([cmd('sale',data,key),cmd('sale',data,key)]);assert.equal(both[0].id,both[1].id);
   const changed=await api('post','/commands/sale',{...data,price:'91'}).set('Idempotency-Key',key);assert.equal(changed.status,409);assert.equal((await api('get','/commands/status/'+key)).body.result.id,both[0].id);
   await cmd('purchase',buy('000000000000003','100','100','0'));const next=(await api('get','/shop/state')).body.units.find((x:any)=>x.imei==='000000000000003');const rs=await Promise.all([api('post','/commands/sale',{...data,unitId:next.id}).set('Idempotency-Key',randomUUID()),api('post','/commands/sale',{...data,unitId:next.id}).set('Idempotency-Key',randomUUID())]);assert.deepEqual(rs.map(r=>r.status).sort(),[201,409]);
   const before=(await db.query('SELECT count(*) FROM document'))[0].count;assert.equal((await api('post','/commands/purchase',buy('000000000000003')).set('Idempotency-Key',randomUUID())).status,409);assert.equal((await db.query('SELECT count(*) FROM document'))[0].count,before);
  });
  let staffToken:string,staffId:string;
  await t.test('owner-managed users, monthly capability, last Owner and session revocation',async()=>{
   const created=await api('post','/users',{name:'Test staff',login:'test.staff',email:'staff@example.test',role:'STAFF',password:'initial-staff-password'});assert.equal(created.status,201);staffId=created.body.id;
   let staff=await login('TEST.STAFF','initial-staff-password');await api('post','/auth/password',{currentPassword:'initial-staff-password',password:'changed-staff-password'},staff.token);staff=await login('staff@example.test','changed-staff-password');staffToken=staff.token;
   assert.equal((await api('get','/reports?period=month',undefined,staffToken)).status,403);assert.equal((await api('get','/reports?period=week',undefined,staffToken)).status,200);assert.equal((await api('get','/reports/export?period=month',undefined,staffToken)).status,403);assert.equal((await api('get','/reports?period=today&role=OWNER',undefined,staffToken)).status,400);assert.equal((await api('get','/users',undefined,staffToken)).status,403);assert.equal((await api('post','/users',{name:'Escalation'},staffToken)).status,403);
   assert.equal((await api('patch','/users/'+owner.user.id,{active:false})).body.code,'LAST_OWNER');
   assert.equal((await api('post','/users',{name:'Second Owner',login:'second.owner',email:'',role:'OWNER',password:'second-owner-password'})).status,201);
   await api('patch','/users/'+staffId,{password:'reset-staff-password'});assert.equal((await api('get','/auth/me',undefined,staffToken)).status,401);
   const cookieLogin=await request(http).post('/auth/login').send({identity:'owner',password:'changed-test-password'});assert.ok(cookieLogin.headers['set-cookie'][0].includes('HttpOnly'));assert.equal(cookieLogin.body.token,undefined);
   assert.equal((await request(http).post('/commands/transfer').set('Cookie',cookieLogin.headers['set-cookie']).set('Origin','https://untrusted.example').set('Idempotency-Key',randomUUID()).send({from:'cash',amount:'1',note:''})).status,403);
  });
  await t.test('funding, loans, salary advance, category history and traceable corrections',async()=>{
   const before=(await api('get','/shop/state')).body;await cmd('transfer',{from:'cash',amount:'1000',note:''});await cmd('contribution',{account:'cash',amount:'100',note:'Capital'});await cmd('withdrawal',{account:'cash',amount:'100',note:'Drawing'});
   const loan=await cmd('loan',{partyId:person,amount:'100',account:'cash',note:'Loan'});await cmd('loanRepayment',{documentId:loan.id,amount:'100',account:'bank',note:''});
   await cmd('advance',{staffId,amount:'1000',account:'cash',note:'Advance'});await cmd('salary',{staffId,month:'2026-10',amount:'1500',applyAdvance:'1000',account:'cash',note:''});assert.equal((await api('post','/commands/salary',{staffId,month:'2026-10',amount:'1500',applyAdvance:'0',account:'cash',note:''}).set('Idempotency-Key',randomUUID())).status,409);
   let state=(await api('get','/shop/state')).body;assert.equal(state.balances.advance,'0.00');assert.equal(state.report.netProfit,(Number(before.report.netProfit)-1500).toFixed(2));
   const category=state.categories[0];const exp=await cmd('expense',{categoryId:category.id,amount:'1.23',account:'cash',note:'Historical label'});await api('patch','/expense-categories/'+category.id,{bn:'পরিবর্তিত',en:'Renamed',active:false});state=(await api('get','/shop/state')).body;assert.equal(state.documents.find((d:any)=>d.id===exp.id).snapshot.categoryLabels.en,category.en);
   await cmd('cashCount',{counted:state.balances.cash,note:''});await cmd('reversal',{documentId:exp.id,note:'Correction test'});state=(await api('get','/shop/state')).body;assert.ok(state.counts[0].needs_review);assert.ok(state.documents.find((d:any)=>d.id===exp.id).reversed_by);
   assert.equal((await api('post','/commands/reversal',{documentId:sale.id,note:'Has collection'}).set('Idempotency-Key',randomUUID())).status,409);
   const journal=await db.query('SELECT document_id FROM journal_line GROUP BY document_id HAVING sum(amount)<>0');assert.equal(journal.length,0);
  });
  await t.test('concurrent overspending and overcollection have one winner, exact precision',async()=>{
   const state=(await api('get','/shop/state')).body;const amt=state.balances.bank;const rs=await Promise.all([api('post','/commands/withdrawal',{account:'bank',amount:amt,note:'Race 1'}).set('Idempotency-Key',randomUUID()),api('post','/commands/withdrawal',{account:'bank',amount:amt,note:'Race 2'}).set('Idempotency-Key',randomUUID())]);assert.deepEqual(rs.map(r=>r.status).sort(),[201,409]);
   const d=state.documents.find((d:any)=>d.kind==='sale'&&Number(d.due)>0);const cs=await Promise.all([api('post','/commands/collection',{documentId:d.id,amount:d.due,account:'cash',note:''}).set('Idempotency-Key',randomUUID()),api('post','/commands/collection',{documentId:d.id,amount:d.due,account:'cash',note:''}).set('Idempotency-Key',randomUUID())]);assert.deepEqual(cs.map(r=>r.status).sort(),[201,409]);
   assert.equal((await api('post','/commands/contribution',{account:'cash',amount:'0.015',note:'Invalid precision'}).set('Idempotency-Key',randomUUID())).status,400);
  });
 }finally{if(app)await app.close();if(db.isInitialized)await db.destroy();await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end();}
});
