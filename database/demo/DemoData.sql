/* GymFlow v1.0 - Professional fictitious demo data. No real client/person data. */
USE [GymFlowDb];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF EXISTS (SELECT 1 FROM core.Organizations WHERE TaxId=N'DEMO-GYMFLOW-001')
BEGIN
    PRINT 'Demo organization already exists. DemoData skipped.';
    RETURN;
END;

BEGIN TRANSACTION;
DECLARE @OrgId BIGINT, @BranchId BIGINT;
INSERT INTO core.Organizations(LegalName,TradeName,TaxId,Phone,Email)
VALUES(N'NovaFit Demo S.A.C.',N'NovaFit Gym',N'DEMO-GYMFLOW-001',N'+51 900 000 100',N'contacto@demo.gymflow.local');
SET @OrgId=SCOPE_IDENTITY();

INSERT INTO core.OrganizationSettings(OrganizationId,SettingsJson)
VALUES(@OrgId,N'{"branding":{"primary":"#111827","secondary":"#22C55E"},"access":{"allowQr":true,"allowBiometric":true},"membership":{"graceDays":0}}');

INSERT INTO core.Branches(OrganizationId,Code,Name,AddressLine1,District,City,StateOrRegion,CountryCode,Phone)
VALUES(@OrgId,N'CHIM-01',N'NovaFit Centro',N'Av. Demo 450',N'Centro',N'Chimbote',N'Áncash','PE',N'+51 900 000 101');
SET @BranchId=SCOPE_IDENTITY();

INSERT INTO core.BranchBusinessHours(OrganizationId,BranchId,DayOfWeek,OpenTime,CloseTime,IsClosed)
SELECT @OrgId,@BranchId,v.DayOfWeek,v.OpenTime,v.CloseTime,v.IsClosed
FROM (VALUES
(1,CAST('06:00' AS TIME),CAST('22:00' AS TIME),0),(2,CAST('06:00' AS TIME),CAST('22:00' AS TIME),0),
(3,CAST('06:00' AS TIME),CAST('22:00' AS TIME),0),(4,CAST('06:00' AS TIME),CAST('22:00' AS TIME),0),
(5,CAST('06:00' AS TIME),CAST('22:00' AS TIME),0),(6,CAST('07:00' AS TIME),CAST('20:00' AS TIME),0),
(7,CAST('08:00' AS TIME),CAST('14:00' AS TIME),0)) v(DayOfWeek,OpenTime,CloseTime,IsClosed);

EXEC security.usp_SeedOrganizationDefaults @OrgId;

/* Fictitious people */
DECLARE @People TABLE(Tag NVARCHAR(30),PersonId BIGINT);
DECLARE @Tag NVARCHAR(30),@First NVARCHAR(100),@Last NVARCHAR(150),@Doc NVARCHAR(40),@Email NVARCHAR(320),@Phone NVARCHAR(30),@Pid BIGINT;
DECLARE c CURSOR LOCAL FAST_FORWARD FOR
SELECT * FROM (VALUES
(N'ADMIN',N'Diego',N'Salazar Vega',N'70000001',N'diego.salazar@demo.gymflow.local',N'900000201'),
(N'RECEP1',N'Ana',N'Torres Luna',N'70000002',N'ana.torres@demo.gymflow.local',N'900000202'),
(N'TRAINER1',N'Carlos',N'Gómez Ríos',N'70000003',N'carlos.gomez@demo.gymflow.local',N'900000203'),
(N'TRAINER2',N'Valeria',N'Cruz Soto',N'70000004',N'valeria.cruz@demo.gymflow.local',N'900000204'),
(N'MEMBER1',N'María',N'López Díaz',N'70000101',N'maria.lopez@demo.gymflow.local',N'900001101'),
(N'MEMBER2',N'Pedro',N'Ramos Flores',N'70000102',N'pedro.ramos@demo.gymflow.local',N'900001102'),
(N'MEMBER3',N'Camila',N'Torres Reyes',N'70000103',N'camila.torres@demo.gymflow.local',N'900001103'),
(N'MEMBER4',N'Juan',N'Ruiz Mendoza',N'70000104',N'juan.ruiz@demo.gymflow.local',N'900001104'),
(N'MEMBER5',N'Sofía',N'Vega Paredes',N'70000105',N'sofia.vega@demo.gymflow.local',N'900001105'),
(N'PROSPECT1',N'Lucía',N'Mendoza Silva',N'70000201',N'lucia.mendoza@demo.gymflow.local',N'900002101')
) d(Tag,FirstName,LastName,DocumentNumber,Email,Phone);
OPEN c; FETCH NEXT FROM c INTO @Tag,@First,@Last,@Doc,@Email,@Phone;
WHILE @@FETCH_STATUS=0
BEGIN
    INSERT INTO core.People(OrganizationId,FirstName,LastName,DocumentType,DocumentNumber,Phone,Email)
    VALUES(@OrgId,@First,@Last,'DNI',@Doc,@Phone,@Email);
    SET @Pid=SCOPE_IDENTITY();
    INSERT INTO @People VALUES(@Tag,@Pid);
    FETCH NEXT FROM c INTO @Tag,@First,@Last,@Doc,@Email,@Phone;
