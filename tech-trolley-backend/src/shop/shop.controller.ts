import { Body,Controller,Get,Patch,Req,UseGuards } from '@nestjs/common';
import { decimal,shopSchema } from '@tech-trolley/contracts';
import { AuthGuard } from '../auth/auth.guard';
import { db } from '../database/database';
import { fail } from '../common/errors';
import { documentsSql,documentView } from '../accounts/posting.service';
import { ReportsService } from '../reports/reports.service';
@Controller('shop') @UseGuards(AuthGuard)
export class ShopController {constructor(private readonly reports:ReportsService){}
 @Get('state') async state(@Req() req:any){const [shop]=await db.query('SELECT name,address,phone,opened_at FROM shop WHERE id=1');const [{now,today}]=await db.query("SELECT clock_timestamp() AS now,to_char(clock_timestamp() AT TIME ZONE 'Asia/Dhaka','YYYY-MM-DD') AS today");const balances:Record<string,string>={cash:'0.00',bank:'0.00',inventory:'0.00',receivable:'0.00',payable:'0.00',loan:'0.00',advance:'0.00'};for(const row of await db.query('SELECT account,sum(amount) AS amount FROM journal_line GROUP BY account'))balances[row.account]=decimal(row.account==='payable'?-BigInt(row.amount):row.amount);const {sessionHash,...user}=req.user;
  return {user,shop,now,today,balances,units:(await db.query('SELECT * FROM inventory_unit ORDER BY internal_id DESC')).map((u:any)=>({...u,cost:decimal(u.cost)})),documents:(await db.query(`${documentsSql} ORDER BY d.created_at DESC,d.id`)).map(documentView),parties:await db.query('SELECT * FROM party ORDER BY name,id'),categories:await db.query('SELECT * FROM expense_category ORDER BY en,id'),staff:await db.query("SELECT id,name,role FROM app_user WHERE role='STAFF' ORDER BY name"),counts:await db.query('SELECT c.*,d.created_at,d.actor_name,d.business_date FROM cash_count c JOIN document d ON d.id=c.document_id ORDER BY d.created_at DESC'),report:await this.reports.report(req.user,{period:'today'})};}
 @Patch() async update(@Body() body:unknown,@Req() req:any){if(req.user.role!=='OWNER')fail('FORBIDDEN',403);const v=shopSchema.parse(body);await db.transaction(async em=>{await em.query('UPDATE shop SET name=$1,address=$2,phone=$3 WHERE id=1',[v.name,v.address,v.phone]);await em.query("INSERT INTO audit_event(actor_id,action) VALUES($1,'shop_updated')",[req.user.id]);});return {ok:true};}
}
