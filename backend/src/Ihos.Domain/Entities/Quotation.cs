using Ihos.Domain.Common;

namespace Ihos.Domain.Entities;

public class Quotation : BaseEntity
{
    public Guid PlanId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? VehicleRegistration { get; set; }
    public string VehicleMake { get; set; } = string.Empty;
    public string VehicleModelName { get; set; } = string.Empty;
    public int VehicleYear { get; set; }
    public decimal PremiumAtGeneration { get; set; }
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public InsurancePlan Plan { get; set; } = null!;
}