END
CLOSE c; DEALLOCATE c;

/* Accounts intentionally have no SQL-seeded passwords. The backend DevelopmentDemoSeeder creates password hashes safely. */
INSERT INTO security.Users(Email,NormalizedEmail,PasswordHash,EmailVerified,Status)
SELECT LOWER(p.Email),UPPER(p.Email),NULL,1,'ACTIVE'
FROM core.People p WHERE p.OrganizationId=@OrgId AND p.Email IS NOT NULL;

INSERT INTO security.UserOrganizations(OrganizationId,UserId,PersonId,Status)
SELECT @OrgId,u.UserId,p.PersonId,'ACTIVE'
FROM core.People p JOIN security.Users u ON u.NormalizedEmail=UPPER(p.Email)
WHERE p.OrganizationId=@OrgId;

DECLARE @AdminPerson BIGINT=(SELECT PersonId FROM @People WHERE Tag='ADMIN');
DECLARE @RecepPerson BIGINT=(SELECT PersonId FROM @People WHERE Tag='RECEP1');
DECLARE @Trainer1Person BIGINT=(SELECT PersonId FROM @People WHERE Tag='TRAINER1');
DECLARE @Trainer2Person BIGINT=(SELECT PersonId FROM @People WHERE Tag='TRAINER2');

INSERT INTO core.Employees(OrganizationId,PersonId,HomeBranchId,EmployeeCode,JobTitle,HireDate)
VALUES(@OrgId,@AdminPerson,@BranchId,N'EMP-001',N'Administrador','2026-01-02'),
      (@OrgId,@RecepPerson,@BranchId,N'EMP-002',N'Recepción','2026-02-01'),
      (@OrgId,@Trainer1Person,@BranchId,N'EMP-003',N'Entrenador','2026-02-15'),
      (@OrgId,@Trainer2Person,@BranchId,N'EMP-004',N'Entrenadora','2026-03-01');

INSERT INTO core.Members(OrganizationId,PersonId,HomeBranchId,MemberCode,RegistrationDate)
SELECT @OrgId,p.PersonId,@BranchId,CONCAT(N'SOC-',RIGHT(N'000'+CAST(ROW_NUMBER() OVER(ORDER BY p.PersonId) AS NVARCHAR(3)),3)),'2026-07-01'
FROM @People p WHERE p.Tag LIKE 'MEMBER%';

DECLARE @AdminRole BIGINT=(SELECT RoleId FROM security.Roles WHERE OrganizationId=@OrgId AND Code='ADMIN');
DECLARE @ReceptionRole BIGINT=(SELECT RoleId FROM security.Roles WHERE OrganizationId=@OrgId AND Code='RECEPTION');
DECLARE @TrainerRole BIGINT=(SELECT RoleId FROM security.Roles WHERE OrganizationId=@OrgId AND Code='TRAINER');
DECLARE @MemberRole BIGINT=(SELECT RoleId FROM security.Roles WHERE OrganizationId=@OrgId AND Code='MEMBER');

INSERT INTO security.UserRoles(OrganizationId,UserOrganizationId,RoleId)
SELECT @OrgId,uo.UserOrganizationId,
CASE
 WHEN p.PersonId=@AdminPerson THEN @AdminRole
 WHEN p.PersonId=@RecepPerson THEN @ReceptionRole
 WHEN p.PersonId IN (@Trainer1Person,@Trainer2Person) THEN @TrainerRole
 ELSE @MemberRole END
FROM security.UserOrganizations uo
JOIN core.People p ON p.OrganizationId=uo.OrganizationId AND p.PersonId=uo.PersonId
WHERE uo.OrganizationId=@OrgId AND p.PersonId IN (SELECT PersonId FROM @People WHERE Tag<>'PROSPECT1');

