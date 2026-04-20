using Ihos.Domain.Common;

namespace Ihos.Domain.Entities;

public class InsuranceCompany : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string ShortCode { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<ImportBatch> ImportBatches { get; set; } = new List<ImportBatch>();
    public ICollection<VehicleModelMapping> VehicleModelMappings { get; set; } = new List<VehicleModelMapping>();
    public ICollection<PlanTypeMapping> PlanTypeMappings { get; set; } = new List<PlanTypeMapping>();
    public ICollection<InsurancePlan> InsurancePlans { get; set; } = new List<InsurancePlan>();
}
