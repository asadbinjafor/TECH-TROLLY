import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import { ZodError } from "@tech-trolley/contracts";
export function fail(code: string, status = 400): never {
  throw new HttpException({ code }, status);
}
@Catch()
export class Errors implements ExceptionFilter {
  catch(error: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (error?.type === "entity.too.large")
      return res.status(413).json({ code: "IMAGE_TOO_LARGE" });
    if (error instanceof ZodError)
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        details: error.issues.map((i) => ({
          field: i.path.join("."),
          code: /^[A-Z_]+$/.test(i.message) ? i.message : "VALIDATION_ERROR",
        })),
      });
    if (error instanceof HttpException)
      return res
        .status(error.getStatus())
        .json(
          typeof error.getResponse() === "object"
            ? error.getResponse()
            : { code: "SERVER_ERROR" },
        );
    if (error?.code === "23505")
      return res.status(409).json({ code: "DUPLICATE" });
    if (error?.code === "23503")
      return res.status(409).json({ code: "DEPENDENCY_CONFLICT" });
    console.error("Request failed", {
      type: error?.constructor?.name,
      code: error?.code,
    });
    return res.status(500).json({ code: "SERVER_ERROR" });
  }
}