DECLARE @LeadWeb BIGINT=(SELECT LeadSourceId FROM crm.LeadSources WHERE OrganizationId=@OrgId AND Code='WEB');
DECLARE @ProspectPerson BIGINT=(SELECT PersonId FROM @People WHERE Tag='PROSPECT1');
INSERT INTO crm.Prospects(OrganizationId,PersonId,LeadSourceId,Status,NextFollowUpAtUtc,Notes)
VALUES(@OrgId,@ProspectPerson,@LeadWeb,'CONTACTED',DATEADD(day,2,SYSUTCDATETIME()),N'Interesada en plan mensual; solicitó información desde la web.');

/* Plans and historical versions */
INSERT INTO membership.Plans(OrganizationId,Code,Name,Description,IsPublic)
VALUES(@OrgId,N'BASIC',N'Básico',N'Acceso a sala de entrenamiento.',1),
      (@OrgId,N'PREMIUM',N'Premium',N'Acceso + clases + seguimiento de coach.',1),
      (@OrgId,N'VIP',N'VIP',N'Beneficios premium y prioridad en reservas.',1);

DECLARE @Basic BIGINT=(SELECT PlanId FROM membership.Plans WHERE OrganizationId=@OrgId AND Code='BASIC');
DECLARE @Premium BIGINT=(SELECT PlanId FROM membership.Plans WHERE OrganizationId=@OrgId AND Code='PREMIUM');
DECLARE @Vip BIGINT=(SELECT PlanId FROM membership.Plans WHERE OrganizationId=@OrgId AND Code='VIP');
INSERT INTO membership.PlanVersions(OrganizationId,PlanId,VersionNumber,Price,CurrencyCode,DurationValue,DurationUnit,FreezeDaysLimit,ValidFrom)
VALUES(@OrgId,@Basic,1,80,'PEN',1,'MONTH',0,'2026-01-01'),
      (@OrgId,@Premium,1,120,'PEN',1,'MONTH',7,'2026-01-01'),
      (@OrgId,@Vip,1,180,'PEN',1,'MONTH',14,'2026-01-01');

DECLARE @PremiumV BIGINT=(SELECT PlanVersionId FROM membership.PlanVersions WHERE OrganizationId=@OrgId AND PlanId=@Premium AND VersionNumber=1);
DECLARE @BasicV BIGINT=(SELECT PlanVersionId FROM membership.PlanVersions WHERE OrganizationId=@OrgId AND PlanId=@Basic AND VersionNumber=1);

DECLARE @AdminUser BIGINT=(SELECT u.UserId FROM security.Users u JOIN core.People p ON p.Email=u.Email WHERE p.OrganizationId=@OrgId AND p.PersonId=@AdminPerson);
DECLARE @RecepUser BIGINT=(SELECT u.UserId FROM security.Users u JOIN core.People p ON p.Email=u.Email WHERE p.OrganizationId=@OrgId AND p.PersonId=@RecepPerson);
DECLARE @Member1 BIGINT=(SELECT m.MemberId FROM core.Members m JOIN @People p ON p.PersonId=m.PersonId WHERE p.Tag='MEMBER1');
DECLARE @Member2 BIGINT=(SELECT m.MemberId FROM core.Members m JOIN @People p ON p.PersonId=m.PersonId WHERE p.Tag='MEMBER2');
DECLARE @Member3 BIGINT=(SELECT m.MemberId FROM core.Members m JOIN @People p ON p.PersonId=m.PersonId WHERE p.Tag='MEMBER3');
DECLARE @Member4 BIGINT=(SELECT m.MemberId FROM core.Members m JOIN @People p ON p.PersonId=m.PersonId WHERE p.Tag='MEMBER4');
DECLARE @Member5 BIGINT=(SELECT m.MemberId FROM core.Members m JOIN @People p ON p.PersonId=m.PersonId WHERE p.Tag='MEMBER5');

