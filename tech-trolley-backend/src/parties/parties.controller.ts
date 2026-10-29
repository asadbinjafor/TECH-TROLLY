import { Body,Controller,Post,Req,UseGuards } from '@nestjs/common';
import { partySchema } from '@tech-trolley/contracts';
import { randomUUID } from 'node:crypto';
import { AuthGuard } from '../auth/auth.guard';
import { db } from '../database/database';
@Controller('parties') @UseGuards(AuthGuard)
export class PartiesController { @Post() async create(@Body() body:unknown,@Req() req:any){const v=partySchema.parse(body),id=randomUUID();return db.transaction(async em=>{const [p]=await em.query('INSERT INTO party(id,name,phone,kind) VALUES($1,$2,$3,$4) RETURNING *',[id,v.name,v.phone,v.kind]);await em.query("INSERT INTO audit_event(actor_id,action,subject_id) VALUES($1,'party_created',$2)",[req.user.id,id]);return p;});}}
