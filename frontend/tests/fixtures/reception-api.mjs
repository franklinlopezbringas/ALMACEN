// Isolated UI contract double. Never imported by production or connected to SQL.
import { randomUUID } from "node:crypto";
let shifts, movements, receipts, sales, debts, events, stock, reservations;
const now = () => new Date().toISOString();
const products = [
  {
    publicId: "a617c777-c6a1-4da2-9b2d-c9d9639489aa",
    sku: "GF-BOT",
    name: "Botella deportiva",
    price: 35,
    currencyCode: "PEN",
    status: "ACTIVE",
  },
  {
    publicId: "a617c777-c6a1-4da2-9b2d-c9d9639489ab",
    sku: "GF-TOA",
    name: "Toalla de entrenamiento",
    price: 28,
    currencyCode: "PEN",
    status: "ACTIVE",
  },
];
const methods = [
  { paymentMethodId: 1, code: "CASH", name: "Efectivo", isCash: true },
  { paymentMethodId: 2, code: "YAPE", name: "Yape", isCash: false },
  { paymentMethodId: 3, code: "CARD", name: "Tarjeta", isCash: false },
];
export function resetReception(presentation = false) {
  shifts = [];
  movements = [];
  receipts = new Map();
  sales = new Map();
  debts = new Map();
  events = [];
  stock = new Map(products.map((p) => [p.publicId, 12]));
  reservations = [];
  if (presentation)
    shifts.push({
      cashShiftId: 1,
      branchId: 1,
      registerName: "Caja Mostrador",
      status: "OPEN",
      openedAtUtc: now(),
      closedAtUtc: null,
      openingAmount: 100,
      expectedAmount: 140,
      countedAmount: null,
      differenceAmount: null,
      openingNotes: "Fondo recibido y verificado.",
      closingNotes: null,
    });
  if (presentation)
    movements.push({
      cashShiftId: 1,
      cashMovementId: 1,
      movementType: "INCOME",
      amount: 40,
      description: "Cobro parcial de membresía",
      createdAtUtc: now(),
    });
  if (presentation)
    events.push({
      attendanceEventId: 1,
      memberId: 1,
      memberCode: "GF-100",
      fullName: "Lucía Fernández",
      result: "ALLOWED",
      reasonCode: null,
      accessMethod: "MANUAL",
      occurredAtUtc: now(),
      branchId: 1,
    });
}
resetReception(true);
export function receptionApi(
  path,
  method,
  data,
  url,
  send,
  page,
  people,
  claims,
) {
  const role =
    claims["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
  if (role !== "RECEPTION") return false;
  const member = (id) => people.find((p) => p.memberId === id);
  const record = (body) => {
    if (receipts.has(body.requestId))
      return receipts.get(body.requestId).payment;
    const payment = {
      publicId: body.requestId,
      paymentId: receipts.size + 1,
      receiptNumber: "REC-" + String(receipts.size + 1).padStart(5, "0"),
      totalAmount: body.totalAmount,
      currencyCode: "PEN",
      status: "COMPLETED",
      receivedAtUtc: now(),
    };
    const splits = body.splits.map((s) => ({
      method: methods.find((m) => m.paymentMethodId === s.paymentMethodId).name,
      isCash: methods.find((m) => m.paymentMethodId === s.paymentMethodId)
        .isCash,
      amount: s.amount,
      externalReference: s.externalReference,
    }));
    const cash = splits
      .filter((s) => s.isCash)
      .reduce((total, s) => total + s.amount, 0);
    if (cash) {
      const shift = shifts.find(
        (s) => s.cashShiftId === body.cashShiftId && s.status === "OPEN",
      );
      if (!shift) return null;
      shift.expectedAmount += cash;
      movements.push({
        cashShiftId: shift.cashShiftId,
        cashMovementId: movements.length + 1,
        movementType: "INCOME",
        amount: cash,
        description: "Efectivo · " + payment.receiptNumber,
        createdAtUtc: now(),
      });
    }
    receipts.set(body.requestId, {
      payment,
      memberId: body.memberId,
      memberName: member(body.memberId)?.fullName ?? null,
      splits,
      items:
        body.items?.map((l) => {
          const p = products.find((p) => p.publicId === l.productPublicId);
          return {
            description: p.name,
            quantity: l.quantity,
            unitPrice: p.price,
            totalAmount: p.price * l.quantity,
          };
        }) ?? [],
    });
    return payment;
  };
  if (path === "reception/context")
    send({
      employeeId: 1,
      employeeName: "Isabel Navarro",
      currencyCode: "PEN",
    });
  else if (path === "cash-registers")
    send(
      page(
        [
          {
            cashRegisterId: 1,
            branchId: 1,
            name: "Caja Mostrador",
            branchName: "Sede Centro",
            isOpen: shifts.some((s) => s.status === "OPEN"),
          },
        ],
        url,
      ),
    );
  else if (path === "payment-methods") send(page(methods, url));
  else if (path === "cash-shifts/me")
    send(
      page(
        shifts
          .filter(
            (s) =>
              !url.searchParams.get("status") ||
              s.status === url.searchParams.get("status"),
          )
          .toReversed(),
        url,
      ),
    );
  else if (/^cash-shifts\/\d+\/movements$/.test(path))
    send(
      page(
        movements
          .filter((m) => m.cashShiftId === Number(path.split("/")[1]))
          .toReversed(),
        url,
      ),
    );
  else if (path === "cash-shifts/open") {
    if (shifts.some((s) => s.status === "OPEN")) send({}, 409);
    else {
      const shift = {
        cashShiftId: shifts.length + 1,
        branchId: 1,
        registerName: "Caja Mostrador",
        status: "OPEN",
        openedAtUtc: now(),
        closedAtUtc: null,
        openingAmount: data.openingAmount,
        expectedAmount: data.openingAmount,
        countedAmount: null,
        differenceAmount: null,
        openingNotes: data.openingNotes,
        closingNotes: null,
      };
      shifts.push(shift);
      send(shift, 201);
    }
  } else if (/^cash-shifts\/\d+\/close$/.test(path)) {
    const shift = shifts.find(
      (s) =>
        s.cashShiftId === Number(path.split("/")[1]) && s.status === "OPEN",
    );
    if (!shift) send({}, 409);
    else {
      Object.assign(shift, {
        countedAmount: data.countedAmount,
        differenceAmount: data.countedAmount - shift.expectedAmount,
        status:
          data.countedAmount === shift.expectedAmount
            ? "CLOSED"
            : "REVIEW_REQUIRED",
        closingNotes: data.closingNotes,
        closedAtUtc: now(),
      });
      send(shift);
    }
  } else if (path === "receivables") {
    const id = Number(url.searchParams.get("memberId"));
    const balance = debts.get(id) ?? 120;
    send(
      page(
        balance > 0
          ? [
              {
                receivableId: id,
                memberId: id,
                description: "Membresía Plan Flow",
                totalAmount: 120,
                balanceAmount: balance,
                currencyCode: "PEN",
                dueDate: "2026-10-21",
                status: balance === 120 ? "OPEN" : "PARTIALLY_PAID",
              },
            ]
          : [],
        url,
      ),
    );
  } else if (path === "payments" && method === "GET")
    send(
      page(
        [...receipts.values()]
          .filter(
            (p) => p.memberId === Number(url.searchParams.get("memberId")),
          )
          .map((p) => p.payment)
          .toReversed(),
        url,
      ),
    );
  else if (/^payments\//.test(path)) {
    const r = receipts.get(path.split("/")[1]);
    send(r ?? {}, r ? 200 : 404);
  } else if (path === "payments" && method === "POST") {
    if (receipts.has(data.requestId))
      send(receipts.get(data.requestId).payment, 201);
    else if (data.totalAmount > (debts.get(data.memberId) ?? 120))
      send({}, 409);
    else {
      const result = record(data);
      if (!result) send({}, 409);
      else {
        debts.set(
          data.memberId,
          (debts.get(data.memberId) ?? 120) - data.totalAmount,
        );
        send(result, 201);
      }
    }
  } else if (path === "products" && method === "GET")
    send(
      page(
        products
          .filter((p) =>
            (p.name + " " + p.sku)
              .toLowerCase()
              .includes((url.searchParams.get("search") ?? "").toLowerCase()),
          )
          .map((p) => ({
            ...p,
            stock: url.searchParams.get("branchId")
              ? stock.get(p.publicId)
              : null,
          })),
        url,
      ),
    );
  else if (path === "store/sales") {
    if (sales.has(data.requestId)) send(sales.get(data.requestId));
    else if (
      data.items.some((l) => l.quantity > (stock.get(l.productPublicId) ?? 0))
    )
      send({}, 409);
    else {
      const totalAmount = data.items.reduce(
        (total, l) =>
          total +
          products.find((p) => p.publicId === l.productPublicId).price *
            l.quantity,
        0,
      );
      const payment = record({ ...data, totalAmount });
      if (!payment) send({}, 409);
      else {
        for (const l of data.items)
          stock.set(
            l.productPublicId,
            stock.get(l.productPublicId) - l.quantity,
          );
        const result = {
          orderPublicId: data.requestId,
          orderNumber: "VENTA-" + payment.paymentId,
          payment,
        };
        sales.set(data.requestId, result);
        send(result);
      }
    }
  } else if (path === "access/events")
    send(
      page(
        events
          .filter(
            (a) =>
              (!url.searchParams.get("memberId") ||
                a.memberId === Number(url.searchParams.get("memberId"))) &&
              (!url.searchParams.get("fromUtc") ||
                a.occurredAtUtc >= url.searchParams.get("fromUtc")) &&
              (!url.searchParams.get("toUtc") ||
                a.occurredAtUtc <= url.searchParams.get("toUtc")),
          )
          .toReversed(),
        url,
      ),
    );
  else if (path === "access/check-in" || path === "access/check-in/qr") {
    const m = member(
      path.endsWith("/qr")
        ? data.credential === "fixture-qr-lucia"
          ? 1
          : 0
        : data.memberId,
    );
    if (!m) send({}, 404);
    else {
      const result = m.memberId === 4 ? "DENIED" : "ALLOWED";
      const event = {
        attendanceEventId: events.length + 1,
        memberId: m.memberId,
        memberCode: m.memberCode,
        fullName: m.fullName,
        result,
        reasonCode: result === "DENIED" ? "NO_ACTIVE_MEMBERSHIP" : null,
        accessMethod: path.endsWith("/qr") ? "QR" : "MANUAL",
        occurredAtUtc: now(),
        branchId: data.branchId,
      };
      events.push(event);
      send({ ...event, allowed: result === "ALLOWED" });
    }
  } else if (/^members\//.test(path) && method === "PUT") {
    const m = people.find((m) => m.publicId === path.split("/")[1]);
    if (!m) send({}, 404);
    else if (data.rowVersion !== m.rowVersion) send({}, 409);
    else {
      Object.assign(m, data, {
        fullName: data.firstName + " " + data.lastName,
        rowVersion: Buffer.from(randomUUID()).toString("base64"),
      });
      send(null, 204);
    }
  } else if (/^classes\/sessions\/\d+\/reserve\/\d+$/.test(path)) {
    const session = Number(path.split("/")[2]);
    const id = Number(path.split("/")[4]);
    if (reservations.some((r) => r.memberId === id && r.session === session))
      send({}, 409);
    else {
      reservations.push({ session, memberId: id });
      send(null, 204);
    }
  } else if (/^classes\/sessions\/\d+\/participants$/.test(path)) {
    const selected = reservations.filter(
      (r) => r.session === Number(path.split("/")[2]),
    );
    send(
      page(
        selected.map((r, i) => ({
          reservationId: i + 1,
          memberId: r.memberId,
          memberCode: member(r.memberId)?.memberCode ?? "",
          fullName: member(r.memberId)?.fullName ?? "",
          status: i < 2 ? "CONFIRMED" : "WAITLISTED",
          waitlistPosition: i < 2 ? null : i - 1,
          reservedAtUtc: now(),
        })),
        url,
      ),
    );
  } else if (path === "memberships" && method === "POST")
    send({
      publicId: data.requestId,
      membershipId: 20,
      startDate: data.startDate,
      endDate: "2026-12-21",
      contractedPrice: 120,
      currencyCode: "PEN",
      status: "ACTIVE",
      receivableId: data.memberId,
    });
  else return false;
  return true;
}
