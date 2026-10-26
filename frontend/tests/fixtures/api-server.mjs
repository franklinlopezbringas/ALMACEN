// Isolated E2E contract double. Never connects to SQL or supplies production/demo accounts.
import http from "node:http";
import { adminApi } from "./admin-api.mjs";
import { receptionApi, resetReception } from "./reception-api.mjs";
import { randomUUID } from "node:crypto";
const organization = "52020FCB-15C9-F111-9E06-7CC2C653952A";
const permissions = [
  "MESSAGES.USE",
  "ACCESS.EXCEPTION_REQUEST",
  "ACCESS.EXCEPTION_APPROVE",
  "REFUNDS.APPROVE",
  "DASHBOARD.VIEW",
  "REPORTS.VIEW",
  "MEMBERS.UPDATE",
  "PAYMENTS.VIEW",
  "PAYMENTS.CREATE",
  "CASH.VIEW",
  "CASH.OPEN",
  "CASH.CLOSE",
  "ACCESS.CHECKIN",
  "CLASSES.RESERVE_FOR_OTHERS",
  "STORE.SELL",
  "MEMBERS.VIEW",
  "MEMBERS.CREATE",
  "PROSPECTS.VIEW",
  "PROSPECTS.MANAGE",
  "MEMBERSHIPS.VIEW",
  "MEMBERSHIPS.MANAGE",
  "INVENTORY.MANAGE",
  "SETTINGS.MANAGE",
  "CLASSES.MANAGE",
  "CLASSES.VIEW",
  "CLASSES.RESERVE",
  "STORE.VIEW",
  "TRAINING.MEMBERS_VIEW",
  "LOYALTY.VIEW",
];
const sessions = new Map();
const prospects = [
  {
    prospectId: 1,
    fullName: "Natalia Montes",
    phone: "+51 9•• ••• 631",
    email: "natalia.montes@example.test",
    status: "NEW",
    leadSource: "Web del gimnasio",
    interestedPlan: "Plan Flow",
    lastContactAtUtc: "2026-10-20T14:00:00Z",
    nextFollowUpAtUtc: "2026-10-21T16:00:00Z",
  },
  {
    prospectId: 2,
    fullName: "Gabriel Rivas",
    phone: "+51 9•• ••• 748",
    email: "gabriel.rivas@example.test",
    status: "CONTACTED",
    leadSource: "Referido",
    interestedPlan: "Plan Flow",
    lastContactAtUtc: "2026-10-20T14:00:00Z",
    nextFollowUpAtUtc: "2026-10-22T21:30:00Z",
  },
  {
    prospectId: 3,
    fullName: "Renata Solís",
    phone: "+51 9•• ••• 825",
    email: "renata.solis@example.test",
    status: "TRIAL_SCHEDULED",
    leadSource: "Visita al gimnasio",
    interestedPlan: "Plan Flow",
    lastContactAtUtc: "2026-10-20T14:00:00Z",
    nextFollowUpAtUtc: "2026-10-23T13:00:00Z",
  },
];
const readNotifications = new Set();
const people = Array.from({ length: 21 }, (_, i) => ({
  publicId: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  memberCode: `GF-${100 + i}`,
  memberId: i + 1,
  rowVersion: Buffer.from("rowvers1").toString("base64"),
  fullName: [
    "Lucía Fernández",
    "Diego Salazar",
    "Valentina Torres",
    "Mateo García",
    "Camila Rojas",
    "Joaquín Herrera",
    "Isabela Fuentes",
    "Adrián Paredes",
    "Elena Vargas",
    "Bruno Castillo",
    "Mariana León",
    "Tomás Cárdenas",
    "Daniela Acosta",
    "Emilio Navarro",
    "Paula Medina",
    "Nicolás Serrano",
    "Alessandra Vidal",
    "Sebastián Duarte",
    "Florencia Campos",
    "Andrés Molina",
    "Clara Benavides",
  ][i],
  documentNumber: null,
  // Masked, non-dialable synthetic contacts; never sourced from real people.
  phone: `+51 9•• ••• ${241 + i * 7}`,
  status: "ACTIVE",
  membershipStatus: i < 3 || i % 3 ? "ACTIVE" : null,
  membershipEndDate: i < 3 ? "2026-10-23" : i % 3 ? "2026-11-15" : null,
}));
const roleFor = (email) =>
  email.startsWith("expired") || email.startsWith("readonly")
    ? "ADMIN"
    : email.split("@")[0].toUpperCase();
