using Ihos.Domain.Common;

namespace Ihos.Domain.Entities;

public class VehicleModel : BaseEntity
{
    public Guid MakeId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? SubModel { get; set; }
    /// <summary>
    /// Engine displacement / CC label (e.g. "1.5", "3.0", "1.8 HV").
    /// Null for models where CC is not tracked or is embedded in SubModel.
    /// </summary>
    public string? EngineCC { get; set; }

    /// <summary>
    /// Transmission type, e.g., "Automatic" or "Manual". Extracted from specific source files.
    /// </summary>
    public string? GearType { get; set; }

    public VehicleMake Make { get; set; } = null!;
    public ICollection<VehicleModelMapping> Mappings { get; set; } = new List<VehicleModelMapping>();
    public ICollection<InsurancePlan> InsurancePlans { get; set; } = new List<InsurancePlan>();
    public ICollection<VehicleMarketValue> MarketValues { get; set; } = new List<VehicleMarketValue>();
}
