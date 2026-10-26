/* Exercise persisted inventory, workout and job lifecycles without retaining mutations. */
USE GymFlowDb;
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
BEGIN TRANSACTION;
DECLARE @org bigint=(SELECT MAX(OrganizationId) FROM core.Organizations WHERE TaxId LIKE 'VA-%');
IF @org IS NULL THROW 51980, 'Run ApiFixtures first.', 1;
DECLARE @branch bigint=(SELECT MIN(BranchId) FROM core.Branches WHERE OrganizationId=@org);
DECLARE @member bigint=(SELECT MIN(MemberId) FROM core.Members WHERE OrganizationId=@org);
DECLARE @trainer bigint=(SELECT MIN(TrainerProfileId) FROM training.TrainerProfiles WHERE OrganizationId=@org);
DECLARE @product bigint=(SELECT MIN(ProductId) FROM commerce.Products WHERE OrganizationId=@org);
DECLARE @initial decimal(18,3)=(SELECT QuantityOnHand FROM commerce.InventoryBalances WHERE OrganizationId=@org AND BranchId=@branch AND ProductId=@product);
INSERT commerce.InventoryMovements(OrganizationId,BranchId,ProductId,MovementType,Quantity,Reason)
VALUES(@org,@branch,@product,'ADJUSTMENT_IN',3,'Validation'),(@org,@branch,@product,'SALE_OUT',2,'Validation');
UPDATE commerce.InventoryBalances SET QuantityOnHand=QuantityOnHand+1,UpdatedAtUtc=SYSUTCDATETIME()
WHERE OrganizationId=@org AND BranchId=@branch AND ProductId=@product;
IF NOT EXISTS(SELECT 1 FROM commerce.InventoryBalances b JOIN commerce.vw_InventoryLedgerBalances v
 ON b.OrganizationId=v.OrganizationId AND b.BranchId=v.BranchId AND b.ProductId=v.ProductId
 WHERE b.OrganizationId=@org AND b.ProductId=@product AND b.QuantityOnHand=@initial+1 AND b.QuantityOnHand=v.LedgerQuantity)
 THROW 51981,'Inventory ledger did not reconcile.',1;

INSERT training.Exercises(OrganizationId,Name) VALUES(@org,N'Validation Exercise');
DECLARE @exercise bigint=SCOPE_IDENTITY();
INSERT training.WorkoutTemplates(OrganizationId,Name,CreatedByTrainerProfileId) VALUES(@org,N'Validation Routine',@trainer);
DECLARE @template bigint=SCOPE_IDENTITY();
INSERT training.WorkoutTemplateDays(OrganizationId,WorkoutTemplateId,DayNumber,Name) VALUES(@org,@template,1,N'Day 1');
DECLARE @day bigint=SCOPE_IDENTITY();
INSERT training.WorkoutTemplateExercises(OrganizationId,WorkoutTemplateDayId,ExerciseId,SortOrder,Sets,Repetitions) VALUES(@org,@day,@exercise,1,3,N'10');
DECLARE @templateExercise bigint=SCOPE_IDENTITY();
INSERT training.WorkoutAssignments(OrganizationId,MemberId,WorkoutTemplateId,TrainerProfileId,StartDate)
VALUES(@org,@member,@template,@trainer,CONVERT(date,SYSUTCDATETIME()));
DECLARE @assignment bigint=SCOPE_IDENTITY();
INSERT training.WorkoutSessions(OrganizationId,WorkoutAssignmentId,WorkoutTemplateDayId) VALUES(@org,@assignment,@day);
DECLARE @session bigint=SCOPE_IDENTITY();
INSERT training.ExerciseCompletions(OrganizationId,WorkoutSessionId,WorkoutTemplateExerciseId,ActualSets,ActualRepetitions)
VALUES(@org,@session,@templateExercise,3,N'10');
UPDATE training.WorkoutSessions SET Status='COMPLETED',CompletedAtUtc=SYSUTCDATETIME() WHERE WorkoutSessionId=@session;
INSERT training.Assessments(OrganizationId,MemberId,TrainerProfileId,MetricsJson,VisibleNotes,PrivateNotes)
VALUES(@org,@member,@trainer,N'{"weightKg":70}',N'Validation',N'Private validation');
IF NOT EXISTS(SELECT 1 FROM training.WorkoutSessions WHERE WorkoutSessionId=@session AND Status='COMPLETED')
 THROW 51982,'Workout lifecycle failed.',1;

INSERT automation.Jobs(OrganizationId,JobType,PayloadJson) VALUES(@org,'VALIDATION','{}');
DECLARE @job bigint=SCOPE_IDENTITY();
UPDATE automation.Jobs SET Status='RUNNING',Attempts=Attempts+1 WHERE JobId=@job AND Status='PENDING';
INSERT automation.Executions(OrganizationId,JobId,WorkerId) VALUES(@org,@job,N'validation-only');
DECLARE @execution bigint=SCOPE_IDENTITY();
INSERT automation.ExecutionLogs(OrganizationId,ExecutionId,LogLevel,Message) VALUES(@org,@execution,'INFO',N'Validation execution');
UPDATE automation.Executions SET Status='COMPLETED',FinishedAtUtc=SYSUTCDATETIME(),ResultJson=N'{"ok":true}' WHERE ExecutionId=@execution;
UPDATE automation.Jobs SET Status='COMPLETED',UpdatedAtUtc=SYSUTCDATETIME() WHERE JobId=@job;
IF NOT EXISTS(SELECT 1 FROM automation.Jobs j JOIN automation.Executions e ON e.JobId=j.JobId
 WHERE j.JobId=@job AND j.Status='COMPLETED' AND e.Status='COMPLETED' AND j.Attempts=1)
 THROW 51983,'Job persistence lifecycle failed.',1;
ROLLBACK;
SELECT 'PASS' Result, 'Inventory, workouts and job persistence lifecycles; all test mutations rolled back.' Detail;
