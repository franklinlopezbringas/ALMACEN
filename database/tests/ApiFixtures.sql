/* Isolated fictitious fixtures. RunTag is supplied by the integration runner (hex UUID). */
USE GymFlowDb;
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
BEGIN TRANSACTION;
DECLARE @tag nvarchar(32) = N'$(RunTag)', @a bigint, @b bigint, @branch bigint, @otherBranch bigint;
INSERT core.Organizations(LegalName,TradeName,TaxId) VALUES(N'Validation A '+@tag,N'Validation A',N'VA-'+LEFT(@tag,24));
SET @a=SCOPE_IDENTITY();
INSERT core.Organizations(LegalName,TradeName,TaxId) VALUES(N'Validation B '+@tag,N'Validation B',N'VB-'+LEFT(@tag,24));
SET @b=SCOPE_IDENTITY();
EXEC security.usp_SeedOrganizationDefaults @a;
EXEC security.usp_SeedOrganizationDefaults @b;
INSERT core.Branches(OrganizationId,Code,Name) VALUES(@a,N'TEST',N'Validation');
SET @branch=SCOPE_IDENTITY();
INSERT core.Branches(OrganizationId,Code,Name) VALUES(@b,N'TEST',N'Other organization');
SET @otherBranch=SCOPE_IDENTITY();
DECLARE @roles TABLE(Code nvarchar(20));
INSERT @roles VALUES('ADMIN'),('RECEPTION'),('TRAINER'),('MEMBER');
INSERT core.People(OrganizationId,FirstName,LastName,Email)
SELECT @a,Code,N'Validation',LOWER(Code)+'.'+@tag+'@demo.gymflow.local' FROM @roles;
INSERT security.Users(Email,NormalizedEmail,EmailVerified,Status)
SELECT Email,UPPER(Email),1,'ACTIVE' FROM core.People WHERE OrganizationId=@a;
INSERT security.UserOrganizations(OrganizationId,UserId,PersonId)
SELECT @a,u.UserId,p.PersonId FROM core.People p JOIN security.Users u ON u.Email=p.Email WHERE p.OrganizationId=@a;
INSERT security.UserRoles(OrganizationId,UserOrganizationId,RoleId)
SELECT @a,uo.UserOrganizationId,r.RoleId FROM security.UserOrganizations uo
JOIN core.People p ON p.PersonId=uo.PersonId JOIN security.Roles r ON r.OrganizationId=@a AND r.Code=p.FirstName WHERE uo.OrganizationId=@a;
INSERT core.Employees(OrganizationId,PersonId,HomeBranchId,EmployeeCode,JobTitle,HireDate)
SELECT @a,PersonId,@branch,FirstName,FirstName,CONVERT(date,SYSUTCDATETIME()) FROM core.People WHERE OrganizationId=@a AND FirstName IN ('RECEPTION','TRAINER');
DECLARE @employee bigint=(SELECT EmployeeId FROM core.Employees WHERE OrganizationId=@a AND EmployeeCode='RECEPTION');
INSERT training.TrainerProfiles(OrganizationId,EmployeeId) SELECT @a,EmployeeId FROM core.Employees WHERE OrganizationId=@a AND EmployeeCode='TRAINER';
DECLARE @trainer bigint=SCOPE_IDENTITY();
INSERT core.Members(OrganizationId,PersonId,HomeBranchId,MemberCode)
SELECT @a,PersonId,@branch,'MEMBER' FROM core.People WHERE OrganizationId=@a AND FirstName='MEMBER';
DECLARE @member bigint=SCOPE_IDENTITY();
INSERT training.TrainerMemberAssignments(OrganizationId,TrainerProfileId,MemberId,AssignedFrom)
VALUES(@a,@trainer,@member,CONVERT(date,SYSUTCDATETIME()));
INSERT core.People(OrganizationId,FirstName,LastName,Email) VALUES(@b,'ADMIN','Other','other.'+@tag+'@demo.gymflow.local');
DECLARE @otherPerson bigint=SCOPE_IDENTITY();
INSERT security.Users(Email,NormalizedEmail,EmailVerified,Status)
SELECT Email,UPPER(Email),1,'ACTIVE' FROM core.People WHERE PersonId=@otherPerson;
DECLARE @otherUser bigint=SCOPE_IDENTITY();
INSERT security.UserOrganizations(OrganizationId,UserId,PersonId) VALUES(@b,@otherUser,@otherPerson);
DECLARE @otherUo bigint=SCOPE_IDENTITY();
INSERT security.UserRoles(OrganizationId,UserOrganizationId,RoleId) SELECT @b,@otherUo,RoleId FROM security.Roles WHERE OrganizationId=@b AND Code='ADMIN';
INSERT core.Members(OrganizationId,PersonId,HomeBranchId,MemberCode) VALUES(@b,@otherPerson,@otherBranch,'OTHER');
DECLARE @otherMember bigint=SCOPE_IDENTITY();
INSERT membership.Plans(OrganizationId,Code,Name) VALUES(@a,'TEST','Validation Plan');
DECLARE @plan bigint=SCOPE_IDENTITY();
INSERT membership.PlanVersions(OrganizationId,PlanId,VersionNumber,Price,CurrencyCode,DurationValue,DurationUnit,ValidFrom)
VALUES(@a,@plan,1,120,'PEN',1,'MONTH',CONVERT(date,SYSUTCDATETIME()));
DECLARE @version bigint=SCOPE_IDENTITY();
INSERT finance.CashRegisters(OrganizationId,BranchId,Code,Name) VALUES(@a,@branch,'TEST','Validation cash');
DECLARE @register bigint=SCOPE_IDENTITY();
INSERT training.Classes(OrganizationId,Code,Name,DefaultCapacity,DurationMinutes) VALUES(@a,'TEST','Validation Class',2,50);
DECLARE @class bigint=SCOPE_IDENTITY();
INSERT training.ClassSessions(OrganizationId,ClassId,BranchId,TrainerProfileId,StartsAtUtc,EndsAtUtc,Capacity)
VALUES(@a,@class,@branch,@trainer,DATEADD(day,1,SYSUTCDATETIME()),DATEADD(minute,50,DATEADD(day,1,SYSUTCDATETIME())),2);
DECLARE @session bigint=SCOPE_IDENTITY();
INSERT commerce.Products(OrganizationId,Sku,Name,SalePrice,CurrencyCode) VALUES(@a,'TEST','Validation Product',10,'PEN');
DECLARE @product bigint=SCOPE_IDENTITY();
INSERT commerce.InventoryBalances(OrganizationId,BranchId,ProductId,QuantityOnHand) VALUES(@a,@branch,@product,10);
INSERT commerce.InventoryMovements(OrganizationId,BranchId,ProductId,MovementType,Quantity,Reason) VALUES(@a,@branch,@product,'ADJUSTMENT_IN',10,'Validation initial stock');
INSERT loyalty.PointAccounts(OrganizationId,MemberId,CurrentBalance,LifetimeEarned) VALUES(@a,@member,110,110);
DECLARE @account bigint=SCOPE_IDENTITY();
INSERT loyalty.PointTransactions(OrganizationId,PointAccountId,TransactionType,Points,ReasonCode) VALUES(@a,@account,'EARN',110,'VALIDATION');
INSERT loyalty.Rewards(OrganizationId,RewardType,Name,PointsCost,StockLimit) VALUES(@a,'BENEFIT','Validation Reward',60,1);
DECLARE @reward bigint=SCOPE_IDENTITY();
DECLARE @memberUser bigint=(SELECT uo.UserId FROM security.UserOrganizations uo JOIN core.Members m ON m.PersonId=uo.PersonId WHERE m.MemberId=@member);
INSERT communication.Notifications(OrganizationId,UserId,NotificationType,Title,Body) VALUES(@a,@memberUser,'VALIDATION','Validation','Validation message');
DECLARE @notification bigint=SCOPE_IDENTITY();
COMMIT;
SELECT @a orgId, @b otherOrgId, (SELECT PublicId FROM core.Organizations WHERE OrganizationId=@a) org,
 (SELECT PublicId FROM core.Organizations WHERE OrganizationId=@b) otherOrg,
 @branch branch, @otherBranch otherBranch, @member member, @otherMember otherMember,
 (SELECT PublicId FROM core.Members WHERE MemberId=@otherMember) otherMemberPublic,
 @employee employee, @trainer trainer, @version version, @register registerId, @session sessionId,
 @product product, @reward reward, @notification notification,
 (SELECT PaymentMethodId FROM finance.PaymentMethods WHERE OrganizationId=@a AND Code='CASH') cash,
 (SELECT PaymentMethodId FROM finance.PaymentMethods WHERE OrganizationId=@a AND Code='YAPE') yape,
 (SELECT UserId FROM security.UserOrganizations uo JOIN core.People p ON p.PersonId=uo.PersonId WHERE uo.OrganizationId=@a AND p.FirstName='ADMIN') adminUser,
 @memberUser memberUser FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
