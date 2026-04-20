namespace Ihos.Application.Common.Interfaces;

public interface IJasperReportsClient
{
    Task<byte[]> GenerateQuotationPdfAsync(
        Dictionary<string, string> parameters,
        CancellationToken ct = default);
}
