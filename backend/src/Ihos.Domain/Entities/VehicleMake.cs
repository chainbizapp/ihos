using Ihos.Domain.Common;

namespace Ihos.Domain.Entities;

public class VehicleMake : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public ICollection<VehicleModel> Models { get; set; } = new List<VehicleModel>();
}
