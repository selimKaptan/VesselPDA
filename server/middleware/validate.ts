import { z, type ZodTypeAny } from "zod";
import type { Request, Response, NextFunction } from "express";

function formatErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

/**
 * Validate req.body against a Zod schema.
 * On success, req.body is replaced with the parsed (stripped) data.
 * On failure, responds with 400 + { message, errors }.
 */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: "Invalid request data",
        errors: formatErrors(result.error),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validate req.query against a Zod schema.
 * On failure, responds with 400 + { message, errors }.
 */
export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        message: "Invalid query parameters",
        errors: formatErrors(result.error),
      });
      return;
    }
    next();
  };
}

/**
 * Validate req.params against a Zod schema.
 * On failure, responds with 400 + { message, errors }.
 */
export function validateParams(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({
        message: "Invalid URL parameters",
        errors: formatErrors(result.error),
      });
      return;
    }
    next();
  };
}

// ── Common reusable param schemas ─────────────────────────────────────────────

export const integerIdParam = z.object({
  id: z.string().regex(/^\d+$/, "ID must be a positive integer").transform(Number),
});

export const uuidParam = z.object({
  id: z.string().uuid("ID must be a valid UUID"),
});