const encode = (data) =>
  Buffer.from(JSON.stringify(data)).toString("base64url");
function auth(email, role, expired = false) {
  const now = Math.floor(Date.now() / 1000);
  const refreshToken = randomUUID();
  sessions.set(refreshToken, { email, role });
  return {
    accessToken:
      encode({ alg: "HS256", typ: "JWT" }) +
      "." +
      encode({
        email,
        org_public: organization,
        exp: now + (expired ? -1 : 900),
        perm: email.startsWith("readonly")
          ? ["DASHBOARD.VIEW", "MEMBERS.VIEW"]
          : role === "MEMBER"
            ? ["CLASSES.VIEW", "CLASSES.RESERVE", "STORE.VIEW", "LOYALTY.VIEW"]
            : role === "TRAINER"
              ? ["TRAINING.MEMBERS_VIEW", "CLASSES.VIEW"]
              : role === "RECEPTION"
                ? permissions.filter(
                    (p) =>
                      ![
                        "REPORTS.VIEW",
                        "ACCESS.EXCEPTION_APPROVE",
                        "REFUNDS.APPROVE",
                        "INVENTORY.MANAGE",
                        "SETTINGS.MANAGE",
                        "CLASSES.MANAGE",
                        "TRAINING.MEMBERS_VIEW",
                        "LOYALTY.VIEW",
                      ].includes(p),
                  )
                : permissions,
        "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": role,
      }) +
      ".isolated-test-signature",
    accessTokenExpiresAtUtc: new Date((now + 900) * 1000).toISOString(),
    refreshToken,
    refreshTokenExpiresAtUtc: new Date(Date.now() + 86400000).toISOString(),
    user: {
      email,
      roles: [role],
      permissions,
      organizationPublicId: organization,
    },
  };
}
const page = (items, url) => {
  const p = Number(url.searchParams.get("page") ?? 1);
  const size = Number(url.searchParams.get("pageSize") ?? 10);
  return {
    items: items.slice((p - 1) * size, p * size),
    page: p,
    pageSize: size,
    total: items.length,
    totalPages: Math.ceil(items.length / size),
  };
};
const server = http.createServer(async (req, res) => {
  let body = "";
  for await (const part of req) body += part;
  let data;
  try {
    data = body ? JSON.parse(body) : {};
  } catch {
    res.writeHead(400).end();
    return;
  }
  const url = new URL(req.url, "http://127.0.0.1:5099");
  const send = (value, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(status === 204 ? "" : JSON.stringify(value));
  };
  const path = url.pathname.replace("/api/v1/", "");
  if (path === "health") return send({ ready: true });
  if (
    path === "fixtures/reception/reset" &&
    req.headers["x-fixture-key"] === process.env.E2E_STUB_PASSWORD
  ) {
    resetReception(data.presentation === true);
    return send({ ok: true });
  }
  if (path === "auth/login") {
    if (data.password !== process.env.E2E_STUB_PASSWORD) return send({}, 401);
    return send(
      auth(data.email, roleFor(data.email), data.email.startsWith("expired")),
    );
  }
  if (path === "auth/refresh") {
    const previous = sessions.get(data.refreshToken);
    if (!previous) return send({}, 401);
    sessions.delete(data.refreshToken);
    return send(
      auth(
        previous.email,
        previous.role === "EXPIRED" ? "ADMIN" : previous.role,
      ),
    );
  }
  if (path.startsWith("public/"))
    return send([
      {
        publicId: randomUUID(),
        code: "FLOW",
        name: "Plan Flow",
        description: "Tu entrenamiento, con la flexibilidad que necesitas.",
        price: 120,
        currencyCode: "PEN",
        durationValue: 1,
        durationUnit: "MONTH",
        freezeDaysLimit: 5,
      },
      {
        publicId: randomUUID(),
        code: "PLUS",
        name: "Plan Plus",
        description: "Un siguiente paso para mantener tu constancia.",
        price: 300,
        currencyCode: "PEN",
        durationValue: 3,
        durationUnit: "MONTH",
        freezeDaysLimit: 10,
      },
    ]);
  if (!req.headers.authorization) return send({}, 401);
  let claims;
  try {
    claims = JSON.parse(
      Buffer.from(
        req.headers.authorization.split(".")[1],
        "base64url",
      ).toString(),
    );
  } catch {
    return send({}, 401);
  }
  if (claims.exp < Date.now() / 1000) return send({}, 401);
  const role =
    claims["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
  if (path.startsWith("members") && role === "MEMBER") return send({}, 403);
  const guarded = [
    [/^dashboard\/summary$/, "REPORTS.VIEW"],
    [
      /^(?:reception\/context|cash-registers|cash-shifts\/me|cash-shifts\/\d+\/movements)$/,
      "CASH.VIEW",
    ],
    [/^cash-shifts\/open$/, "CASH.OPEN"],
    [/^cash-shifts\/\d+\/close$/, "CASH.CLOSE"],
    [/^payment-methods$/, "PAYMENTS.CREATE"],
    [/^receivables$/, "PAYMENTS.VIEW"],
    [
      /^payments(?:\/.*)?$/,
      req.method === "GET" ? "PAYMENTS.VIEW" : "PAYMENTS.CREATE",
    ],
    [/^access\//, "ACCESS.CHECKIN"],
    [/^store\/sales$/, "STORE.SELL"],
    [/^products\/manage$/, "INVENTORY.MANAGE"],
    [/^classes\/sessions\/\d+\/reserve\/\d+$/, "CLASSES.RESERVE_FOR_OTHERS"],
  ];
  if (
    (req.method === "POST" || req.method === "PUT") &&
    /^products(?:\/.*)?$/.test(path)
  )
    guarded.push([/^products/, "INVENTORY.MANAGE"]);
  if (req.method !== "GET" && /^plans(?:\/.*)?$/.test(path))
    guarded.push([/^plans/, "SETTINGS.MANAGE"]);
  if (
    guarded.some(
      ([pattern, permission]) =>
        pattern.test(path) && !claims.perm.includes(permission),
    )
  )
    return send({}, 403);
  if(req.method==="GET" && ["shift-handoffs","shift-handoffs/employees","access/exceptions","incidents","conversations","store/returns","store/returns/lines"].includes(path)) return send(page([],url));
  if (receptionApi(path, req.method, data, url, send, page, people, claims))
    return;
  if (adminApi(path, req.method, data, url, send, page, people)) return;
  if (path === "dashboard/summary")
    return send({
      activeMembers: 128,
      expiringMembershipsNext7Days: 3,
      outstandingReceivables: 1470,
      entriesToday: 38,
    });
  if (path === "memberships/expiring")
    return send(
      people
        .slice(0, Number(url.searchParams.get("days")) > 7 ? 5 : 3)
        .map((p, i) => ({
          membershipPublicId: p.publicId,
          memberId: i + 1,
          memberCode: p.memberCode,
          fullName: p.fullName,
          endDate: i < 3 ? "2026-10-23" : "2026-11-02",
          daysRemaining: i < 3 ? 3 : 13,
          planName: "Plan Flow",
        })),
    );
  if (path === "members" && req.method === "POST") {
    const member = {
      ...people[0],
      publicId: randomUUID(),
      memberCode: "GF-NEW",
      memberId: people.length + 1,
      fullName: data.firstName + " " + data.lastName,
      documentType: data.documentType,
      documentNumber: data.documentNumber,
      phone: data.phone,
      email: data.email,
      membershipStatus: null,
      membershipEndDate: null,
    };
    people.push(member);
    return send({ ...member, ...data }, 201);
  }
  if (path === "members") {
    const search = url.searchParams.get("search") ?? "";
    if (search === "SERVER_ERROR") return send({}, 503);
    return send(
      page(
        people.filter((p) =>
          p.fullName.toLowerCase().includes(search.toLowerCase()),
        ),
        url,
      ),
    );
  }
  if (path.startsWith("members/")) {
    const p = people.find((p) => p.publicId === path.split("/")[1]);
    return p
      ? send({
          ...p,
          firstName: p.fullName.split(" ")[0],
          lastName: p.fullName.split(" ").slice(1).join(" "),
          email:
            p.email ??
            p.fullName
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase()
              .replaceAll(" ", ".") + "@example.test",
          documentType: p.documentType ?? null,
          homeBranchId: null,
        })
      : send({}, 404);
  }
  if (path === "classes/sessions")
    return send(
      page(
        [
          {
            classSessionId: 1,
            className: "Functional Power",
            startsAtUtc: "2026-10-22T13:00:00Z",
            endsAtUtc: "2026-10-22T14:00:00Z",
            capacity: 20,
            reserved: 18,
            coachName: "Camila Rojas",
            availablePlaces: 2,
            status: "SCHEDULED",
          },
          {
            classSessionId: 2,
            className: "Yoga & Balance",
            startsAtUtc: "2026-10-22T23:00:00Z",
            endsAtUtc: "2026-10-23T00:00:00Z",
            capacity: 15,
            reserved: 9,
            coachName: "Mateo García",
            availablePlaces: 6,
            status: "SCHEDULED",
          },
        ],
        url,
      ),
    );
  if (path.includes("/reserve/me")) return send(null, 204);
  if (path === "products")
    return send(
      page(
        [
          {
            publicId: randomUUID(),
            sku: "GF-01",
            name: "Botella deportiva",
            price: 35,
            currencyCode: "PEN",
            stock: null,
            status: "ACTIVE",
          },
          {
            publicId: "a617c777-c6a1-4da2-9b2d-c9d9639489ab",
            sku: "GF-02",
            name: "Toalla de entrenamiento",
            price: 28,
            currencyCode: "PEN",
            stock: null,
            status: "ACTIVE",
          },
        ].filter((p) =>
          `${p.name} ${p.sku}`
            .toLowerCase()
            .includes((url.searchParams.get("search") ?? "").toLowerCase()),
        ),
        url,
      ),
    );
  if (path === "notifications/me")
    return send(
      page(
        [
          {
            id: 1,
            type: "INFO",
            title: "Una nueva semana para avanzar",
            body: "Revisa tus próximas clases y elige tu siguiente desafío.",
            status: readNotifications.has(claims.email) ? "READ" : "UNREAD",
            createdAtUtc: "2026-10-19T15:00:00Z",
            readAtUtc: readNotifications.has(claims.email)
              ? "2026-10-20T15:00:00Z"
              : null,
          },
        ],
        url,
      ),
    );
  if (path.endsWith("/read")) {
    readNotifications.add(claims.email);
    return send(null, 204);
  }
  if (path === "trainer/members")
    return send(
      page(
        people.slice(0, 3).map((p, i) => ({ ...p, memberId: i + 1 })),
        url,
      ),
    );
  if (path === "prospects") {
    if (req.method === "POST") {
      const prospect = {
        prospectId: prospects.length + 1,
        fullName: `${data.firstName} ${data.lastName}`,
        phone: data.phone ?? null,
        email: data.email ?? null,
        status: "NEW",
        leadSource: data.leadSource ?? null,
        interestedPlan: "Plan Flow",
        lastContactAtUtc: "2026-10-20T14:00:00Z",
        nextFollowUpAtUtc: null,
      };
      prospects.push(prospect);
      return send({ prospectId: prospect.prospectId }, 201);
    }
    const search = (url.searchParams.get("search") ?? "").toLowerCase();
    return send(
      page(
        prospects.filter(
          (p) =>
            `${p.fullName} ${p.phone ?? ""} ${p.email ?? ""}`
              .toLowerCase()
              .includes(search) &&
            (!url.searchParams.get("status") ||
              p.status === url.searchParams.get("status")),
        ),
        url,
      ),
    );
  }
  if (/^prospects\/\d+\/convert$/.test(path)) {
    const prospect = prospects.find(
      (p) => p.prospectId === Number(path.split("/")[1]),
    );
    if (!prospect) return send({}, 404);
    if (prospect.status === "WON") return send({}, 409);
    prospect.status = "WON";
    people.push({
      ...people[0],
      publicId: randomUUID(),
      fullName: prospect.fullName,
      memberCode: `GF-P${prospect.prospectId}`,
    });
    return send({}, 201);
  }
  if (path === "loyalty/me/balance")
    return send({
      memberId: 1,
      currentBalance: 240,
      lifetimeEarned: 300,
      lifetimeRedeemed: 60,
    });
  if (path === "loyalty/rewards")
    return send(
      page(
        [
          {
            publicId: randomUUID(),
            type: "BENEFIT",
            name: "Invita a alguien a entrenar",
            description: "Comparte la experiencia.",
            pointsCost: 100,
            status: "ACTIVE",
          },
        ],
        url,
      ),
    );
  return send({}, 404);
});
server.listen(5099, "127.0.0.1");
