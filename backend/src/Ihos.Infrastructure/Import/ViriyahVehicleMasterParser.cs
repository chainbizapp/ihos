using CsvHelper;
using CsvHelper.Configuration;
using Ihos.Application.Common.Interfaces;
using System.Globalization;

namespace Ihos.Infrastructure.Import;

/// <summary>
/// Parses Viriyah's YMM master file (db_master_car_master_v2.csv).
/// Schema: carname_code, carname_desc (brand), car_model, car_option (submodel), ...
/// </summary>
public sealed class ViriyahVehicleMasterParser : IVehicleMasterFileParser
{
    public IReadOnlyList<VehicleMasterRow> Parse(Stream stream)
    {
        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HeaderValidated   = null,
            MissingFieldFound = null,
            BadDataFound      = _ => { }
        };

        using var reader = new StreamReader(stream, leaveOpen: true);
        using var csv    = new CsvReader(reader, config);

        csv.Read();
        csv.ReadHeader();

        var rows = new List<VehicleMasterRow>();
        while (csv.Read())
        {
            rows.Add(new VehicleMasterRow(
                CarnameCode: csv.GetField("carname_code") ?? string.Empty,
                Brand      : csv.GetField("carname_desc") ?? string.Empty,
                CarModel   : csv.GetField("car_model")    ?? string.Empty,
                CarOption  : csv.GetField("car_option")   ?? string.Empty
            ));
        }
        return rows;
    }
}
