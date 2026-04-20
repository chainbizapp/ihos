using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;

namespace Ihos.Application.Quotation.Queries;

public record GetQuotationPdfQuery(Guid QuotationId) : IRequest<QuotationPdfResult?>;

public record QuotationPdfResult(byte[] PdfBytes, string FileName);

public class GetQuotationPdfQueryHandler : IRequestHandler<GetQuotationPdfQuery, QuotationPdfResult?>
{
    private readonly IQuotationRepository _quotations;
    private readonly IJasperReportsClient _jasper;

    public GetQuotationPdfQueryHandler(IQuotationRepository quotations, IJasperReportsClient jasper)
    {
        _quotations = quotations;
        _jasper = jasper;
    }

    public async Task<QuotationPdfResult?> Handle(GetQuotationPdfQuery request, CancellationToken ct)
    {
        var quotation = await _quotations.GetByIdAsync(request.QuotationId, ct);
        if (quotation == null) return null;

        // The JRXML template connects directly to DB using param1 as the quotation UUID.
        var parameters = new Dictionary<string, string>
        {
            ["srcFile"] = "quotation",
            ["param1"] = quotation.Id.ToString()
        };

        var pdfBytes = await _jasper.GenerateQuotationPdfAsync(parameters, ct);
        var fileName = $"quotation_{quotation.Id.ToString("N")[..8].ToUpper()}.pdf";

        return new QuotationPdfResult(pdfBytes, fileName);
    }
}
