namespace Ihos.Application.Common.Interfaces;

public record VehicleMasterRow(
    string CarnameCode,
    string Brand,
    string CarModel,
    string CarOption,
    string CarCC = ""
);

/// <summary>
/// Parses a vehicle YMM master file into structured rows.
/// Implemented per-company in Infrastructure.
/// </summary>
public interface IVehicleMasterFileParser
{
    IReadOnlyList<VehicleMasterRow> Parse(Stream stream);
}
