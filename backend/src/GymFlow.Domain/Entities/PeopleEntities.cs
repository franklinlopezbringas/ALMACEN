using GymFlow.Domain.Common;

namespace GymFlow.Domain.Entities;

public sealed class Person : ITenantEntity
{
    public long PersonId { get; set; }
    public long OrganizationId { get; set; }
    public Guid PublicId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? DocumentType { get; set; }
    public string? DocumentNumber { get; set; }
    public DateOnly? BirthDate { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public long? PhotoFileId { get; set; }
    public byte[] RowVersion { get; set; } = [];
}

public sealed class Employee : ITenantEntity
{
    public long EmployeeId { get; set; }
    public long OrganizationId { get; set; }
    public long PersonId { get; set; }
    public long? HomeBranchId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string JobTitle { get; set; } = string.Empty;
    public DateOnly HireDate { get; set; }
    public DateOnly? TerminationDate { get; set; }
    public string Status { get; set; } = "ACTIVE";
    public byte[] RowVersion { get; set; } = [];
}

public sealed class Member : ITenantEntity
{
    public long MemberId { get; set; }
    public long OrganizationId { get; set; }
    public Guid PublicId { get; set; }
    public long PersonId { get; set; }
    public long? HomeBranchId { get; set; }
    public string MemberCode { get; set; } = string.Empty;
    public DateOnly RegistrationDate { get; set; }
    public string Status { get; set; } = "ACTIVE";
    public byte[] RowVersion { get; set; } = [];
}

public sealed class Prospect : ITenantEntity
{
    public long ProspectId { get; set; }
    public long OrganizationId { get; set; }
    public long PersonId { get; set; }
    public long? LeadSourceId { get; set; }
    public long? InterestedPlanId { get; set; }
    public string Status { get; set; } = "NEW";
    public DateTime FirstContactAtUtc { get; set; }
    public DateTime? NextFollowUpAtUtc { get; set; }
    public DateTime? ConvertedAtUtc { get; set; }
    public long? ConvertedMemberId { get; set; }
    public string? Notes { get; set; }
    public long? CreatedByUserId { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
