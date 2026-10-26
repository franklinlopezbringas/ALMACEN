import { z } from "zod";
import { utc } from "./contracts";
export { utc } from "./contracts";

export const checkInSchema = z.object({
  memberId: z.number().int().positive(),
  branchId: z.number().int().positive("Selecciona una sede."),
  accessMethod: z.literal("MANUAL"),
  deviceId: z.null(),
});
export const checkInResultSchema = z.object({
  allowed: z.boolean(),
  result: z.enum(["ALLOWED", "DENIED", "EXCEPTION"]),
  reasonCode: z.string().nullable(),
  attendanceEventId: z.number().int().positive(),
  occurredAtUtc: z.string(),
});
export const accessReason: Record<string, string> = {
  MEMBER_INACTIVE: "El socio está inactivo.",
  NO_ACTIVE_MEMBERSHIP:
    "No tiene una membresía vigente ni una excepción aprobada.",
  AUTHORIZED_EXCEPTION: "Ingreso registrado con excepción autorizada.",
};
const n = z.number();
const nullableText = z.string().nullable();
export const contextSchema = z.object({
  employeeId: n.nullable(),
  employeeName: nullableText,
  currencyCode: z.string(),
});
export const registerSchema = z.object({
  cashRegisterId: n,
  branchId: n,
  name: z.string(),
  branchName: z.string(),
  isOpen: z.boolean(),
});
export const methodSchema = z.object({
  paymentMethodId: n,
  code: z.string(),
  name: z.string(),
  isCash: z.boolean(),
});
export const debtSchema = z.object({
  receivableId: n,
  memberId: n,
  description: z.string(),
  totalAmount: n,
  balanceAmount: n,
  currencyCode: z.string(),
  dueDate: z.string(),
  status: z.string(),
});
export const shiftSchema = z.object({
  cashShiftId: n,
  branchId: n,
  registerName: z.string(),
  status: z.string(),
  openedAtUtc: utc,
  closedAtUtc: utc.nullable(),
  openingAmount: n,
  expectedAmount: n,
  countedAmount: n.nullable(),
  differenceAmount: n.nullable(),
  openingNotes: nullableText,
  closingNotes: nullableText,
});
export const movementSchema = z.object({
  cashMovementId: n,
  movementType: z.string(),
  amount: n,
  description: z.string(),
  createdAtUtc: utc,
});
export const accessSchema = z.object({
  attendanceEventId: n,
  memberId: n,
  memberCode: z.string(),
  fullName: z.string(),
  result: z.string(),
  reasonCode: nullableText,
  accessMethod: z.string(),
  occurredAtUtc: utc,
  branchId: n,
});
export const paymentSchema = z.object({
  publicId: z.string(),
  paymentId: n,
  receiptNumber: nullableText,
  totalAmount: n,
  currencyCode: z.string(),
  status: z.string(),
  receivedAtUtc: utc,
});
export const receiptSchema = z.object({
  payment: paymentSchema,
  memberName: nullableText,
  splits: z.array(
    z.object({
      method: z.string(),
      isCash: z.boolean(),
      amount: n,
      externalReference: nullableText,
    }),
  ),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: n,
      unitPrice: n,
      totalAmount: n,
    }),
  ),
});
export const posResultSchema = z.object({
  orderPublicId: z.string(),
  orderNumber: z.string(),
  payment: paymentSchema,
});
export const moneyInput = n
  .min(0)
  .max(9999999)
  .refine(
    (v) => Math.abs(v * 10000 - Math.round(v * 10000)) < 0.00001,
    "Usa hasta 4 decimales.",
  );
export const splitFormSchema = z.object({
  splits: z
    .array(
      z.object({
        paymentMethodId: n.int().positive("Selecciona un medio de pago."),
        amount: moneyInput.refine(
          (v) => v > 0,
          "Ingresa un importe mayor que cero.",
        ),
        externalReference: z.string().trim().max(150),
      }),
    )
    .min(1)
    .max(5),
});
export type SplitForm = z.infer<typeof splitFormSchema>;
export type Debt = z.infer<typeof debtSchema>;
export type Shift = z.infer<typeof shiftSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type PosInput = {
  requestId: string;
  branchId: number;
  memberId: number | null;
  cashShiftId: number | null;
  currencyCode: string;
  items: {
    productPublicId: string;
    quantity: number;
    expectedUnitPrice: number;
  }[];
  splits: {
    paymentMethodId: number;
    amount: number;
    externalReference: string | null;
    providerTransactionId: null;
  }[];
};
export type PaymentInput = Omit<PosInput, "items"> & {
  orderId: null;
  totalAmount: number;
  source: "RECEPTION";
  allocations: { receivableId: number; amount: number }[];
};
export const moneyUnits = (value: number) => Math.round(value * 10000);
