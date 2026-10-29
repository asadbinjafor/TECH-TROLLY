import { Injectable } from '@nestjs/common';
import { createHash,randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { commands,minor,decimal,z,type CommandKind,type User } from '@tech-trolley/contracts';
import { db } from '../database/database';
import { fail } from '../common/errors';
type Tx=EntityManager;
const positive=(n:bigint)=>{if(n<=0n)fail('POSITIVE_REQUIRED');return n;};
export const documentsSql=`SELECT d.*,r.id AS reversed_by,CASE WHEN r.id IS NOT NULL THEN 0 ELSE d.original_due-COALESCE((SELECT sum(a.amount) FROM allocation a WHERE a.target_id=d.id),0) END AS due FROM document d LEFT JOIN document r ON r.reversal_of=d.id`;
export const documentView=(d:any)=>({...d,total:decimal(d.total),due:decimal(d.due),original_due:undefined,business_date:typeof d.business_date==='string'?d.business_date.slice(0,10):d.business_date.toISOString().slice(0,10)});
@Injectable()
export class PostingService {
 async status(user:User,key:string){z.uuid().parse(key);const [r]=await db.query('SELECT result FROM command_result WHERE actor_id=$1 AND key=$2',[user.id,key]);return r?{found:true,result:r.result}:{found:false};}
 async execute(kind:CommandKind,input:unknown,user:User,key:string){
  if(!Object.hasOwn(commands,kind))fail('NOT_FOUND',404);z.uuid().parse(key);const data=commands[kind].parse(input) as any;
  const hash=createHash('sha256').update(JSON.stringify({kind,data})).digest('hex');
  for(let attempt=0;attempt<3;attempt++)try{return await db.transaction(async tx=>{
   const [shop]=await tx.query('SELECT * FROM shop WHERE id=1 FOR UPDATE');
   const [actor]=await tx.query('SELECT * FROM app_user WHERE id=$1 FOR SHARE',[user.id]);if(!actor?.active)fail('SESSION_EXPIRED',401);if(actor.must_change)fail('PASSWORD_CHANGE_REQUIRED',403);
   const [old]=await tx.query('SELECT * FROM command_result WHERE actor_id=$1 AND key=$2',[user.id,key]);if(old){if(old.request_hash!==hash)fail('IDEMPOTENCY_CONFLICT',409);return old.result;}
   if(kind==='opening'){if(actor.role!=='OWNER')fail('FORBIDDEN',403);if(shop.opened_at)fail('ALREADY_OPENED',409);}else if(!shop.opened_at)fail('OPENING_REQUIRED',409);
   const [{instant,date}]=await tx.query(`SELECT clock_timestamp() AS instant,to_char(clock_timestamp() AT TIME ZONE 'Asia/Dhaka','YYYY-MM-DD') AS date`);
   const id=randomUUID(),[{seq}]=await tx.query("SELECT nextval('document_number') AS seq"),number=`TT-${String(seq).padStart(6,'0')}`;
   let total=0n,due=0n,partyId:string|null=null,unitId:string|null=null,reversalOf:string|null=null;
   let snapshot:any={...data},entries:Record<string,bigint>={};
   const line=(account:string,n:bigint)=>{entries[account]=(entries[account]||0n)+n;};
   const amount=()=>positive(minor(data.amount));
   const party=async(pid:string,kind:string)=>{const [p]=await tx.query('SELECT * FROM party WHERE id=$1 AND kind=$2',[pid,kind]);if(!p)fail('NOT_FOUND',404);snapshot.partyName=p.name;snapshot.partyPhone=p.phone;return p;};
   const staff=async()=>{const [s]=await tx.query("SELECT id,name FROM app_user WHERE id=$1 AND role='STAFF'",[data.staffId]);if(!s)fail('NOT_FOUND',404);snapshot.staffName=s.name;};
   const allocations:{target:string;amount:bigint}[]=[];
   if(kind==='opening'){
    const cash=minor(data.cash),bank=minor(data.bank);total=cash+bank;line('cash',cash);line('bank',bank);line('equity',-total);
    await tx.query('UPDATE shop SET opened_at=$1,opening_date=$2 WHERE id=1',[instant,date]);
   }else if(kind==='purchase'){
    await party(data.supplierId,'supplier');partyId=data.supplierId;const cost=positive(minor(data.cost)),courier=minor(data.procurement),paid=minor(data.paid);if(paid>cost)fail('PAYMENT_INVALID');
    total=cost;due=cost-paid;unitId=randomUUID();snapshot.unitId=unitId;snapshot.acquisitionCost=decimal(cost+(data.treatment==='capitalize'?courier:0n));
    line('inventory',cost+(data.treatment==='capitalize'?courier:0n));if(data.treatment==='expense')line('expense',courier);line(data.account,-paid-courier);line('payable',-due);
   }else if(kind==='sale'){
    const [u]=await tx.query('SELECT * FROM inventory_unit WHERE id=$1 FOR UPDATE',[data.unitId]);if(!u)fail('NOT_FOUND',404);if(u.status!=='IN_STOCK')fail('STOCK_CONFLICT',409);unitId=u.id;
    const price=positive(minor(data.price)),discount=minor(data.discount),cash=minor(data.cash),bank=minor(data.bank);total=price-discount;if(total<=0n||cash+bank>total)fail('PAYMENT_INVALID');due=total-cash-bank;
    if(due>0n&&!data.customerId)fail('CUSTOMER_REQUIRED');if(data.customerId){await party(data.customerId,'customer');partyId=data.customerId;}else snapshot.partyName=null;
    snapshot={...snapshot,model:u.model,brand:u.brand,variant:u.variant,imei:u.imei,internalId:u.internal_id,battery:u.battery,box:u.box,condition:u.condition,cogs:decimal(u.cost)};
    line('cash',cash);line('bank',bank);line('receivable',due);line('revenue',-total);line('cogs',BigInt(u.cost));line('inventory',-BigInt(u.cost));
   }else if(['collection','supplierPayment','loanRepayment','advanceRepayment'].includes(kind)){
    const expected=({collection:'sale',supplierPayment:'purchase',loanRepayment:'loan',advanceRepayment:'advance'} as Record<string,string>)[kind];const [target]=await tx.query(`${documentsSql} WHERE d.id=$1`,[data.documentId]);
    if(!target||target.kind!==expected)fail('NOT_FOUND',404);total=amount();if(target.reversed_by||total>BigInt(target.due))fail('DUE_EXCEEDED',409);partyId=target.party_id;snapshot.originalNumber=target.number;snapshot.partyName=target.snapshot.partyName||target.snapshot.staffName;
    const isOut=kind==='supplierPayment';line(data.account,isOut?-total:total);line(({collection:'receivable',supplierPayment:'payable',loanRepayment:'loan',advanceRepayment:'advance'} as any)[kind],isOut?total:-total);allocations.push({target:target.id,amount:total});
   }else if(kind==='expense'){
    const [category]=await tx.query('SELECT * FROM expense_category WHERE id=$1 AND active',[data.categoryId]);if(!category)fail('CATEGORY_INACTIVE');snapshot.categoryLabels={bn:category.bn,en:category.en};total=amount();line('expense',total);line(data.account,-total);
   }else if(kind==='transfer'){total=amount();line(data.from,-total);line(data.from==='cash'?'bank':'cash',total);
   }else if(kind==='contribution'){total=amount();line(data.account,total);line('equity',-total);
   }else if(kind==='withdrawal'){total=amount();line(data.account,-total);line('drawing',total);
   }else if(kind==='loan'){await party(data.partyId,'person');partyId=data.partyId;total=amount();due=total;line('loan',total);line(data.account,-total);
   }else if(kind==='advance'){await staff();total=amount();due=total;line('advance',total);line(data.account,-total);
   }else if(kind==='salary'){
    await staff();total=amount();const apply=minor(data.applyAdvance);if(apply>total)fail('PAYMENT_INVALID');let remaining=apply;
    const advances=await tx.query(`${documentsSql} WHERE d.kind='advance' AND d.snapshot->>'staffId'=$1 AND r.id IS NULL ORDER BY d.created_at,d.id`,[data.staffId]);
    for(const a of advances){const used=remaining<BigInt(a.due)?remaining:BigInt(a.due);if(used>0n)allocations.push({target:a.id,amount:used});remaining-=used;}
    if(remaining>0n)fail('DUE_EXCEEDED',409);line('expense',total);line('advance',-apply);line(data.account,-(total-apply));
   }else if(kind==='cashCount'){
    const [{balance}]=await tx.query("SELECT COALESCE(sum(amount),0) AS balance FROM journal_line WHERE account='cash'");const expected=BigInt(balance),counted=minor(data.counted);if(counted!==expected&&!data.note)fail('REASON_REQUIRED');snapshot.expected=decimal(expected);snapshot.difference=decimal(counted-expected);total=counted;
   }else if(kind==='reversal'){
    const [target]=await tx.query(`${documentsSql} WHERE d.id=$1`,[data.documentId]);if(!target)fail('NOT_FOUND',404);
    if(target.reversed_by||['opening','reversal','cashCount'].includes(target.kind))fail('DEPENDENCY_CONFLICT',409);
    const [{used}]=await tx.query('SELECT COALESCE(sum(amount),0) AS used FROM allocation WHERE target_id=$1',[target.id]);if(BigInt(used)!==0n)fail('DEPENDENCY_CONFLICT',409);
    if(target.unit_id){const [unit]=await tx.query('SELECT * FROM inventory_unit WHERE id=$1 FOR UPDATE',[target.unit_id]);if(target.kind==='purchase'&&unit.status!=='IN_STOCK')fail('DEPENDENCY_CONFLICT',409);if(target.kind==='sale'&&unit.sale_id!==target.id)fail('DEPENDENCY_CONFLICT',409);unitId=unit.id;}
    const source=await tx.query('SELECT account,amount FROM journal_line WHERE document_id=$1',[target.id]);for(const e of source)line(e.account,-BigInt(e.amount));const sourceAllocations=await tx.query('SELECT * FROM allocation WHERE document_id=$1',[target.id]);for(const a of sourceAllocations)allocations.push({target:a.target_id,amount:-BigInt(a.amount)});
    reversalOf=target.id;partyId=target.party_id;total=BigInt(target.total);snapshot={...snapshot,originalNumber:target.number,originalKind:target.kind,originalSnapshot:target.snapshot};
    // Counts retain their original book cutoff. A linked correction flags affected later counts.
    await tx.query('UPDATE cash_count c SET needs_review=true FROM document d WHERE c.document_id=d.id AND d.created_at>=$1',[target.created_at]);
   }
   if(Object.values(entries).reduce((a,b)=>a+b,0n)!==0n)throw new Error('UNBALANCED_COMMAND');
   for(const account of ['cash','bank','inventory','receivable','loan','advance']){if((entries[account]||0n)<0n){const [{balance}]=await tx.query('SELECT COALESCE(sum(amount),0) AS balance FROM journal_line WHERE account=$1',[account]);if(BigInt(balance)+(entries[account]||0n)<0n)fail('INSUFFICIENT_FUNDS',409);}}
   await tx.query(`INSERT INTO document(id,number,kind,actor_id,actor_name,created_at,business_date,total,original_due,party_id,unit_id,snapshot,reversal_of) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[id,number,kind,actor.id,actor.name,instant,date,String(total),String(due),partyId,unitId,snapshot,reversalOf]);
   if(kind==='purchase'){
    const [{seq:unitNumber}]=await tx.query("SELECT nextval('unit_number') AS seq");await tx.query(`INSERT INTO inventory_unit(id,internal_id,model,brand,variant,category,condition,imei,battery,box,cost,status,purchase_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'IN_STOCK',$12)`,[unitId,`ST-${String(unitNumber).padStart(6,'0')}`,data.model,data.brand,data.variant,data.category,data.condition,data.imei,data.battery,data.box,String(minor(snapshot.acquisitionCost)),id]);
    await tx.query('INSERT INTO inventory_movement(unit_id,document_id,delta) VALUES($1,$2,1)',[unitId,id]);
   }else if(kind==='sale'){
    await tx.query("UPDATE inventory_unit SET status='SOLD',sale_id=$2 WHERE id=$1",[unitId,id]);await tx.query('INSERT INTO inventory_movement(unit_id,document_id,delta) VALUES($1,$2,-1)',[unitId,id]);
   }else if(kind==='reversal'&&unitId){
    if(snapshot.originalKind==='sale'){await tx.query("UPDATE inventory_unit SET status='IN_STOCK',sale_id=NULL WHERE id=$1",[unitId]);await tx.query('INSERT INTO inventory_movement(unit_id,document_id,delta) VALUES($1,$2,1)',[unitId,id]);}
    else {await tx.query("UPDATE inventory_unit SET status='SOLD' WHERE id=$1",[unitId]);await tx.query('INSERT INTO inventory_movement(unit_id,document_id,delta) VALUES($1,$2,-1)',[unitId,id]);}
   }
   for(const [account,n] of Object.entries(entries))if(n!==0n)await tx.query('INSERT INTO journal_line(document_id,account,amount) VALUES($1,$2,$3)',[id,account,String(n)]);
   for(const a of allocations)await tx.query('INSERT INTO allocation(document_id,target_id,amount) VALUES($1,$2,$3)',[id,a.target,String(a.amount)]);
   if(kind==='cashCount')await tx.query(`INSERT INTO cash_count(document_id,expected,counted,difference,cutoff) SELECT $1,$2,$3,$4,COALESCE(max(id),0) FROM journal_line`,[id,String(minor(snapshot.expected)),String(total),String(total-minor(snapshot.expected))]);
   const result={id,number};await tx.query('INSERT INTO command_result(actor_id,key,request_hash,result) VALUES($1,$2,$3,$4)',[actor.id,key,hash,result]);await tx.query("INSERT INTO audit_event(actor_id,action,subject_id,details) VALUES($1,'financial_posted',$2,$3)",[actor.id,id,{kind,number}]);return result;
  });}catch(error:any){if(['40001','40P01'].includes(error?.code)&&attempt<2)continue;throw error;}
  throw new Error('RETRY_EXHAUSTED');
 }
}
