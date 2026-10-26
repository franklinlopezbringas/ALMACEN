// Explicit same-origin API surface; never an arbitrary proxy or client-controlled host.
const read = [
  /^shift-handoffs(?:\/employees)?$/,
  /^access\/exceptions$/,
  /^incidents$/,
  /^conversations(?:\/\d+\/messages)?$/,
  /^store\/returns(?:\/lines|\/\d+\/sources)?$/,

  /^reception\/context$/,
  /^(?:cash-registers|payment-methods|receivables)$/,
  /^payments(?:\/[\da-f-]{36})?$/,
  /^cash-shifts\/me$/,
  /^cash-shifts\/\d+\/movements$/,
  /^access\/events$/,
  /^dashboard\/summary$/,
  /^members(?:\/[\da-f-]{36})?$/,
  /^memberships(?:\/expiring)?$/,
  /^prospects$/,
  /^classes\/sessions$/,
  /^classes\/sessions\/\d+\/participants$/,
  /^branches$/,
  /^plans$/,
  /^products\/manage$/,
  /^products$/,
  /^trainer\/members$/,
  /^notifications\/me$/,
  /^loyalty\/(?:rewards|me\/balance|me\/transactions)$/,
  /^public\/[\da-f-]{36}\/plans$/,
];
const write = [
  /^shift-handoffs(?:\/\d+\/(?:acknowledge|cancel))?$/,
  /^access\/exceptions(?:\/\d+\/review)?$/,
  /^incidents$/,
  /^conversations\/\d+\/messages$/,
  /^classes\/reservations\/\d+\/status$/,
  /^store\/returns(?:\/\d+\/(?:review|process))?$/,

  /^memberships$/,
  /^payments$/,
  /^store\/sales$/,
  /^cash-shifts\/open$/,
  /^cash-shifts\/\d+\/close$/,
  /^access\/check-in(?:\/qr)?$/,
  /^classes\/sessions\/\d+\/reserve\/\d+$/,
  /^products$/,
  /^plans(?:\/[\da-f-]{36}\/versions)?$/,
  /^members$/,
  /^prospects$/,
  /^prospects\/\d+\/convert$/,
  /^notifications\/\d+\/read$/,
  /^classes\/sessions\/\d+\/reserve\/me$/,
];
export const permittedPath = (method: string, path: string) =>
  (method === "GET"
    ? read
    : method === "POST"
      ? write
      : method === "PUT"
        ? [/^(?:products|plans|members)\/[\da-f-]{36}$/]
        : []
  ).some((rule) => rule.test(path.toLowerCase()));
