import { z } from "zod";
// SQL datetime2 UTC fields have no suffix; never interpret them as browser-local time.
export const utc = z
  .string()
  .transform((value) =>
    /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : value + "Z",
  );
const n = z.coerce.number();
const text = z.string().nullable();
export const memberSchema = z.object({
  memberId: n.optional(),
  publicId: z.string(),
  memberCode: z.string(),
  fullName: z.string(),
  documentNumber: text,
  phone: text,
  status: z.string(),
  membershipStatus: text,
  membershipEndDate: text,
});
export const memberDetailSchema = z.object({
  memberId: n.optional(),
  rowVersion: text.optional(),
  publicId: z.string(),
  memberCode: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  documentType: text,
  documentNumber: text,
  phone: text,
  email: text,
  status: z.string(),
  homeBranchId: n.nullable(),
});
export const prospectSchema = z.object({
  prospectId: n,
  fullName: z.string(),
  phone: text,
  email: text,
  status: z.string(),
  leadSource: text,
  nextFollowUpAtUtc: utc.nullable(),
  interestedPlan: text,
  lastContactAtUtc: utc.nullable(),
});
export const dashboardSchema = z.object({
  activeMembers: n,
  expiringMembershipsNext7Days: n,
  outstandingReceivables: n,
  entriesToday: n,
});
export const expiringSchema = z.object({
  membershipPublicId: z.string(),
  memberId: n,
  memberCode: z.string(),
  fullName: z.string(),
  endDate: z.string(),
  daysRemaining: n,
  planName: z.string(),
});
export const classSchema = z.object({
  classSessionId: n,
  className: z.string(),
  startsAtUtc: utc,
  endsAtUtc: utc,
  capacity: n,
  reserved: n,
  coachName: text,
  availablePlaces: n,
  status: z.string(),
});
export const productSchema = z.object({
  publicId: z.string(),
  sku: z.string(),
  name: z.string(),
  price: n,
  currencyCode: z.string(),
  stock: n.nullable(),
  status: z.string(),
});
export const planSchema = z.object({
  publicId: z.string(),
  code: z.string(),
  name: z.string(),
  description: text,
  price: n,
  currencyCode: z.string(),
  durationValue: n,
  durationUnit: z.string(),
  freezeDaysLimit: n,
});
export const notificationSchema = z.object({
  id: n,
  type: z.string(),
  title: z.string(),
  body: z.string(),
  status: z.string(),
  createdAtUtc: utc,
  readAtUtc: utc.nullable(),
});
export const assignedSchema = z.object({
  memberId: n,
  publicId: z.string(),
  memberCode: z.string(),
  fullName: z.string(),
  membershipStatus: text,
  membershipEndDate: text,
});
export const rewardSchema = z.object({
  publicId: z.string(),
  type: z.string(),
  name: z.string(),
  description: text,
  pointsCost: n,
  status: z.string(),
});
export const balanceSchema = z.object({
  memberId: n,
  currentBalance: n,
  lifetimeEarned: n,
  lifetimeRedeemed: n,
});
export const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: n,
    pageSize: n,
    total: n,
    totalPages: n,
  });
export type Member = z.infer<typeof memberSchema>;
export type Prospect = z.infer<typeof prospectSchema>;
export const personFormSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "Escribe al menos 2 caracteres.")
    .max(100),
  lastName: z.string().trim().min(2, "Escribe al menos 2 caracteres.").max(150),
  documentType: z.string().trim().max(20, "Usa hasta 20 caracteres."),
  documentNumber: z.string().trim().max(40, "Usa hasta 40 caracteres."),
  phone: z.string().trim().max(30),
  email: z.union([z.email("Escribe un correo válido."), z.literal("")]),
  notes: z.string().max(1000),
});
export type PersonForm = z.infer<typeof personFormSchema>;
