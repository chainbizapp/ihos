using System;
using System.Linq;
using Npgsql;

var connString = "Host=localhost;Database=ihos_db;Username=postgres;Password=postgres";
await using var conn = new NpgsqlConnection(connString);
await conn.OpenAsync();

await using var cmd = new NpgsqlCommand("SELECT p.\"Id\", p.\"MinYear\", p.\"MaxYear\", p.\"VehicleModelId\", v.\"Name\", v.\"SubModel\", v.\"EngineCC\", v.\"GearType\" FROM insurance_plans p JOIN vehicle_models v ON p.\"VehicleModelId\" = v.\"Id\" JOIN vehicle_makes m ON v.\"MakeId\" = m.\"Id\" WHERE m.\"Name\" ILIKE '%Audi%' AND v.\"Name\" ILIKE '%A3%' OR v.\"Name\" ILIKE '%A 3%';", conn);
await using var reader = await cmd.ExecuteReaderAsync();

Console.WriteLine("Plans for Audi A3:");
while (await reader.ReadAsync())
{
    Console.WriteLine($"Plan ID: {reader[0]}, MinAge: {reader[1]}, MaxAge: {reader[2]}, ModelName: {reader[4]}, SubModel: {reader[5]}, EngineCC: {reader[6]}, GearType: {reader[7]}, ModelID: {reader[3]}");
}