INSERT INTO membership.Memberships(OrganizationId,MemberId,PlanVersionId,HomeBranchId,StartDate,EndDate,ContractedPrice,CurrencyCode,Status,Origin,CreatedByUserId)
VALUES(@OrgId,@Member1,@PremiumV,@BranchId,'2026-10-01','2026-10-31',120,'PEN','ACTIVE','RECEPTION',@RecepUser),
      (@OrgId,@Member2,@PremiumV,@BranchId,'2026-10-01','2026-10-31',120,'PEN','ACTIVE','RECEPTION',@RecepUser),
      (@OrgId,@Member3,@BasicV,@BranchId,'2026-09-17','2026-10-17',80,'PEN','ACTIVE','WEB',@AdminUser),
      (@OrgId,@Member4,@PremiumV,@BranchId,'2026-10-05','2026-11-04',120,'PEN','ACTIVE','RECEPTION',@RecepUser),
      (@OrgId,@Member5,@BasicV,@BranchId,'2026-10-10','2026-11-09',80,'PEN','ACTIVE','WEB',@AdminUser);

/* Receivable + mixed payment example */
DECLARE @M1Membership BIGINT=(SELECT TOP 1 MembershipId FROM membership.Memberships WHERE OrganizationId=@OrgId AND MemberId=@Member1 ORDER BY MembershipId DESC);
DECLARE @M2Membership BIGINT=(SELECT TOP 1 MembershipId FROM membership.Memberships WHERE OrganizationId=@OrgId AND MemberId=@Member2 ORDER BY MembershipId DESC);
INSERT INTO finance.Receivables(OrganizationId,MemberId,MembershipId,Description,TotalAmount,CurrencyCode,DueDate,CreatedByUserId)
VALUES(@OrgId,@Member1,@M1Membership,N'Membresía Premium octubre',120,'PEN','2026-10-01',@RecepUser),
      (@OrgId,@Member2,@M2Membership,N'Membresía Premium octubre',120,'PEN','2026-10-01',@RecepUser);
DECLARE @R1 BIGINT=(SELECT ReceivableId FROM finance.Receivables WHERE OrganizationId=@OrgId AND MemberId=@Member1);
DECLARE @R2 BIGINT=(SELECT ReceivableId FROM finance.Receivables WHERE OrganizationId=@OrgId AND MemberId=@Member2);

INSERT INTO finance.CashRegisters(OrganizationId,BranchId,Code,Name) VALUES(@OrgId,@BranchId,N'REC-01',N'Caja Recepción');
DECLARE @Register BIGINT=SCOPE_IDENTITY();
DECLARE @RecepEmployee BIGINT=(SELECT EmployeeId FROM core.Employees WHERE OrganizationId=@OrgId AND PersonId=@RecepPerson);
INSERT INTO finance.CashShifts(OrganizationId,CashRegisterId,EmployeeId,OpenedByUserId,OpeningAmount,Status)
VALUES(@OrgId,@Register,@RecepEmployee,@RecepUser,200,'OPEN');
DECLARE @Shift BIGINT=SCOPE_IDENTITY();

INSERT INTO finance.Payments(OrganizationId,ReceiptNumber,MemberId,BranchId,TotalAmount,CurrencyCode,Source,ReceivedByUserId)
VALUES(@OrgId,N'DEMO-0001',@Member1,@BranchId,120,'PEN','RECEPTION',@RecepUser);
DECLARE @P1 BIGINT=SCOPE_IDENTITY();
DECLARE @CashMethod BIGINT=(SELECT PaymentMethodId FROM finance.PaymentMethods WHERE OrganizationId=@OrgId AND Code='CASH');
DECLARE @YapeMethod BIGINT=(SELECT PaymentMethodId FROM finance.PaymentMethods WHERE OrganizationId=@OrgId AND Code='YAPE');
INSERT INTO finance.PaymentSplits(OrganizationId,PaymentId,PaymentMethodId,Amount) VALUES(@OrgId,@P1,@CashMethod,40),(@OrgId,@P1,@YapeMethod,80);
INSERT INTO finance.PaymentAllocations(OrganizationId,PaymentId,ReceivableId,Amount) VALUES(@OrgId,@P1,@R1,120);
DECLARE @CashSplit BIGINT=(SELECT PaymentSplitId FROM finance.PaymentSplits WHERE OrganizationId=@OrgId AND PaymentId=@P1 AND PaymentMethodId=@CashMethod);
INSERT INTO finance.CashMovements(OrganizationId,CashShiftId,MovementType,Amount,PaymentSplitId,Description,CreatedByUserId)
VALUES(@OrgId,@Shift,'INCOME',40,@CashSplit,N'Cobro mixto membresía',@RecepUser);
UPDATE finance.Receivables SET Status='PAID' WHERE ReceivableId=@R1;

