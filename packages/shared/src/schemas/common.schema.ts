import { z } from "zod";

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const UuidParamSchema = z.object({
  id: z.string().uuid("Must be a valid UUID"),
});

export type UuidParam = z.infer<typeof UuidParamSchema>;

export const ApiMetaSchema = z.object({
  timestamp: z.string().datetime(),
  version: z.string().default("1.0"),
  requestId: z.string().optional(),
});

export type ApiMeta = z.infer<typeof ApiMetaSchema>;

export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    meta: z.object({
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      totalPages: z.number().int().nonnegative(),
      hasNextPage: z.boolean(),
      hasPrevPage: z.boolean(),
    }),
  });
}

export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.boolean().default(true),
    data: dataSchema,
    message: z.string().optional(),
    meta: ApiMetaSchema.optional(),
  });
}

export const ApiErrorResponseSchema = z.object({
  success: z.literal(false).default(false),
  statusCode: z.number().int(),
  error: z.string(),
  message: z.union([z.string(), z.array(z.string())]),
  timestamp: z.string().datetime(),
  path: z.string().optional(),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
