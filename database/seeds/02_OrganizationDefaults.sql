/* GymFlow v1.0 - Organization default seeding procedure */
USE [GymFlowDb];
GO
SET NOCOUNT ON;
GO

CREATE OR ALTER PROCEDURE security.usp_SeedOrganizationDefaults
    @OrganizationId BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM core.Organizations WHERE OrganizationId=@OrganizationId)
        THROW 51100, 'Organization does not exist.', 1;

    BEGIN TRANSACTION;

    MERGE security.Roles AS target
    USING (VALUES
      (@OrganizationId,N'ADMIN',N'Administrador',N'Acceso administrativo del gimnasio',1),
      (@OrganizationId,N'RECEPTION',N'Recepción',N'Operación de recepción, cobros y accesos',1),
      (@OrganizationId,N'TRAINER',N'Entrenador',N'Entrenamiento y seguimiento de socios asignados',1),
      (@OrganizationId,N'MEMBER',N'Socio',N'Portal del socio',1)
    ) AS src(OrganizationId,Code,Name,Description,IsSystemRole)
    ON target.OrganizationId=src.OrganizationId AND target.Code=src.Code
    WHEN MATCHED THEN UPDATE SET Name=src.Name,Description=src.Description,IsSystemRole=src.IsSystemRole,Status='ACTIVE'
    WHEN NOT MATCHED THEN INSERT(OrganizationId,Code,Name,Description,IsSystemRole,Status)
      VALUES(src.OrganizationId,src.Code,src.Name,src.Description,src.IsSystemRole,'ACTIVE');

    MERGE finance.PaymentMethods AS target
    USING (VALUES
      (@OrganizationId,N'CASH',N'Efectivo',1,0),
      (@OrganizationId,N'CARD',N'Tarjeta',0,0),
      (@OrganizationId,N'YAPE',N'Yape',0,0),
      (@OrganizationId,N'PLIN',N'Plin',0,0),
      (@OrganizationId,N'TRANSFER',N'Transferencia bancaria',0,0),
      (@OrganizationId,N'ONLINE',N'Pasarela online',0,1)
    ) AS src(OrganizationId,Code,Name,IsCash,IsOnline)
    ON target.OrganizationId=src.OrganizationId AND target.Code=src.Code
    WHEN MATCHED THEN UPDATE SET Name=src.Name,IsCash=src.IsCash,IsOnline=src.IsOnline,Status='ACTIVE'
    WHEN NOT MATCHED THEN INSERT(OrganizationId,Code,Name,IsCash,IsOnline,Status)
      VALUES(src.OrganizationId,src.Code,src.Name,src.IsCash,src.IsOnline,'ACTIVE');

    MERGE crm.LeadSources AS target
    USING (VALUES
      (@OrganizationId,N'WEB',N'Web'),(@OrganizationId,N'INSTAGRAM',N'Instagram'),
      (@OrganizationId,N'FACEBOOK',N'Facebook'),(@OrganizationId,N'GOOGLE',N'Google'),
      (@OrganizationId,N'REFERRAL',N'Referido'),(@OrganizationId,N'WALK_IN',N'Visita al local'),
      (@OrganizationId,N'WHATSAPP',N'WhatsApp'),(@OrganizationId,N'OTHER',N'Otro')
    ) AS src(OrganizationId,Code,Name)
    ON target.OrganizationId=src.OrganizationId AND target.Code=src.Code
    WHEN MATCHED THEN UPDATE SET Name=src.Name,Status='ACTIVE'
    WHEN NOT MATCHED THEN INSERT(OrganizationId,Code,Name,Status) VALUES(src.OrganizationId,src.Code,src.Name,'ACTIVE');

    MERGE training.MuscleGroups AS target
    USING (VALUES
      (@OrganizationId,N'CHEST',N'Pecho'),(@OrganizationId,N'BACK',N'Espalda'),
      (@OrganizationId,N'LEGS',N'Piernas'),(@OrganizationId,N'SHOULDERS',N'Hombros'),
      (@OrganizationId,N'ARMS',N'Brazos'),(@OrganizationId,N'CORE',N'Core'),
      (@OrganizationId,N'FULL_BODY',N'Cuerpo completo')
    ) AS src(OrganizationId,Code,Name)
    ON target.OrganizationId=src.OrganizationId AND target.Code=src.Code
    WHEN MATCHED THEN UPDATE SET Name=src.Name
    WHEN NOT MATCHED THEN INSERT(OrganizationId,Code,Name) VALUES(src.OrganizationId,src.Code,src.Name);

    MERGE training.TrainerSpecialties AS target
    USING (VALUES
      (@OrganizationId,N'STRENGTH',N'Fuerza'),(@OrganizationId,N'HYPERTROPHY',N'Hipertrofia'),
      (@OrganizationId,N'FUNCTIONAL',N'Entrenamiento funcional'),(@OrganizationId,N'WEIGHT_LOSS',N'Pérdida de peso'),
      (@OrganizationId,N'MOBILITY',N'Movilidad')
    ) AS src(OrganizationId,Code,Name)
    ON target.OrganizationId=src.OrganizationId AND target.Code=src.Code
    WHEN MATCHED THEN UPDATE SET Name=src.Name,Status='ACTIVE'
    WHEN NOT MATCHED THEN INSERT(OrganizationId,Code,Name,Status) VALUES(src.OrganizationId,src.Code,src.Name,'ACTIVE');

    /* Role-permission matrix. */
    DECLARE @Admin BIGINT=(SELECT RoleId FROM security.Roles WHERE OrganizationId=@OrganizationId AND Code='ADMIN');
    DECLARE @Reception BIGINT=(SELECT RoleId FROM security.Roles WHERE OrganizationId=@OrganizationId AND Code='RECEPTION');
    DECLARE @Trainer BIGINT=(SELECT RoleId FROM security.Roles WHERE OrganizationId=@OrganizationId AND Code='TRAINER');
    DECLARE @Member BIGINT=(SELECT RoleId FROM security.Roles WHERE OrganizationId=@OrganizationId AND Code='MEMBER');

    INSERT INTO security.RolePermissions(RoleId,PermissionId)
    SELECT @Admin,p.PermissionId FROM security.Permissions p
    WHERE p.Status='ACTIVE' AND NOT EXISTS(SELECT 1 FROM security.RolePermissions rp WHERE rp.RoleId=@Admin AND rp.PermissionId=p.PermissionId);

    INSERT INTO security.RolePermissions(RoleId,PermissionId)
    SELECT @Reception,p.PermissionId FROM security.Permissions p
    WHERE p.Code IN ('DASHBOARD.VIEW','MEMBERS.VIEW','MEMBERS.CREATE','MEMBERS.UPDATE','PROSPECTS.VIEW','PROSPECTS.MANAGE',
                     'MEMBERSHIPS.VIEW','MEMBERSHIPS.MANAGE','PAYMENTS.VIEW','PAYMENTS.CREATE','CASH.OPEN','CASH.CLOSE','CASH.VIEW',
                     'ACCESS.CHECKIN','ACCESS.EXCEPTION_REQUEST','CLASSES.VIEW','CLASSES.RESERVE_FOR_OTHERS','STORE.VIEW','STORE.SELL','MESSAGES.USE')
      AND NOT EXISTS(SELECT 1 FROM security.RolePermissions rp WHERE rp.RoleId=@Reception AND rp.PermissionId=p.PermissionId);

    INSERT INTO security.RolePermissions(RoleId,PermissionId)
    SELECT @Trainer,p.PermissionId FROM security.Permissions p
    WHERE p.Code IN ('DASHBOARD.VIEW','TRAINING.MEMBERS_VIEW','TRAINING.ROUTINES_MANAGE','TRAINING.PROGRESS_MANAGE','CLASSES.VIEW','MESSAGES.USE','AI.USE')
      AND NOT EXISTS(SELECT 1 FROM security.RolePermissions rp WHERE rp.RoleId=@Trainer AND rp.PermissionId=p.PermissionId);

    INSERT INTO security.RolePermissions(RoleId,PermissionId)
    SELECT @Member,p.PermissionId FROM security.Permissions p
    WHERE p.Code IN ('DASHBOARD.VIEW','MEMBERSHIPS.VIEW','CLASSES.VIEW','CLASSES.RESERVE','STORE.VIEW','LOYALTY.VIEW','MESSAGES.USE','AI.USE')
      AND NOT EXISTS(SELECT 1 FROM security.RolePermissions rp WHERE rp.RoleId=@Member AND rp.PermissionId=p.PermissionId);

    COMMIT TRANSACTION;
END;
GO
