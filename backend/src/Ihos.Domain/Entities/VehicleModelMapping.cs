using Ihos.Domain.Common;

namespace Ihos.Domain.Entities;

public class VehicleModelMapping : BaseEntity
{
    public Guid CompanyId { get; set; }
    public string RawName { get; set; } = string.Empty;
    public Guid CanonicalModelId { get; set; }
    public bool IsAutoSuggested { get; set; } = false;

    public InsuranceCompany Company { get; set; } = null!;
    public VehicleModel CanonicalModel { get; set; } = null!;
}
