using Ihos.Domain.Common;
using Ihos.Domain.Enums;

namespace Ihos.Domain.Entities;

public class PlanTypeMapping : BaseEntity
{
    public Guid CompanyId { get; set; }
    public string RawName { get; set; } = string.Empty;
    public PlanType CanonicalPlanType { get; set; }

    public InsuranceCompany Company { get; set; } = null!;
}
