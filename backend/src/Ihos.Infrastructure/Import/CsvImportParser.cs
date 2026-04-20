using CsvHelper;
using CsvHelper.Configuration;
using Ihos.Application.Common.Interfaces;
using Ihos.Application.Import.Services;
using System.Globalization;

namespace Ihos.Infrastructure.Import;

public class CsvImportParser : ICsvImportParser
{
    public ParseResult Parse(Stream stream)
    {
        var errors = new List<ParseError>();
        var rows = new List<Dictionary<string, string>>();

        try
        {
            var config = new CsvConfiguration(CultureInfo.InvariantCulture)
            {
                HasHeaderRecord = true,
                MissingFieldFound = null,
                BadDataFound = context =>
                {
                    errors.Add(new ParseError(
                        context.Context.Parser.Row,
                        "Unknown",
                        $"Bad data: {context.RawRecord?.Trim()}"));
                }
            };

            using var reader = new StreamReader(stream, leaveOpen: true);
            using var csv = new CsvReader(reader, config);

            csv.Read();
            csv.ReadHeader();
            var headers = csv.HeaderRecord ?? [];

            while (csv.Read())
            {
                var rowData = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                foreach (var header in headers)
                {
                    rowData[header] = csv.GetField(header) ?? string.Empty;
                }
                rows.Add(rowData);
            }

            if (errors.Count > 0)
                return ParseResult.Fail(errors);

            if (rows.Count == 0)
                return ParseResult.Fail([new ParseError(1, "File", "CSV file contains no data rows.")]);

            return ParseResult.Ok(rows);
        }
        catch (Exception ex)
        {
            return ParseResult.Fail([new ParseError(0, "File", $"Failed to parse CSV file: {ex.Message}")]);
        }
    }
}
