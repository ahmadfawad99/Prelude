import { z } from "zod";

export const INQUIRY_TYPES = [
  "CALL_REQUIRED",
  "RFP_BASED",
  "POC_REQUIRED",
  "ESTIMATION_ONLY",
] as const;

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export const createInquirySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  clientId: z.string().cuid().optional().or(z.literal("")),
  assigneeId: z.string().cuid().optional().or(z.literal("")),
  type: z.array(z.enum(INQUIRY_TYPES)).default([]),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  source: z.string().trim().max(200).optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1)).default([]),
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;

export const updateInquirySchema = createInquirySchema.partial();
export type UpdateInquiryInput = z.infer<typeof updateInquirySchema>;
