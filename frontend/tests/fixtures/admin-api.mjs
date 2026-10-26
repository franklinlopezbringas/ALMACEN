// Isolated contract fixture only. Never imported by production application code.
import { randomUUID } from "node:crypto";
let version = 1;
const rowVersion = () =>
  Buffer.from(String(version++).padStart(8, "0")).toString("base64");
const products = [
  {
    publicId: randomUUID(),
    sku: "GF-01",
    name: "Botella deportiva",
    price: 35,
    currencyCode: "PEN",
    minimumStock: 5,
    isPublic: true,
    status: "ACTIVE",
    rowVersion: rowVersion(),
  },
  {
    publicId: randomUUID(),
    sku: "GF-02",
    name: "Toalla de entrenamiento",
    price: 28,
    currencyCode: "PEN",
    minimumStock: 3,
    isPublic: true,
    status: "ACTIVE",
    rowVersion: rowVersion(),
  },
];
const plans = [
  {
    publicId: randomUUID(),
    planId: 1,
    code: "FLOW",
    name: "Plan Flow",
    description: "Tu entrenamiento, con la flexibilidad que necesitas.",
    isPublic: true,
    status: "ACTIVE",
    rowVersion: rowVersion(),
    planVersionId: 1,
    versionNumber: 1,
    terms: {
      price: 120,
      currencyCode: "PEN",
      durationValue: 1,
      durationUnit: "MONTH",
      freezeDaysLimit: 5,
      classReservationLimit: null,
    },
  },
  {
    publicId: randomUUID(),
    planId: 2,
    code: "PLUS",
    name: "Plan Plus",
    description: "Un siguiente paso para mantener tu constancia.",
    isPublic: true,
    status: "ACTIVE",
    rowVersion: rowVersion(),
    planVersionId: 2,
    versionNumber: 1,
    terms: {
      price: 300,
      currencyCode: "PEN",
      durationValue: 3,
      durationUnit: "MONTH",
      freezeDaysLimit: 10,
      classReservationLimit: null,
    },
  },
];
export function adminApi(path, method, data, url, send, page, people) {
  const filter = (rows) =>
    rows.filter(
      (p) =>
        (!url.searchParams.get("status") ||
          p.status === url.searchParams.get("status")) &&
        `${p.name} ${p.sku ?? p.code}`
          .toLowerCase()
          .includes((url.searchParams.get("search") ?? "").toLowerCase()),
    );
  if (path === "branches") {
    send(page([{ branchId: 1, code: "CENTRO", name: "Sede Centro" }], url));
    return true;
  }
  if (path === "products/manage") {
    send(
      page(
        filter(products).map((p) => ({
          ...p,
          stock: url.searchParams.get("branchId") ? 12 : null,
        })),
        url,
      ),
    );
    return true;
  }
  if (path === "products" && method === "POST") {
    const p = { ...data, publicId: randomUUID(), rowVersion: rowVersion() };
    products.push(p);
    send({ publicId: p.publicId });
    return true;
  }
  if (/^products\//.test(path) && method === "PUT") {
    const p = products.find((p) => p.publicId === path.split("/")[1]);
    if (!p) send({}, 404);
    else if (p.rowVersion !== data.rowVersion) send({}, 409);
    else {
      Object.assign(p, data, { rowVersion: rowVersion() });
      send({ publicId: p.publicId });
    }
    return true;
  }
  if (path === "plans" && method === "GET") {
    send(page(filter(plans), url));
    return true;
  }
  if (path === "plans" && method === "POST") {
    const p = {
      ...data.plan,
      terms: data.terms,
      publicId: randomUUID(),
      planId: plans.length + 1,
      planVersionId: plans.length + 1,
      versionNumber: 1,
      rowVersion: rowVersion(),
    };
    plans.push(p);
    send({ publicId: p.publicId });
    return true;
  }
  if (/^plans\//.test(path)) {
    const p = plans.find((p) => p.publicId === path.split("/")[1]);
    if (!p) send({}, 404);
    else if (data.rowVersion !== p.rowVersion) send({}, 409);
    else if (path.endsWith("/versions")) {
      p.terms = data.terms;
      p.versionNumber++;
      p.planVersionId += 100;
      p.rowVersion = rowVersion();
      send({ planVersionId: p.planVersionId });
    } else {
      Object.assign(p, data, { rowVersion: rowVersion() });
      send(null, 204);
    }
    return true;
  }
  if (path === "memberships") {
    let rows = people.slice(0, 7).map((p, i) => ({
      publicId: p.publicId,
      membershipId: i + 1,
      memberId: i + 1,
      memberPublicId: p.publicId,
      memberCode: p.memberCode,
      fullName: p.fullName,
      planId: 1,
      planVersionId: 1,
      planName: "Plan Flow",
      startDate: "2026-10-01",
      endDate: i < 3 ? "2026-10-23" : "2026-11-02",
      status: i < 5 ? "ACTIVE" : i === 5 ? "FROZEN" : "CANCELLED",
      contractedPrice: 120,
      currencyCode: "PEN",
    }));
    rows = rows.filter(
      (p) =>
        (!url.searchParams.get("status") ||
          p.status === url.searchParams.get("status")) &&
        (!url.searchParams.get("memberId") ||
          p.memberId === Number(url.searchParams.get("memberId"))) &&
        p.fullName
          .toLowerCase()
          .includes((url.searchParams.get("search") ?? "").toLowerCase()) &&
        (!url.searchParams.get("expiresTo") ||
          p.endDate <= url.searchParams.get("expiresTo")) &&
        (!url.searchParams.get("expiresFrom") ||
          p.endDate >= url.searchParams.get("expiresFrom")),
    );
    send(page(rows, url));
    return true;
  }
  if (/^classes\/sessions\/\d+\/participants$/.test(path)) {
    send(
      page(
        people.slice(0, 3).map((p, i) => ({
          reservationId: i + 1,
          memberId: i + 1,
          memberCode: p.memberCode,
          fullName: p.fullName,
          status: i === 2 ? "WAITLISTED" : "CONFIRMED",
          waitlistPosition: i === 2 ? 1 : null,
          reservedAtUtc: "2026-10-20T15:00:00Z",
        })),
        url,
      ),
    );
    return true;
  }
  return false;
}
