# Inventario de API real

Referencia: `http://127.0.0.1:5080/openapi/v1.json`.
Actualizado: 2026-10-22. **54 operaciones**: 42 previas y 12 del patch Recepción.
Contratos y permisos: [Reception Patch](../../docs/RECEPTION_PATCH_REPORT.md).

| Método | Ruta | Dominio |
|---|---|---|
| GET | `/health/ready` | GymFlow.Api |
| GET | `/api/v1/dashboard/summary` | Dashboard |
| GET | `/api/v1/products` | Products |
| POST | `/api/v1/products` | Administration |
| POST | `/api/v1/auth/login` | Auth |
| POST | `/api/v1/auth/refresh` | Auth |
| GET | `/api/v1/members` | Members |
| POST | `/api/v1/members` | Members |
| GET | `/api/v1/members/{publicId}` | Members |
| GET | `/api/v1/memberships` | Memberships |
| POST | `/api/v1/memberships` | Memberships |
| GET | `/api/v1/memberships/expiring` | Memberships |
| POST | `/api/v1/payments` | Payments |
| GET | `/api/v1/payments` | Reception |
| POST | `/api/v1/access/check-in` | Access |
| GET | `/api/v1/classes/sessions` | Classes |
| GET | `/api/v1/classes/sessions/{sessionId}/participants` | Classes |
| POST | `/api/v1/classes/sessions/{sessionId}/reserve/me` | Classes |
| POST | `/api/v1/classes/sessions/{sessionId}/reserve/{memberId}` | Classes |
| POST | `/api/v1/cash-shifts/open` | Cash |
| POST | `/api/v1/cash-shifts/{cashShiftId}/close` | Cash |
| GET | `/api/v1/prospects` | CRM |
| POST | `/api/v1/prospects` | CRM |
| POST | `/api/v1/prospects/{prospectId}/convert` | CRM |
| GET | `/api/v1/trainer/members` | Trainer |
| POST | `/api/v1/trainer/progress-reviews` | Trainer |
| GET | `/api/v1/loyalty/rewards` | Loyalty |
| GET | `/api/v1/loyalty/me/balance` | Loyalty |
| GET | `/api/v1/loyalty/me/transactions` | Loyalty |
| POST | `/api/v1/loyalty/me/rewards/{rewardId}/redeem` | Loyalty |
| GET | `/api/v1/loyalty/members/{memberId}/balance` | Loyalty |
| GET | `/api/v1/notifications/me` | Notifications |
| POST | `/api/v1/notifications/{notificationId}/read` | Notifications |
| POST | `/api/v1/automation/jobs` | Automation |
| GET | `/api/v1/automation/jobs/{publicId}` | Automation |
| GET | `/api/v1/public/{organizationPublicId}/plans` | Public |
| GET | `/api/v1/branches` | Administration |
| GET | `/api/v1/products/manage` | Administration |
| PUT | `/api/v1/products/{id}` | Administration |
| GET | `/api/v1/plans` | Administration |
| POST | `/api/v1/plans` | Administration |
| PUT | `/api/v1/plans/{id}` | Administration |
| POST | `/api/v1/plans/{id}/versions` | Administration |
| POST | `/api/v1/access/check-in/qr` | Reception |
| GET | `/api/v1/reception/context` | Reception |
| GET | `/api/v1/cash-registers` | Reception |
| GET | `/api/v1/payment-methods` | Reception |
| GET | `/api/v1/receivables` | Reception |
| GET | `/api/v1/payments/{id}` | Reception |
| GET | `/api/v1/cash-shifts/me` | Reception |
| GET | `/api/v1/cash-shifts/{id}/movements` | Reception |
| GET | `/api/v1/access/events` | Reception |
| PUT | `/api/v1/members/{id}` | Reception |
| POST | `/api/v1/store/sales` | Reception |
