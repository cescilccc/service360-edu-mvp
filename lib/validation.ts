import { z } from "zod";
import { ISSUE_TYPES, MEETING_IMPACTS, PRIORITIES, STATUSES } from "./enums";

export const reportBodySchema = z.object({
  roomToken: z.string().min(1).max(100),
  issueTypeHint: z.enum(ISSUE_TYPES).nullish(),
  description: z.string().trim().min(3).max(2000),
  meetingImpact: z.enum(MEETING_IMPACTS),
  reporterName: z.string().trim().max(120).nullish(),
  reporterContact: z.string().trim().max(200).nullish(),
  photoUrl: z.string().url().max(500).nullish(),
});
export type ReportBody = z.infer<typeof reportBodySchema>;

export const ticketPatchSchema = z
  .object({
    priority: z.enum(PRIORITIES).optional(),
    status: z.enum(STATUSES).optional(),
  })
  .refine((v) => v.priority || v.status, {
    message: "Provide priority and/or status",
  });
export type TicketPatch = z.infer<typeof ticketPatchSchema>;
