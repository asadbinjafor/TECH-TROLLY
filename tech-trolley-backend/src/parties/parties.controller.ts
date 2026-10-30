import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  partySchema,
  partyUpdateSchema,
  partyActiveSchema,
  z,
} from "@tech-trolley/contracts";
import { randomUUID } from "node:crypto";
import { AuthGuard } from "../auth/auth.guard";
import { db } from "../database/database";
import { fail } from "../common/errors";
@Controller("parties")
@UseGuards(AuthGuard)
export class PartiesController {
  @Post() create(@Body() body: unknown, @Req() req: any) {
    return this.save(randomUUID(), partySchema.parse(body), req, "create");
  }
  @Patch(":id") update(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    z.uuid().parse(id);
    return this.save(id, partyUpdateSchema.parse(body), req, "update");
  }
  @Delete(":id") archive(@Param("id") id: string, @Req() req: any) {
    z.uuid().parse(id);
    return this.save(id, { active: false }, req, "active");
  }
  @Patch(":id/active") active(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    z.uuid().parse(id);
    return this.save(id, partyActiveSchema.parse(body), req, "active");
  }
  private async save(
    id: string,
    values: Record<string, unknown>,
    req: any,
    mode: "create" | "update" | "active",
  ) {
    return db.transaction(async (em) => {
      // Match posting lock order so archive/rename cannot race a new posting.
      await em.query("SELECT id FROM shop WHERE id=1 FOR UPDATE");
      const [before] = await em.query(
        "SELECT * FROM party WHERE id=$1 AND NOT is_walk_in FOR UPDATE",
        [id],
      );
      if (mode !== "create" && !before) fail("NOT_FOUND", 404);
      const v = { active: true, ...before, ...values };
      const [duplicate] = await em.query(
        "SELECT id FROM party WHERE id<>$1 AND active AND NOT is_walk_in AND kind=$2 AND lower(name)=lower($3) AND phone=$4",
        [id, v.kind, v.name, v.phone],
      );
      if (v.active && duplicate) fail("DUPLICATE", 409);
      const [p] = await em.query(
        mode === "create"
          ? "INSERT INTO party(id,name,phone,address,kind) VALUES($1,$2,$3,$4,$5) RETURNING *"
          : "WITH saved AS (UPDATE party SET name=$2,phone=$3,address=$4,active=$5 WHERE id=$1 RETURNING *) SELECT * FROM saved",
        mode === "create"
          ? [id, v.name, v.phone, v.address, v.kind]
          : [id, v.name, v.phone, v.address, v.active],
      );
      await em.query(
        "INSERT INTO audit_event(actor_id,action,subject_id,details) VALUES($1,$2,$3,$4)",
        [
          req.user.id,
          mode === "create"
            ? "party_created"
            : mode === "update"
              ? "party_updated"
              : v.active
                ? "party_restored"
                : "party_archived",
          id,
          { before: before || null, after: p },
        ],
      );
      return p;
    });
  }
}
