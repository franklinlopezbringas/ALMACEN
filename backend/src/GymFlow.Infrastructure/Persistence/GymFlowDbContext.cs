using GymFlow.Application.Abstractions;
using GymFlow.Domain.Entities;
using GymFlow.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace GymFlow.Infrastructure.Persistence;

public sealed class GymFlowDbContext(DbContextOptions<GymFlowDbContext> options, ICurrentTenant currentTenant) : DbContext(options)
{
    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        ValidateTenantWrites();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        ValidateTenantWrites();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void ValidateTenantWrites()
    {
        foreach (var entry in ChangeTracker.Entries().Where(x => x.State is EntityState.Added or EntityState.Modified))
            foreach (var property in entry.Properties)
                if (property.CurrentValue is string value && property.Metadata.GetMaxLength() is int limit && value.Length > limit)
                    throw new ArgumentException($"{property.Metadata.Name} exceeds its maximum length of {limit}.");
        foreach (var entry in ChangeTracker.Entries<ITenantEntity>())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted)) continue;
            if (!currentTenant.IsResolved || entry.Entity.OrganizationId != currentTenant.OrganizationId
                || (entry.State != EntityState.Added && entry.Property(x => x.OrganizationId).OriginalValue != currentTenant.OrganizationId))
                throw new UnauthorizedAccessException("Cannot write data belonging to another organization.");
        }
    }

    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<User> Users => Set<User>();
    public DbSet<UserOrganization> UserOrganizations => Set<UserOrganization>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<UserSession> UserSessions => Set<UserSession>();
    public DbSet<Person> People => Set<Person>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<Member> Members => Set<Member>();
    public DbSet<Prospect> Prospects => Set<Prospect>();
    public DbSet<ProspectActivity> ProspectActivities => Set<ProspectActivity>();
    public DbSet<LeadSource> LeadSources => Set<LeadSource>();
    public DbSet<Plan> Plans => Set<Plan>();
    public DbSet<PlanVersion> PlanVersions => Set<PlanVersion>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<Receivable> Receivables => Set<Receivable>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<PaymentSplit> PaymentSplits => Set<PaymentSplit>();
    public DbSet<PaymentAllocation> PaymentAllocations => Set<PaymentAllocation>();
    public DbSet<PaymentMethod> PaymentMethods => Set<PaymentMethod>();
    public DbSet<CashRegister> CashRegisters => Set<CashRegister>();
    public DbSet<CashShift> CashShifts => Set<CashShift>();
    public DbSet<ShiftHandoff> ShiftHandoffs => Set<ShiftHandoff>();
    public DbSet<CashMovement> CashMovements => Set<CashMovement>();
    public DbSet<ReceivableBalance> ReceivableBalances => Set<ReceivableBalance>();
    public DbSet<AccessException> AccessExceptions => Set<AccessException>();
    public DbSet<AttendanceEvent> AttendanceEvents => Set<AttendanceEvent>();
    public DbSet<TrainerProfile> TrainerProfiles => Set<TrainerProfile>();
    public DbSet<TrainerMemberAssignment> TrainerMemberAssignments => Set<TrainerMemberAssignment>();
    public DbSet<ProgressReview> ProgressReviews => Set<ProgressReview>();
    public DbSet<GymClass> Classes => Set<GymClass>();
    public DbSet<ClassSession> ClassSessions => Set<ClassSession>();
    public DbSet<ClassReservation> ClassReservations => Set<ClassReservation>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<InventoryBalance> InventoryBalances => Set<InventoryBalance>();
    public DbSet<PointAccount> PointAccounts => Set<PointAccount>();
    public DbSet<PointTransaction> PointTransactions => Set<PointTransaction>();
    public DbSet<Reward> Rewards => Set<Reward>();
    public DbSet<RewardRedemption> RewardRedemptions => Set<RewardRedemption>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AutomationJob> AutomationJobs => Set<AutomationJob>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Organization>(b =>
        {
            b.ToTable("Organizations", "core");
            b.HasKey(x => x.OrganizationId);
            b.Property(x => x.PublicId).ValueGeneratedOnAdd();
            b.Property(x => x.RowVersion).IsRowVersion();
        });

        modelBuilder.Entity<Branch>(b =>
        {
            b.ToTable("Branches", "core");
            b.HasKey(x => x.BranchId);
            b.Property(x => x.RowVersion).IsRowVersion();
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });

        modelBuilder.Entity<User>(b =>
        {
            b.ToTable("Users", "security");
            b.HasKey(x => x.UserId);
            b.Property(x => x.RowVersion).IsRowVersion();
        });

        modelBuilder.Entity<UserOrganization>(b =>
        {
            b.ToTable("UserOrganizations", "security");
            b.HasKey(x => x.UserOrganizationId);
            b.Property(x => x.RowVersion).IsRowVersion();
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });

        modelBuilder.Entity<Role>(b =>
        {
            b.ToTable("Roles", "security");
            b.HasKey(x => x.RoleId);
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<Permission>(b => { b.ToTable("Permissions", "security"); b.HasKey(x => x.PermissionId); });
        modelBuilder.Entity<UserRole>(b =>
        {
            b.ToTable("UserRoles", "security");
            b.HasKey(x => new { x.OrganizationId, x.UserOrganizationId, x.RoleId });
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<RolePermission>(b =>
        {
            b.ToTable("RolePermissions", "security");
            b.HasKey(x => new { x.RoleId, x.PermissionId });
        });
        modelBuilder.Entity<UserSession>(b => { b.ToTable("UserSessions", "security"); b.HasKey(x => x.UserSessionId); });

        modelBuilder.Entity<Person>(b =>
        {
            b.ToTable("People", "core");
            b.HasKey(x => x.PersonId);
            b.Property(x => x.BirthDate).HasColumnType("date");
            b.Property(x => x.RowVersion).IsRowVersion();
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<Employee>(b =>
        {
            b.ToTable("Employees", "core"); b.HasKey(x => x.EmployeeId);
            b.Property(x => x.HireDate).HasColumnType("date"); b.Property(x => x.TerminationDate).HasColumnType("date");
            b.Property(x => x.RowVersion).IsRowVersion();
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<Member>(b =>
        {
            b.ToTable("Members", "core"); b.HasKey(x => x.MemberId);
            b.Property(x => x.PublicId).ValueGeneratedOnAdd();
            b.Property(x => x.RegistrationDate).HasColumnType("date"); b.Property(x => x.RowVersion).IsRowVersion();
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<Prospect>(b =>
        {
            b.ToTable("Prospects", "crm"); b.HasKey(x => x.ProspectId); b.Property(x => x.RowVersion).IsRowVersion();
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<LeadSource>(b =>
        {
            b.ToTable("LeadSources", "crm"); b.HasKey(x => x.LeadSourceId);
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });

        modelBuilder.Entity<Plan>(b =>
        {
            b.ToTable("Plans", "membership"); b.HasKey(x => x.PlanId); b.Property(x => x.RowVersion).IsRowVersion();
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<PlanVersion>(b =>
        {
            b.ToTable("PlanVersions", "membership"); b.HasKey(x => x.PlanVersionId);
            b.Property(x => x.Price).HasPrecision(19,4); b.Property(x => x.ValidFrom).HasColumnType("date"); b.Property(x => x.ValidTo).HasColumnType("date");
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<Membership>(b =>
        {
            b.ToTable("Memberships", "membership", t => t.UseSqlOutputClause(false)); b.HasKey(x => x.MembershipId);
            b.Property(x => x.ContractedPrice).HasPrecision(19,4); b.Property(x => x.StartDate).HasColumnType("date"); b.Property(x => x.EndDate).HasColumnType("date");
            b.Property(x => x.RowVersion).IsRowVersion(); b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });

        modelBuilder.Entity<Receivable>(b =>
        {
            b.ToTable("Receivables", "finance"); b.HasKey(x => x.ReceivableId); b.Property(x => x.TotalAmount).HasPrecision(19,4);
            b.Property(x => x.DueDate).HasColumnType("date"); b.Property(x => x.RowVersion).IsRowVersion();
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<Payment>(b =>
        {
            b.ToTable("Payments", "finance"); b.HasKey(x => x.PaymentId); b.Property(x => x.TotalAmount).HasPrecision(19,4);
            b.Property(x => x.RowVersion).IsRowVersion(); b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<PaymentSplit>(b =>
        {
            b.ToTable("PaymentSplits", "finance", t => t.UseSqlOutputClause(false)); b.HasKey(x => x.PaymentSplitId); b.Property(x => x.Amount).HasPrecision(19,4);
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<PaymentAllocation>(b =>
        {
            b.ToTable("PaymentAllocations", "finance", t => t.UseSqlOutputClause(false)); b.HasKey(x => x.PaymentAllocationId); b.Property(x => x.Amount).HasPrecision(19,4);
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<PaymentMethod>(b =>
        {
            b.ToTable("PaymentMethods", "finance"); b.HasKey(x => x.PaymentMethodId); b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<CashRegister>(b =>
        {
            b.ToTable("CashRegisters", "finance"); b.HasKey(x => x.CashRegisterId);
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<CashShift>(b =>
        {
            b.ToTable("CashShifts", "finance"); b.HasKey(x => x.CashShiftId); b.Property(x => x.OpeningAmount).HasPrecision(19,4);
            b.Property(x => x.ExpectedAmountAtClose).HasPrecision(19,4); b.Property(x => x.CountedAmountAtClose).HasPrecision(19,4); b.Property(x => x.DifferenceAmount).HasPrecision(19,4);
            b.Property(x => x.RowVersion).IsRowVersion(); b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<CashMovement>(b =>
        {
            b.ToTable("CashMovements", "finance", t => t.UseSqlOutputClause(false)); b.HasKey(x => x.CashMovementId); b.Property(x => x.Amount).HasPrecision(19,4);
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<ReceivableBalance>(b =>
        {
            b.HasNoKey(); b.ToView("vw_ReceivableBalances", "finance"); b.Property(x => x.TotalAmount).HasPrecision(19,4); b.Property(x => x.BalanceAmount).HasPrecision(19,4);
            b.Property(x => x.DueDate).HasColumnType("date"); b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });

        modelBuilder.Entity<AccessException>(b =>
        {
            b.ToTable("AccessExceptions", "access"); b.HasKey(x => x.AccessExceptionId); b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<AttendanceEvent>(b =>
        {
            b.ToTable("AttendanceEvents", "access"); b.HasKey(x => x.AttendanceEventId); b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<TrainerProfile>(b =>
        {
            b.ToTable("TrainerProfiles", "training"); b.HasKey(x => x.TrainerProfileId); b.Property(x => x.RowVersion).IsRowVersion();
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<TrainerMemberAssignment>(b =>
        {
            b.ToTable("TrainerMemberAssignments", "training"); b.HasKey(x => x.TrainerMemberAssignmentId);
            b.Property(x => x.AssignedFrom).HasColumnType("date"); b.Property(x => x.AssignedTo).HasColumnType("date");
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<ProgressReview>(b =>
        {
            b.ToTable("ProgressReviews", "training"); b.HasKey(x => x.ProgressReviewId);
            b.Property(x => x.ProgressPercentage).HasPrecision(5,2);
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<GymClass>(b =>
        {
            b.ToTable("Classes", "training"); b.HasKey(x => x.ClassId); b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<ClassSession>(b =>
        {
            b.ToTable("ClassSessions", "training"); b.HasKey(x => x.ClassSessionId); b.Property(x => x.RowVersion).IsRowVersion();
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<ClassReservation>(b =>
        {
            b.ToTable("ClassReservations", "training"); b.HasKey(x => x.ClassReservationId); b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<Product>(b =>
        {
            b.ToTable("Products", "commerce"); b.HasKey(x => x.ProductId); b.Property(x => x.SalePrice).HasPrecision(19,4); b.Property(x => x.MinimumStock).HasPrecision(18,3);
            b.Property(x => x.RowVersion).IsRowVersion(); b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<InventoryBalance>(b =>
        {
            b.ToTable("InventoryBalances", "commerce"); b.HasKey(x => new { x.BranchId, x.ProductId }); b.Property(x => x.QuantityOnHand).HasPrecision(18,3);
            b.Property(x => x.RowVersion).IsRowVersion(); b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<PointAccount>(b =>
        {
            b.ToTable("PointAccounts", "loyalty"); b.HasKey(x => x.PointAccountId); b.Property(x => x.RowVersion).IsRowVersion();
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<PointTransaction>(b =>
        {
            b.ToTable("PointTransactions", "loyalty"); b.HasKey(x => x.PointTransactionId);
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<Reward>(b =>
        {
            b.ToTable("Rewards", "loyalty"); b.HasKey(x => x.RewardId);
            b.Property(x => x.PublicId).ValueGeneratedOnAdd(); b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<RewardRedemption>(b =>
        {
            b.ToTable("RewardRedemptions", "loyalty", t => t.UseSqlOutputClause(false)); b.HasKey(x => x.RewardRedemptionId);
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<Notification>(b =>
        {
            b.ToTable("Notifications", "communication"); b.HasKey(x => x.NotificationId);
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<AutomationJob>(b =>
        {
            b.ToTable("Jobs", "automation"); b.HasKey(x => x.JobId); b.Property(x => x.PublicId).ValueGeneratedOnAdd();
            b.Property(x => x.RowVersion).IsRowVersion(); b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<ProspectActivity>(b =>
        {
            b.ToTable("ProspectActivities", "crm"); b.HasKey(x => x.ProspectActivityId);
            b.Property(x => x.OccurredAtUtc).HasColumnType("datetime2(3)");
            b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        modelBuilder.Entity<ShiftHandoff>(b =>
        {
            b.ToTable("ShiftHandoffs", "core", t => t.UseSqlOutputClause(false)); b.HasKey(x => x.ShiftHandoffId);
            b.Property(x => x.RowVersion).IsRowVersion(); b.HasQueryFilter(x => x.OrganizationId == currentTenant.OrganizationId);
        });
        SqlColumnMappings.Apply(modelBuilder);
    }
}
