# GymFlow database manifest

GymFlow v1 separates physical persistence by business domain. The 100 tables are **not** 100 UI modules; most are historical records, relationship tables, ledgers, security infrastructure or execution records.

| Script | Domain | Tables | Why it exists |
|---|---|---:|---|
| 01 | Organization + Security | 13 | Tenant, branches, auth, sessions, RBAC, recovery/verification |
| 02 | People + CRM | 8 | Shared person identity, employees/members, acquisition funnel |
| 03 | Membership + Legal | 9 | Plan/version history, contracted memberships, freezes, versioned consent |
| 04 | Finance + Cash + operational handoff | 14 | Orders, attempts, receivables, mixed/partial payments, refunds/reversals, cash shifts and independent core.ShiftHandoffs |
| 05 | Access + Training | 21 | Credentials/check-ins, coach assignment, reusable routines, progress, classes |
| 06 | Commerce | 8 | Products, inventory ledger/balance, suppliers/purchases, returns |
| 07 | Loyalty + Communication | 17 | Promotions, points ledger, challenges/games/rewards/referrals, messages/notifications/support |
| 08 | Automation + AI | 9 | Durable jobs/executions and auditable AI/document-processing records |
| 09 | Audit | 1 | Cross-domain append-oriented audit trail |

## Why this is not intentionally inflated

- No tables named `Administrators` or `Receptionists`; those are roles over users/employees.
- No standalone `Renewals`; renewal is a new membership linked to the previous membership.
- No standalone class waitlist; waitlist is a reservation state + position.
- No mutable-only balances for receivables, points or stock; ledger/history is retained and reconciliation views exist.
- No separate sales database for web vs reception; `finance.Orders` supports channels and item types.
- No fingerprint image storage; access credentials hold external provider/device identifiers.
- No separate file table per feature; `core.Files` is shared metadata for photos/documents/evidence.
- RPA/AI are durable jobs/results rather than blocking HTTP requests.

## Review rule

Before adding any new table, require at least one: independent lifecycle/state, required history/audit, many-to-many relationship, integrity boundary, or independently queried business concept. Otherwise prefer a column/value object or reuse an existing aggregate.

## Reception closure — 2026-10-25

The explicitly authorized `core.ShiftHandoffs` is the only new table. Its independent PENDING / ACKNOWLEDGED / CANCELLED lifecycle does not close or replace `finance.CashShifts`; the cash reference is optional. Composite tenant foreign keys, branch validation, immutable handoff content, audit and rowversion preserve history.

`communication.SupportTickets.MemberId` is optional and references `(OrganizationId, MemberId)`. `finance.Refunds.PaymentSplitId` and `ProductReturnId` reference the original payment split and product return using tenant keys. A trigger checks payment/split/order consistency. `commerce.ProductReturns` gains the composite unique key required by the refund foreign key.

For an existing installation, apply `database/patches/20261024_ShiftHandoffs.sql` and then `database/patches/20261024_ReceptionReferences.sql`. Fresh installations use `98_InstallSchema.sql` followed by `99_InstallDemo.sql`; all changes and concurrency indexes are already in canonical scripts 04, 06 and 07. Do not run the empty-database installer over an installed database.

The new covering indexes are `IX_Payments_Org_Order`, `IX_Refunds_Payment_Status`, `IX_Refunds_Split_Status`, `IX_ProductReturns_OrderItem_Status` and the handoff inbox index. Existing cash indexes remain authoritative. Monetary values retain `decimal(19,4)` and inventory quantities `decimal(18,3)`; no SQL precision change was made.

Validation and limitations: [Reception closure report](RECEPTION_CLOSURE_REPORT.md).
