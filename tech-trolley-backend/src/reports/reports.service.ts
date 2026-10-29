import { Injectable } from '@nestjs/common';
import { decimal,z,type User } from '@tech-trolley/contracts';
import { db } from '../database/database';
import { fail } from '../common/errors';
import { documentsSql,documentView } from '../accounts/posting.service';
export function shift(date:string,days:number){const d=new Date(`${date}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export const periodSchema=z.object({period:z.enum(['today','week','month']).default('today'),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()}).strict();
@Injectable()
export class ReportsService {
 async report(user:User,input:unknown){const v=periodSchema.parse(input);if(v.period==='month'&&user.role!=='OWNER')fail('FORBIDDEN',403);
  const [{today}]=await db.query("SELECT to_char(now() AT TIME ZONE 'Asia/Dhaka','YYYY-MM-DD') AS today");
  if(v.date&&v.period!=='today')fail('VALIDATION_ERROR');const to=v.date||today;
  if(!Number.isFinite(new Date(`${to}T00:00:00Z`).valueOf())||new Date(`${to}T00:00:00Z`).toISOString().slice(0,10)!==to||to>today)fail('VALIDATION_ERROR');
  const from=v.period==='week'?shift(today,-6):v.period==='month'?today.slice(0,8)+'01':to;
  const [shop]=await db.query('SELECT opening_date FROM shop WHERE id=1');
  const sums=await db.query(`SELECT l.account,COALESCE(sum(l.amount) FILTER(WHERE d.business_date<$1::date),0) AS opening,COALESCE(sum(l.amount) FILTER(WHERE d.business_date BETWEEN $1::date AND $2::date),0) AS activity,COALESCE(sum(l.amount) FILTER(WHERE d.business_date<=$2::date),0) AS closing,COALESCE(sum(l.amount) FILTER(WHERE d.business_date BETWEEN $1::date AND $2::date AND l.amount>0),0) AS inflow,COALESCE(-sum(l.amount) FILTER(WHERE d.business_date BETWEEN $1::date AND $2::date AND l.amount<0),0) AS outflow FROM journal_line l JOIN document d ON d.id=l.document_id GROUP BY l.account`,[from,to]);
  const get=(a:string,k:string)=>BigInt(sums.find((s:any)=>s.account===a)?.[k]||0),revenue=-get('revenue','activity'),cogs=get('cogs','activity'),expense=get('expense','activity');
  const documents=(await db.query(`${documentsSql} WHERE d.business_date BETWEEN $1 AND $2 ORDER BY d.created_at DESC,d.id`,[from,to])).map(documentView);
  // Net cash+bank per document removes transfers. Grouping also handles linked reversals.
  const [external]=await db.query(`SELECT COALESCE(sum(n) FILTER(WHERE n>0),0) AS inflow,COALESCE(-sum(n) FILTER(WHERE n<0),0) AS outflow FROM (SELECT sum(l.amount) AS n FROM journal_line l JOIN document d ON d.id=l.document_id WHERE l.account IN ('cash','bank') AND d.business_date BETWEEN $1 AND $2 AND d.kind<>'opening' GROUP BY d.id) x`,[from,to]);
  const openingDate=shop.opening_date?String(shop.opening_date instanceof Date?shop.opening_date.toISOString():shop.opening_date).slice(0,10):null;
  return {from,to,available:!!openingDate&&to>=openingDate,revenue:decimal(revenue),cogs:decimal(cogs),expense:decimal(expense),grossProfit:decimal(revenue-cogs),netProfit:decimal(revenue-cogs-expense),openingCash:decimal(get('cash','opening')),openingBank:decimal(get('bank','opening')),closingCash:decimal(get('cash','closing')),closingBank:decimal(get('bank','closing')),cashIn:decimal(get('cash','inflow')),cashOut:decimal(get('cash','outflow')),bankIn:decimal(get('bank','inflow')),bankOut:decimal(get('bank','outflow')),externalIn:decimal(external.inflow),externalOut:decimal(external.outflow),documents};
 }
}
