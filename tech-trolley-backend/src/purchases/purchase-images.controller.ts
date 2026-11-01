import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import type { Response } from "express";
import sharp from "sharp";
import { z } from "@tech-trolley/contracts";
import { AuthGuard } from "../auth/auth.guard";
import { db } from "../database/database";
import { fail } from "../common/errors";

const maxBytes = 512 * 1024;
const purposes = z.enum(["memo", "nidFront", "nidBack"]);
// Leave room for the accounting database on the existing Free plan.
const evidenceBudget = 128 * 1024 * 1024;
async function purchase(tx: any, id: string, user: any) {
  const [d] = await tx.query(
    `SELECT id,snapshot FROM document WHERE id=$1 AND kind='purchase'
    AND ($2::boolean OR business_date=(now() AT TIME ZONE 'Asia/Dhaka')::date) FOR UPDATE`,
    [id, user.role === "OWNER"],
  );
  if (!d) fail("NOT_FOUND", 404);
  return d;
}
@Controller("purchases")
@UseGuards(AuthGuard)
export class PurchaseImagesController {
  @Get("attachments-config") config() {
    return { enabled: true, maxBytes, maxMemo: 4 };
  }

  @Post("files/:id") async stage(
    @Param("id") id: string,
    @Query("purpose") input: string,
    @Req() req: any,
  ) {
    z.uuid().parse(id);
    const purpose = purposes.parse(input);
    if (
      !Buffer.isBuffer(req.body) ||
      req.body.length === 0 ||
      req.body.length > maxBytes
    )
      fail("IMAGE_INVALID");
    const inputBytes: Buffer = req.body,
      hash = createHash("sha256").update(inputBytes).digest("hex");
    let bytes: Buffer;
    try {
      const image = sharp(inputBytes, {
        limitInputPixels: 16_000_000,
        animated: false,
        failOn: "warning",
      });
      const meta = await image.metadata();
      if (
        !["jpeg", "png", "webp"].includes(meta.format || "") ||
        (meta.pages || 1) !== 1
      )
        fail("IMAGE_INVALID");
      bytes = await image
        .rotate()
        .resize({
          width: 2200,
          height: 3000,
          fit: "inside",
          withoutEnlargement: true,
        })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
      if (bytes.length > maxBytes) fail("IMAGE_TOO_LARGE");
    } catch {
      fail("IMAGE_INVALID");
    }
    await db.transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(74819322)");
      const [old] = await tx.query(
        "SELECT uploader_id,purpose,source_hash FROM purchase_image WHERE id=$1",
        [id],
      );
      if (old) {
        if (
          old.uploader_id !== req.user.id ||
          old.purpose !== purpose ||
          old.source_hash !== hash
        )
          fail("IMAGE_CONFLICT", 409);
        return;
      }
      await tx.query(
        `DELETE FROM purchase_image i WHERE expires_at<now() AND NOT EXISTS(SELECT 1 FROM purchase_image_link l WHERE l.image_id=i.id)`,
      );
      const [usage] = await tx.query(
        `SELECT coalesce(sum(octet_length(content)),0)::text AS total,
        count(*) FILTER(WHERE uploader_id=$1 AND created_at>now()-interval '1 hour')::int AS recent,
        count(*) FILTER(WHERE uploader_id=$1 AND NOT EXISTS(SELECT 1 FROM purchase_image_link l WHERE l.image_id=purchase_image.id))::int AS staged FROM purchase_image`,
        [req.user.id],
      );
      if (Number(usage.total) + bytes.length > evidenceBudget)
        fail("IMAGE_STORAGE_FULL", 413);
      if (usage.recent >= 60 || usage.staged >= 12)
        fail("IMAGE_UPLOAD_LIMIT", 429);
      await tx.query(
        "INSERT INTO purchase_image(id,uploader_id,purpose,source_hash,content) VALUES($1,$2,$3,$4,$5)",
        [id, req.user.id, purpose, hash, bytes],
      );
    });
    return { id, purpose };
  }

  @Get("files/:id") async file(
    @Param("id") id: string,
    @Query("download") download: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    z.uuid().parse(id);
    const [image] = await db.query(
      `SELECT i.content,i.purpose FROM purchase_image i LEFT JOIN purchase_image_link l ON l.image_id=i.id LEFT JOIN document d ON d.id=l.document_id
      WHERE i.id=$1 AND ((l.image_id IS NULL AND i.uploader_id=$2 AND i.expires_at>now()) OR
      (l.image_id IS NOT NULL AND (l.removed_at IS NULL OR $3::boolean) AND ($3::boolean OR d.business_date=(now() AT TIME ZONE 'Asia/Dhaka')::date)))`,
      [id, req.user.id, req.user.role === "OWNER"],
    );
    if (!image) fail("NOT_FOUND", 404);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Disposition",
      `${download === "1" ? "attachment" : "inline"}; filename="${image.purpose}-${id}.jpg"`,
    );
    return res.type("image/jpeg").send(image.content);
  }

  @Get(":id/attachments") async list(@Param("id") id: string, @Req() req: any) {
    z.uuid().parse(id);
    return db.transaction(async (tx) => {
      await purchase(tx, id, req.user);
      return {
        images: await tx.query(
          `SELECT i.id,i.purpose,i.created_at,l.removed_at,u.name AS uploaded_by,r.name AS removed_by FROM purchase_image_link l JOIN purchase_image i ON i.id=l.image_id JOIN app_user u ON u.id=i.uploader_id LEFT JOIN app_user r ON r.id=l.removed_by WHERE l.document_id=$1 AND (l.removed_at IS NULL OR $2::boolean) ORDER BY l.linked_at,i.id`,
          [id, req.user.role === "OWNER"],
        ),
      };
    });
  }

  @Post(":id/attachments") async link(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    z.uuid().parse(id);
    const { ids } = z
      .object({ ids: z.array(z.uuid()).min(1).max(4) })
      .strict()
      .parse(body);
    if (new Set(ids).size !== ids.length) fail("IMAGE_INVALID");
    await db.transaction(async (tx) => {
      const d = await purchase(tx, id, req.user),
        individual = d.snapshot.purchaseSource === "individual";
      const current = await tx.query(
        "SELECT i.id,i.purpose,l.removed_at FROM purchase_image_link l JOIN purchase_image i ON i.id=l.image_id WHERE l.document_id=$1",
        [id],
      );
      const pending = [];
      for (const imageId of ids) {
        if (current.some((i: any) => i.id === imageId)) continue; // lost-response retry never reinstates removed evidence
        const [i] = await tx.query(
          `SELECT i.id,i.purpose FROM purchase_image i WHERE id=$1 AND uploader_id=$2 AND expires_at>now() AND NOT EXISTS(SELECT 1 FROM purchase_image_link l WHERE l.image_id=i.id) FOR UPDATE`,
          [imageId, req.user.id],
        );
        if (!i || (individual ? i.purpose === "memo" : i.purpose !== "memo"))
          fail("IMAGE_INVALID");
        pending.push(i);
      }
      const active = [...current.filter((i: any) => !i.removed_at), ...pending];
      if (
        individual
          ? active.length > 2 ||
            new Set(active.map((i: any) => i.purpose)).size !== active.length
          : active.length > 4
      )
        fail("IMAGE_LIMIT", 409);
      for (const i of pending) {
        await tx.query(
          "INSERT INTO purchase_image_link(image_id,document_id,linked_by) VALUES($1,$2,$3)",
          [i.id, id, req.user.id],
        );
        await tx.query(
          `INSERT INTO audit_event(actor_id,action,subject_id,details) VALUES($1,'purchase.image.link',$2,$3)`,
          [
            req.user.id,
            id,
            JSON.stringify({ imageId: i.id, purpose: i.purpose }),
          ],
        );
      }
    });
    return { ok: true };
  }

  @Post(":id/attachments/:imageId/remove") async remove(
    @Param("id") id: string,
    @Param("imageId") imageId: string,
    @Req() req: any,
  ) {
    z.uuid().parse(id);
    z.uuid().parse(imageId);
    await db.transaction(async (tx) => {
      await purchase(tx, id, req.user);
      const rows = await tx.query(
        "UPDATE purchase_image_link SET removed_at=now(),removed_by=$3 WHERE document_id=$1 AND image_id=$2 AND removed_at IS NULL RETURNING image_id",
        [id, imageId, req.user.id],
      );
      if (rows.length)
        await tx.query(
          `INSERT INTO audit_event(actor_id,action,subject_id,details) VALUES($1,'purchase.image.remove',$2,$3)`,
          [req.user.id, id, JSON.stringify({ imageId })],
        );
    });
    return { ok: true };
  }
}
