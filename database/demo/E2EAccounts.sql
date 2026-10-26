/* OPTIONAL LOCAL DEMO ONLY. Run through backend/scripts/provision_demo_e2e.py.
   Adds separate fictional identities; never updates existing users or hashes.
   Hash values are injected in memory, not stored in this source. */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
IF DB_NAME() <> N'GymFlowDb' THROW 51101, 'Only the local GymFlowDb demo is supported.', 1;
DECLARE @org bigint=(SELECT OrganizationId FROM core.Organizations WHERE TaxId=N'DEMO-GYMFLOW-001');
IF @org IS NULL THROW 51102, 'Install canonical demo data first.', 1;
DECLARE @branch bigint=(SELECT TOP(1) BranchId FROM core.Branches WHERE OrganizationId=@org AND Status='ACTIVE' ORDER BY BranchId);
IF @branch IS NULL THROW 51103, 'Demo branch is missing.', 1;
BEGIN TRANSACTION;
DECLARE @role varchar(20), @first nvarchar(100), @last nvarchar(150), @hash nvarchar(500), @email nvarchar(320);
DECLARE accounts CURSOR LOCAL FAST_FORWARD FOR SELECT * FROM (VALUES
 ('ADMIN',N'Alejandra',N'Rivera Demo',N'$(ADMIN_HASH)'),
 ('RECEPTION',N'Isabel',N'Navarro Demo',N'$(RECEPTION_HASH)'),
 ('TRAINER',N'Martin',N'Valverde Demo',N'$(TRAINER_HASH)'),
 ('MEMBER',N'Elena',N'Campos Demo',N'$(MEMBER_HASH)')) a(RoleCode,FirstName,LastName,PasswordHash);
OPEN accounts; FETCH NEXT FROM accounts INTO @role,@first,@last,@hash;
WHILE @@FETCH_STATUS=0
BEGIN
    SET @email=LOWER(@role)+N'.e2e@example.test';
    IF NOT EXISTS(SELECT 1 FROM security.Users WHERE NormalizedEmail=UPPER(@email))
    BEGIN
        IF @hash NOT LIKE N'pbkdf2-sha256$210000$%' THROW 51104, 'Missing generated local hash.', 1;
        INSERT core.People(OrganizationId,FirstName,LastName,Email) VALUES(@org,@first,@last,@email);
        DECLARE @person bigint=SCOPE_IDENTITY();
        INSERT security.Users(Email,NormalizedEmail,PasswordHash,EmailVerified,Status) VALUES(@email,UPPER(@email),@hash,1,'ACTIVE');
        DECLARE @user bigint=SCOPE_IDENTITY();
        INSERT security.UserOrganizations(OrganizationId,UserId,PersonId) VALUES(@org,@user,@person);
        DECLARE @userOrg bigint=SCOPE_IDENTITY();
        INSERT security.UserRoles(OrganizationId,UserOrganizationId,RoleId)
            SELECT @org,@userOrg,RoleId FROM security.Roles WHERE OrganizationId=@org AND Code=@role;
        IF @@ROWCOUNT<>1 THROW 51105, 'Canonical demo role is missing.', 1;
        IF @role='MEMBER'
            INSERT core.Members(OrganizationId,PersonId,HomeBranchId,MemberCode) VALUES(@org,@person,@branch,N'DEMO-E2E-MEMBER');
        ELSE
        BEGIN
            INSERT core.Employees(OrganizationId,PersonId,HomeBranchId,EmployeeCode,JobTitle,HireDate)
                VALUES(@org,@person,@branch,N'DEMO-E2E-'+@role,N'Local demo',CAST(SYSUTCDATETIME() AS date));
            IF @role='TRAINER'
            BEGIN
                DECLARE @employee bigint=SCOPE_IDENTITY();
                INSERT training.TrainerProfiles(OrganizationId,EmployeeId) VALUES(@org,@employee);
            END;
        END;
        INSERT audit.AuditLogs(OrganizationId,UserId,Action,EntityType,EntityId)
            VALUES(@org,@user,N'DEMO.ACCOUNT_CREATE',N'User',CAST(@user AS nvarchar(100)));
    END;
    FETCH NEXT FROM accounts INTO @role,@first,@last,@hash;
END;
CLOSE accounts; DEALLOCATE accounts;
COMMIT;
PRINT 'Local demo accounts provisioned; existing users unchanged.';
