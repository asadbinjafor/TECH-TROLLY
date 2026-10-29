import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { categorySchema, z } from "@tech-trolley/contracts";
import { randomUUID } from "node:crypto";
import { AuthGuard } from "../auth/auth.guard";
import { db } from "../database/database";
import { fail } from "../common/errors";
@Controller("expense-categories")
@UseGuards(AuthGuard)
export class CategoriesController {
  @Post() create(@Body() body: unknown, @Req() req: any) {
    return this.save(randomUUID(), body, req, true);
  }
  @Patch(":id") update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    z.uuid().parse(id);
    return this.save(id, body, req, false);
  }
  private async save(id: string, body: unknown, req: any, isNew: boolean) {
    const v = categorySchema.parse(body);
    return db.transaction(async (em) => {
      await em.query("SELECT id FROM shop WHERE id=1 FOR UPDATE");
      const [exists] = await em.query(
        "SELECT id FROM expense_category WHERE id=$1",
        [id],
      );
      if (!isNew && !exists) fail("NOT_FOUND", 404);
      const [duplicate] = await em.query(
        "SELECT id FROM expense_category WHERE active AND id<>$1 AND (lower(bn) IN (lower($2),lower($3)) OR lower(en) IN (lower($2),lower($3)))",
        [id, v.bn, v.en],
      );
      if (v.active && duplicate) fail("DUPLICATE", 409);
      const [result] = await em.query(
        isNew
          ? "INSERT INTO expense_category(id,bn,en,active) VALUES($1,$2,$3,$4) RETURNING *"
          : "UPDATE expense_category SET bn=$2,en=$3,active=$4 WHERE id=$1 RETURNING *",
        [id, v.bn, v.en, v.active],
      );
      await em.query(
        "INSERT INTO audit_event(actor_id,action,subject_id) VALUES($1,'category_saved',$2)",
        [req.user.id, id],
      );
      return result;
    });
  }
}
