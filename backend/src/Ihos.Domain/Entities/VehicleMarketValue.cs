using Ihos.Domain.Common;

namespace Ihos.Domain.Entities;

public class VehicleMarketValue : BaseEntity
{
    public Guid VehicleModelId { get; set; }
    public int ProductionYear { get; set; }
    public decimal MarketValue { get; set; }
    public string? Source { get; set; }

    public VehicleModel VehicleModel { get; set; } = null!;
}
