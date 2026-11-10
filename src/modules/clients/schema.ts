import { z } from "zod";

export const createClientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  domain: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
