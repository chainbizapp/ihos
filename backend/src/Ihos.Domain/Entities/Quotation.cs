using Ihos.Domain.Common;

namespace Ihos.Domain.Entities;

public class Quotation : BaseEntity
{
    // Up to 3 plans per quotation (PlanId is required; PlanId2/3 are optional)
    public Guid PlanId { get; set; }
    public Guid? PlanId2 { get; set; }
    public Guid? PlanId3 { get; set; }

    public string CustomerName { get; set; } = string.Empty;
    public string? VehicleRegistration { get; set; }
    public string VehicleMake { get; set; } = string.Empty;
    public string VehicleModelName { get; set; } = string.Empty;
    public int VehicleYear { get; set; }

    public decimal PremiumAtGeneration { get; set; }
    public decimal? PremiumAtGeneration2 { get; set; }
    public decimal? PremiumAtGeneration3 { get; set; }

    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public InsurancePlan Plan { get; set; } = null!;
    public InsurancePlan? Plan2 { get; set; }
    public InsurancePlan? Plan3 { get; set; }
}
