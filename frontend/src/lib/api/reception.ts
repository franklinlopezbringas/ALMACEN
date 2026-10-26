import { z } from "zod";
import { request, ApiError } from "./client";
import { queryString } from "./gymflow";
import { pageOf } from "./contracts";
import { memberDetailSchema } from "./contracts";
import * as c from "./reception-contracts";
const root = "/api/gymflow/";
async function read<T extends z.ZodType>(
  path: string,
  schema: T,
  signal?: AbortSignal,
): Promise<z.output<T>> {
  const parsed = schema.safeParse(
    await request<unknown>(root + path, { signal }),
  );
  if (!parsed.success)
    throw new ApiError(
      502,
      "No pudimos interpretar la información. Actualiza antes de continuar.",
    );
  return parsed.data;
}
async function write<T extends z.ZodType>(
  path: string,
  body: unknown,
  schema: T,
): Promise<z.output<T>> {
  const parsed = schema.safeParse(
    await request<unknown>(root + path, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
  if (!parsed.success)
    throw new ApiError(
      502,
      "El resultado no pudo confirmarse. Reintenta la misma solicitud para comprobarlo sin duplicarla.",
    );
  return parsed.data;
}
const paging = (page: number) => queryString({ page, pageSize: 10 });
export const reception = {
  openShifts: (signal?: AbortSignal) =>
    read(
      "cash-shifts/me?status=OPEN&pageSize=100",
      pageOf(c.shiftSchema),
      signal,
    ),
  qrCheckIn: (credential: string, branchId: number) =>
    write(
      "access/check-in/qr",
      { credential, branchId },
      c.checkInResultSchema,
    ),
  member: (id: string, signal?: AbortSignal) =>
    read(
      "members/" + encodeURIComponent(id),
      memberDetailSchema.extend({
        memberId: z.number().int().positive(),
        rowVersion: z.string(),
      }),
      signal,
    ),
  membership: (data: {
    memberId: number;
    planVersionId: number;
    homeBranchId: number | null;
    startDate: string;
    origin: "RECEPTION";
    previousMembershipId: number | null;
    requestId: string;
  }) =>
    write(
      "memberships",
      data,
      z.object({
        publicId: z.string(),
        membershipId: z.number(),
        contractedPrice: z.number(),
        currencyCode: z.string(),
        status: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        receivableId: z.number().nullable(),
      }),
    ),
  context: (signal?: AbortSignal) =>
    read("reception/context", c.contextSchema, signal),
  registers: (page = 1, signal?: AbortSignal) =>
    read("cash-registers" + paging(page), pageOf(c.registerSchema), signal),
  methods: (page = 1, signal?: AbortSignal) =>
    read(
      "payment-methods" + queryString({ page, pageSize: 100 }),
      pageOf(c.methodSchema),
      signal,
    ),
  debts: (memberId: number, page = 1, signal?: AbortSignal) =>
    read(
      "receivables" + queryString({ memberId, page, pageSize: 10 }),
      pageOf(c.debtSchema),
      signal,
    ),
  shifts: (page = 1, signal?: AbortSignal) =>
    read("cash-shifts/me" + paging(page), pageOf(c.shiftSchema), signal),
  movements: (id: number, page = 1, signal?: AbortSignal) =>
    read(
      `cash-shifts/${id}/movements` + paging(page),
      pageOf(c.movementSchema),
      signal,
    ),
  events: (
    filters: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ) =>
    read(
      "access/events" + queryString({ pageSize: 10, ...filters }),
      pageOf(c.accessSchema),
      signal,
    ),
  payments: (memberId: number, page = 1, signal?: AbortSignal) =>
    read(
      "payments" + queryString({ memberId, page, pageSize: 10 }),
      pageOf(c.paymentSchema),
      signal,
    ),
  receipt: (id: string, signal?: AbortSignal) =>
    read("payments/" + encodeURIComponent(id), c.receiptSchema, signal),
  pay: (data: c.PaymentInput) => write("payments", data, c.paymentSchema),
  sell: (data: c.PosInput) => write("store/sales", data, c.posResultSchema),
  open: (data: {
    cashRegisterId: number;
    employeeId: number;
    openingAmount: number;
    openingNotes: string | null;
  }) =>
    write(
      "cash-shifts/open",
      data,
      z.object({ cashShiftId: z.number(), status: z.string() }),
    ),
  close: (
    id: number,
    data: { countedAmount: number; closingNotes: string | null },
  ) =>
    write(
      `cash-shifts/${id}/close`,
      data,
      z.object({
        cashShiftId: z.number(),
        status: z.string(),
        expectedAmount: z.number(),
        countedAmount: z.number(),
        differenceAmount: z.number(),
      }),
    ),
  updateMember: (
    id: string,
    data: {
      firstName: string;
      lastName: string;
      phone: string | null;
      email: string | null;
      rowVersion: string;
    },
  ) =>
    request<void>(root + "members/" + encodeURIComponent(id), {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
