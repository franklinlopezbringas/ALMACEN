/* Optional local demo-only Reception HTTP fixture. No schema changes or deletions.
   RunTag must be a hexadecimal UUID. Execute sqlcmd with -f 65001 (UTF-8).
   Financial history remains after validation. */
USE GymFlowDb;
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
DECLARE @tag varchar(32)='$(RunTag)';
IF LEN(@tag)<>32 OR @tag LIKE '%[^0-9a-f]%' THROW 51000,'Invalid test tag.',1;
DECLARE @org bigint=(SELECT OrganizationId FROM core.Organizations WHERE TaxId=N'DEMO-GYMFLOW-001');
IF @org IS NULL THROW 51000,'Canonical fictitious demo tenant required.',1;
-- Repair fixture display text if an older runner decoded this UTF-8 file as ANSI.
UPDATE finance.CashRegisters SET Name=N'Caja de práctica' WHERE OrganizationId=@org AND Code='DEMO-RECEPTION';
UPDATE commerce.Products SET Name=N'Botella deportiva térmica' WHERE OrganizationId=@org AND Sku LIKE 'DEMO-RECEPTION-%';
BEGIN TRANSACTION;
DECLARE @branch bigint=(SELECT TOP(1) BranchId FROM core.Branches WHERE OrganizationId=@org AND Status='ACTIVE' ORDER BY BranchId);
IF NOT EXISTS(SELECT 1 FROM finance.CashRegisters WHERE OrganizationId=@org AND Code='DEMO-RECEPTION')
 INSERT finance.CashRegisters(OrganizationId,BranchId,Code,Name) VALUES(@org,@branch,'DEMO-RECEPTION',N'Caja de práctica');
DECLARE @register bigint=(SELECT CashRegisterId FROM finance.CashRegisters WHERE OrganizationId=@org AND Code='DEMO-RECEPTION');
INSERT commerce.Products(OrganizationId,Sku,Name,SalePrice,CurrencyCode,IsPublic)
 VALUES(@org,'DEMO-RECEPTION-'+@tag,N'Botella deportiva térmica',35,'PEN',0);
DECLARE @product bigint=SCOPE_IDENTITY();
INSERT commerce.InventoryBalances(OrganizationId,BranchId,ProductId,QuantityOnHand) VALUES(@org,@branch,@product,3);
INSERT commerce.InventoryMovements(OrganizationId,BranchId,ProductId,MovementType,Quantity,ReferenceText,Reason)
 VALUES(@org,@branch,@product,'ADJUSTMENT_IN',3,'DEMO-RECEPTION-'+@tag,N'Existencias ficticias para validación local');
DECLARE @class bigint=(SELECT TOP(1) ClassId FROM training.Classes WHERE OrganizationId=@org ORDER BY ClassId);
INSERT training.ClassSessions(OrganizationId,ClassId,BranchId,StartsAtUtc,EndsAtUtc,Capacity,RoomName)
 VALUES(@org,@class,@branch,DATEADD(day,2,SYSUTCDATETIME()),DATEADD(minute,60,DATEADD(day,2,SYSUTCDATETIME())),10,N'Sala de práctica');
DECLARE @session bigint=SCOPE_IDENTITY();
COMMIT;
SELECT @branch branchId,@register cashRegisterId,@session classSessionId,PublicId productPublicId,Sku sku
 FROM commerce.Products WHERE ProductId=@product FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;
