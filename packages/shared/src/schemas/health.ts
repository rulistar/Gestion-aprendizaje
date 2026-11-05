import { z } from 'zod';

/** Respuesta de GET /api/v1/health. La api la produce y la web la valida con el mismo esquema. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  uptime: z.number().nonnegative(),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
