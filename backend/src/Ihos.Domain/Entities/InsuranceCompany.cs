using Ihos.Domain.Common;
using Ihos.Domain.Enums;

namespace Ihos.Domain.Entities;

public class InsuranceCompany : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string ShortCode { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Determines which IInsurerQuoteProvider implementation resolves at runtime.
    /// Import = read pre-imported InsurancePlans from DB. Api = call provider live.
    /// </summary>
    public DataSourceType DataSource { get; set; } = DataSourceType.Import;

    public ICollection<ImportBatch> ImportBatches { get; set; } = new List<ImportBatch>();
    public ICollection<VehicleModelMapping> VehicleModelMappings { get; set; } = new List<VehicleModelMapping>();
    public ICollection<PlanTypeMapping> PlanTypeMappings { get; set; } = new List<PlanTypeMapping>();
    public ICollection<InsurancePlan> InsurancePlans { get; set; } = new List<InsurancePlan>();
    public ICollection<VehicleSyncLog> VehicleSyncLogs { get; set; } = new List<VehicleSyncLog>();
}
