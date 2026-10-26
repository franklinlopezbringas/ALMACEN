# GymFlow API surface implemented in the demo backend

## Reception + POS Patch — 2026-10-22

54 OpenAPI operations. New Reception contracts expose member context, paged debt,
payment methods/receipts, own cash shifts/movements, access history/QR and atomic POS.
Existing writes retain permissions; global dashboard now also requires REPORTS.VIEW.
No schema or permission-seed changes. See [final report](../docs/RECEPTION_PATCH_REPORT.md)
for the 12 new operations, modified contracts, tests and explicit remaining gaps.

## Admin Integration Patch — 2026-10-21

42 OpenAPI operations, including 10 new administrative operations:

- `GET /api/v1/memberships`
- `GET /api/v1/classes/sessions/{sessionId}/participants`
- `GET /api/v1/branches`
- `GET /api/v1/products/manage`
- `POST /api/v1/products`
- `PUT /api/v1/products/{id}`
- `GET /api/v1/plans`
- `POST /api/v1/plans`
- `PUT /api/v1/plans/{id}`
- `POST /api/v1/plans/{id}/versions`

Prospect and class-session reads include additional operational fields. Membership
creation rejects inactive parent plans while retaining existing contract history.
See [contracts, permissions and validation](../docs/INTEGRATION_PATCH_REPORT.md).
No new permissions, schema changes or expanded role assignments.

The API uses `/api/v1`, JWT authentication and permission policies except for explicitly public routes.

## Public
- `GET /api/v1/public/{organizationPublicId}/plans`

## Authentication
- Login
- Refresh-token rotation
- Brute-force lockout handling

## Dashboard
- Active members
- Memberships expiring in next 7 days
- Outstanding receivables
- Today's allowed entries

## Members / CRM
- Paginated member search
- Member detail
- Create member
- Paginated prospect search
- Create prospect
- Convert prospect to member without deleting CRM history

## Membership
- Create membership from plan version and snapshot contracted price
- Generate receivable
- List expiring memberships

## Finance / Cash
- Register partial or mixed payments
- Allocate payments to receivables
- Cash payment splits create cash movements; electronic splits do not
- Open cash shift
- Close/reconcile cash shift with review status on difference

## Access
- Check-in with active membership or approved access exception
- Denied attempts can be recorded without counting as successful attendance

## Trainer
- Only assigned active members for the current trainer
- Historical progress review creation with visible/private notes separated

## Classes
- Paginated upcoming sessions
- Self-reservation from current user/member mapping
- Reservation for another member with explicit permission
- Serializable capacity check and waitlist fallback

## Store
- Paginated product catalog with optional branch stock projection

## Loyalty
- Current member balance and ledger
- Reward catalog
- Reward redemption with serializable balance/stock-limit check
- Administrative member balance endpoint

## Notifications
- Current-user paginated notifications
- Mark own notification read

## Automation
- Enqueue durable background job
- Read job status

## Deliberate v1 boundaries
External payment gateways, real email/WhatsApp providers, actual RPA workers, model-provider AI calls and object-storage providers are integration adapters and are not hard-coded into the API. Their persistence contracts/jobs are present so those integrations can be added without redesigning the core.