/* Partial payment example: S/50 of S/120 */
INSERT INTO finance.Payments(OrganizationId,ReceiptNumber,MemberId,BranchId,TotalAmount,CurrencyCode,Source,ReceivedByUserId)
VALUES(@OrgId,N'DEMO-0002',@Member2,@BranchId,50,'PEN','RECEPTION',@RecepUser);
DECLARE @P2 BIGINT=SCOPE_IDENTITY();
INSERT INTO finance.PaymentSplits(OrganizationId,PaymentId,PaymentMethodId,Amount,ExternalReference) VALUES(@OrgId,@P2,@YapeMethod,50,N'YAPE-DEMO-5001');
INSERT INTO finance.PaymentAllocations(OrganizationId,PaymentId,ReceivableId,Amount) VALUES(@OrgId,@P2,@R2,50);
UPDATE finance.Receivables SET Status='PARTIALLY_PAID' WHERE ReceivableId=@R2;

/* Trainers */
DECLARE @Trainer1Employee BIGINT=(SELECT EmployeeId FROM core.Employees WHERE OrganizationId=@OrgId AND PersonId=@Trainer1Person);
DECLARE @Trainer2Employee BIGINT=(SELECT EmployeeId FROM core.Employees WHERE OrganizationId=@OrgId AND PersonId=@Trainer2Person);
INSERT INTO training.TrainerProfiles(OrganizationId,EmployeeId,ExperienceYears,Modality,Bio,CertificationSummary,Languages)
VALUES(@OrgId,@Trainer1Employee,6,'BOTH',N'Especialista en fuerza e hipertrofia.',N'Entrenamiento de fuerza y acondicionamiento.',N'Español'),
      (@OrgId,@Trainer2Employee,4,'BOTH',N'Entrenamiento funcional y movilidad.',N'Entrenamiento funcional.',N'Español, Inglés');
DECLARE @Trainer1 BIGINT=(SELECT TrainerProfileId FROM training.TrainerProfiles WHERE OrganizationId=@OrgId AND EmployeeId=@Trainer1Employee);
INSERT INTO training.TrainerMemberAssignments(OrganizationId,TrainerProfileId,MemberId,AssignedFrom) VALUES(@OrgId,@Trainer1,@Member1,'2026-10-01'),(@OrgId,@Trainer1,@Member2,'2026-10-01');

/* Class demo */
INSERT INTO training.Classes(OrganizationId,Code,Name,Description,DefaultCapacity,DurationMinutes)
VALUES(@OrgId,N'FUNC-01',N'Funcional',N'Sesión grupal de entrenamiento funcional.',15,50);
DECLARE @Class BIGINT=SCOPE_IDENTITY();
INSERT INTO training.ClassSessions(OrganizationId,ClassId,BranchId,TrainerProfileId,RoomName,StartsAtUtc,EndsAtUtc,Capacity)
VALUES(@OrgId,@Class,@BranchId,@Trainer1,N'Zona Funcional','2026-10-16T00:00:00','2026-10-16T00:50:00',15);
DECLARE @Session BIGINT=SCOPE_IDENTITY();
INSERT INTO training.ClassReservations(OrganizationId,ClassSessionId,MemberId,Status,Source) VALUES(@OrgId,@Session,@Member1,'CONFIRMED','MEMBER_APP');

/* Attendance and points */
INSERT INTO access.AttendanceEvents(OrganizationId,BranchId,MemberId,EventType,AccessMethod,Result,OccurredAtUtc)
VALUES(@OrgId,@BranchId,@Member1,'ENTRY','QR','ALLOWED','2026-10-15T13:10:00'),(@OrgId,@BranchId,@Member1,'EXIT','QR','ALLOWED','2026-10-15T14:30:00');
INSERT INTO loyalty.PointAccounts(OrganizationId,MemberId,CurrentBalance,LifetimeEarned,LifetimeRedeemed) VALUES(@OrgId,@Member1,110,110,0);
DECLARE @PointAccount BIGINT=SCOPE_IDENTITY();
INSERT INTO loyalty.PointTransactions(OrganizationId,PointAccountId,TransactionType,Points,ReasonCode,Description)
VALUES(@OrgId,@PointAccount,'EARN',10,N'ATTENDANCE',N'Asistencia al gimnasio'),(@OrgId,@PointAccount,'EARN',100,N'WELCOME',N'Bono demo de bienvenida');

COMMIT TRANSACTION;
PRINT 'GymFlow fictitious demo data created successfully.';
GO
