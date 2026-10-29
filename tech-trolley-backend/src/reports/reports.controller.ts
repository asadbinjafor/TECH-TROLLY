import { Controller,Get,Query,Req,Res,UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { ReportsService } from './reports.service';
const csv=(v:unknown)=>{let s=String(v??'');if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
@Controller('reports') @UseGuards(AuthGuard)
export class ReportsController {constructor(private readonly reports:ReportsService){}
 @Get() report(@Req() req:any,@Query() query:unknown){return this.reports.report(req.user,query);}
 @Get('export') async export(@Req() req:any,@Query() query:unknown,@Res() res:Response){const r=await this.reports.report(req.user,query);const rows=[['Document','Type','Business date','Recorded by','Total BDT','Due BDT','Details'],...r.documents.map((d:any)=>[d.number,d.kind,d.business_date,d.actor_name,d.total,d.due,d.snapshot.note])];res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="tech-trolley-${r.from}-${r.to}.csv"`);res.send('\uFEFF'+rows.map(row=>row.map(csv).join(',')).join('\r\n'));}
}
