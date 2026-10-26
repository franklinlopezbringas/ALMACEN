import { z } from "zod";
import { utc } from "./contracts";
const n = z.number();
export const membershipSchema = z.object({
  publicId: z.string(),
  membershipId: n,
  memberId: n,
  memberPublicId: z.string(),
  memberCode: z.string(),
  fullName: z.string(),
  planId: n,
  planVersionId: n,
  planName: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.string(),
  contractedPrice: n,
  currencyCode: z.string(),
});
export const branchSchema = z.object({
  branchId: n,
  code: z.string(),
  name: z.string(),
});
export const participantSchema = z.object({
  reservationId: n,
  memberId: n,
  memberCode: z.string(),
  fullName: z.string(),
  status: z.string(),
  waitlistPosition: n.nullable(),
  reservedAtUtc: utc,
});
const status = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);
export const productFormSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(150),
  price: n.min(0).max(999999999),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  minimumStock: n.min(0).max(999999999),
  isPublic: z.boolean(),
  status,
});
export const adminProductSchema = productFormSchema.extend({
  publicId: z.string(),
  stock: n.nullable(),
  rowVersion: z.string(),
});
export const planFormSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(600),
  isPublic: z.boolean(),
  status,
});
export const termsSchema = z.object({
  price: n.min(0).max(999999999),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  durationValue: n.int().positive(),
  durationUnit: z.enum(["DAY", "WEEK", "MONTH", "YEAR"]),
  freezeDaysLimit: n.int().min(0),
  classReservationLimit: n.int().min(0).nullable(),
});
export const createPlanFormSchema = planFormSchema.extend({
  terms: termsSchema,
});
export const adminPlanSchema = planFormSchema.extend({
  description: z.string().nullable(),
  publicId: z.string(),
  planId: n,
  rowVersion: z.string(),
  planVersionId: n.nullable(),
  versionNumber: n.nullable(),
  terms: termsSchema.nullable(),
});
export type AdminProduct = z.infer<typeof adminProductSchema>;
export type AdminPlan = z.infer<typeof adminPlanSchema>;
export type ProductForm = z.infer<typeof productFormSchema>;
export type PlanForm = z.infer<typeof createPlanFormSchema>;
export type Terms = z.infer<typeof termsSchema>;
