using Ihos.Application.Import.Services;

namespace Ihos.Application.Common.Interfaces;

public interface IExcelImportParser
{
    ParseResult Parse(Stream stream);
}

public interface ICsvImportParser
{
    ParseResult Parse(Stream stream);
}
