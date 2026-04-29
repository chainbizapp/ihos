using Ihos.Domain.Common;

namespace Ihos.Domain.Entities;

public class Customer : BaseEntity
{
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? LicenseNumber { get; set; }
    public string? VehicleRegistration { get; set; }
    public int? VehicleYear { get; set; }
    public string? PreviousInsurer { get; set; }
    public DateOnly? PreviousExpiryDate { get; set; }
}
