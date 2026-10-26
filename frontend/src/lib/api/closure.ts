import { z } from "zod";
import { request, ApiError } from "./client";
import { pageOf, utc } from "./contracts";
import { queryString } from "./gymflow";
const n = z.number();
const nullable = z.string().nullable();
export const handoffSchema = z.object({
  shiftHandoffId: n,
  branchId: n,
  fromEmployeeId: n,
  fromName: z.string(),
  toEmployeeId: n.nullable(),
  toName: nullable,
  cashShiftId: n.nullable(),
  status: z.string(),
  notes: nullable,
  pendingItems: nullable,
  handedOffAtUtc: utc,
  acknowledgedAtUtc: utc.nullable(),
  createdByUserId: n,
  rowVersion: z.string(),
});
export const exceptionSchema = z.object({
  accessExceptionId: n,
  memberId: n,
  fullName: z.string(),
  reason: z.string(),
  status: z.string(),
  validFromUtc: utc,
  validToUtc: utc,
  requestedByUserId: n,
  reviewedByUserId: n.nullable(),
  requestedAtUtc: utc,
  reviewedAtUtc: utc.nullable(),
});
export const incidentSchema = z.object({
  supportTicketId: n,
  memberId: n.nullable(),
  memberName: nullable,
  conversationId: n.nullable(),
  category: z.string(),
  priority: z.string(),
  status: z.string(),
  subject: z.string(),
  createdAtUtc: utc,
});
export const returnSchema = z.object({
  productReturnId: n,
  orderId: n,
  orderItemId: n,
  productId: n,
  productName: z.string(),
  quantity: n,
  amount: n,
  reason: z.string(),
  status: z.string(),
  requestedAtUtc: utc,
});
export const lineSchema = z.object({
  orderItemId: n,
  orderPublicId: z.string(),
  orderNumber: z.string(),
  description: z.string(),
  quantity: n,
  returnedQuantity: n,
  unitPrice: n,
});
export const sourceSchema = z.object({
  paymentSplitId: n,
  methodName: z.string(),
  isCash: z.boolean(),
  amount: n,
  refundedAmount: n,
});
const conversationSchema = z.object({
  conversationId: n,
  subject: nullable,
  conversationType: z.string(),
  createdAtUtc: utc,
  closedAtUtc: utc.nullable(),
});
const messageSchema = z.object({
  messageId: n,
  senderUserId: n,
  body: z.string(),
  sentAtUtc: utc,
});
async function read<T extends z.ZodType>(
  path: string,
  schema: T,
  signal?: AbortSignal,
): Promise<z.output<T>> {
  const p = schema.safeParse(
    await request<unknown>("/api/gymflow/" + path, { signal }),
  );
  if (!p.success)
    throw new ApiError(
      502,
      "No pudimos interpretar la respuesta. Actualiza antes de continuar.",
    );
  return p.data;
}
export async function closureWrite(path: string, body: unknown): Promise<void> {
  await request<unknown>("/api/gymflow/" + path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
const paging = (page: number) => queryString({ page, pageSize: 10 });
export const closure = {
  handoffs: (page: number, s?: AbortSignal) =>
    read("shift-handoffs" + paging(page), pageOf(handoffSchema), s),
  employees: (page: number, s?: AbortSignal) =>
    read(
      "shift-handoffs/employees" + paging(page),
      pageOf(z.object({ employeeId: n, fullName: z.string() })),
      s,
    ),
  exceptions: (page: number, s?: AbortSignal) =>
    read("access/exceptions" + paging(page), pageOf(exceptionSchema), s),
  incidents: (page: number, s?: AbortSignal) =>
    read("incidents" + paging(page), pageOf(incidentSchema), s),
  conversations: (page: number, s?: AbortSignal) =>
    read("conversations" + paging(page), pageOf(conversationSchema), s),
  messages: (id: number, page: number, s?: AbortSignal) =>
    read(
      `conversations/${id}/messages` + paging(page),
      pageOf(messageSchema),
      s,
    ),
  returns: (page: number, s?: AbortSignal) =>
    read("store/returns" + paging(page), pageOf(returnSchema), s),
  lines: (search: string, page: number, s?: AbortSignal) =>
    read(
      "store/returns/lines" + queryString({ search, page, pageSize: 10 }),
      pageOf(lineSchema),
      s,
    ),
  sources: (id: number, s?: AbortSignal) =>
    read(`store/returns/${id}/sources`, z.array(sourceSchema), s),
};
