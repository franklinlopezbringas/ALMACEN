/* GymFlow v1.0 - Global permission catalog */
USE [GymFlowDb];
GO
SET NOCOUNT ON;
GO

MERGE security.Permissions AS target
USING (VALUES
('DASHBOARD.VIEW','Ver dashboard','Dashboard'),
('MEMBERS.VIEW','Ver socios','Members'),
('MEMBERS.CREATE','Crear socios','Members'),
('MEMBERS.UPDATE','Editar socios','Members'),
('PROSPECTS.VIEW','Ver prospectos','CRM'),
('PROSPECTS.MANAGE','Gestionar prospectos','CRM'),
('MEMBERSHIPS.VIEW','Ver membresías','Membership'),
('MEMBERSHIPS.MANAGE','Gestionar membresías','Membership'),
('MEMBERSHIPS.FREEZE_APPROVE','Aprobar congelamientos','Membership'),
('PAYMENTS.VIEW','Ver pagos','Finance'),
('PAYMENTS.CREATE','Registrar pagos','Finance'),
('PAYMENTS.REVERSE_APPROVE','Aprobar anulaciones','Finance'),
('REFUNDS.APPROVE','Aprobar reembolsos','Finance'),
('CASH.OPEN','Abrir caja','Finance'),
('CASH.CLOSE','Cerrar caja','Finance'),
('CASH.VIEW','Ver caja','Finance'),
('ACCESS.CHECKIN','Registrar accesos','Access'),
('ACCESS.EXCEPTION_REQUEST','Solicitar excepción de acceso','Access'),
('ACCESS.EXCEPTION_APPROVE','Aprobar excepción de acceso','Access'),
('TRAINING.MEMBERS_VIEW','Ver socios asignados','Training'),
('TRAINING.ROUTINES_MANAGE','Gestionar rutinas','Training'),
('TRAINING.PROGRESS_MANAGE','Gestionar progreso','Training'),
('CLASSES.VIEW','Ver clases','Classes'),
('CLASSES.MANAGE','Gestionar clases','Classes'),
('CLASSES.RESERVE','Reservar clases propias','Classes'),
('CLASSES.RESERVE_FOR_OTHERS','Reservar clases para terceros','Classes'),
('STORE.VIEW','Ver tienda','Commerce'),
('STORE.SELL','Realizar ventas','Commerce'),
('INVENTORY.MANAGE','Gestionar inventario','Commerce'),
('LOYALTY.VIEW','Ver fidelización','Loyalty'),
('LOYALTY.MANAGE','Gestionar fidelización','Loyalty'),
('MESSAGES.USE','Usar mensajería','Communication'),
('REPORTS.VIEW','Ver reportes','Reports'),
('REPORTS.EXPORT','Exportar reportes','Reports'),
('AUTOMATION.VIEW','Ver automatizaciones','Automation'),
('AUTOMATION.MANAGE','Gestionar automatizaciones','Automation'),
('AI.USE','Usar asistente IA','AI'),
('DOCUMENT_AI.USE','Usar Document AI','AI'),
('USERS.MANAGE','Gestionar usuarios y roles','Security'),
('AUDIT.VIEW','Ver auditoría','Security'),
('SETTINGS.MANAGE','Gestionar configuración','Security')
) AS src(Code,Name,Category)
ON target.Code=src.Code
WHEN MATCHED THEN UPDATE SET Name=src.Name, Category=src.Category, Status='ACTIVE'
WHEN NOT MATCHED THEN INSERT(Code,Name,Category,Status) VALUES(src.Code,src.Name,src.Category,'ACTIVE');
GO
