using ClosedXML.Excel;
using Ihos.Application.Common.Interfaces;
using Ihos.Application.Import.Services;

namespace Ihos.Infrastructure.Import;

public class ExcelImportParser : IExcelImportParser
{
    public ParseResult Parse(Stream stream)
    {
        var errors = new List<ParseError>();
        var rows = new List<Dictionary<string, string>>();

        try
        {
            using var workbook = new XLWorkbook(stream);
            var worksheet = workbook.Worksheets.First();
            var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 1;
            var lastCol = worksheet.LastColumnUsed()?.ColumnNumber() ?? 1;

            if (lastRow < 2)
                return ParseResult.Fail([new ParseError(1, "Header", "Worksheet has no data rows.")]);

            // Read headers from row 1
            var headers = new List<string>();
            for (int col = 1; col <= lastCol; col++)
            {
                var header = worksheet.Cell(1, col).GetString().Trim();
                headers.Add(string.IsNullOrEmpty(header) ? $"Column{col}" : header);
            }

            // Read data rows starting from row 2
            for (int row = 2; row <= lastRow; row++)
            {
                // Skip entirely blank rows
                bool allBlank = true;
                for (int col = 1; col <= lastCol; col++)
                {
                    if (!string.IsNullOrWhiteSpace(worksheet.Cell(row, col).GetString()))
                    {
                        allBlank = false;
                        break;
                    }
                }
                if (allBlank) continue;

                var rowData = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                for (int col = 1; col <= lastCol; col++)
                {
                    var cellValue = worksheet.Cell(row, col).GetString().Trim();
                    var header = headers[col - 1];
                    rowData[header] = cellValue;
                }
                rows.Add(rowData);
            }

            if (errors.Count > 0)
                return ParseResult.Fail(errors);

            return ParseResult.Ok(rows);
        }
        catch (Exception ex)
        {
            return ParseResult.Fail([new ParseError(0, "File", $"Failed to parse Excel file: {ex.Message}")]);
        }
    }
}
