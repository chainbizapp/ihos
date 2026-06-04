using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;

namespace Ihos.Application.Brands.Queries;

/// <summary>
/// Lists brand aliases for the admin management page, optionally filtered by provider
/// and/or verification state. Also returns the list of provider codes for the filter UI.
/// </summary>
public record GetBrandAliasesQuery(string? ProviderCode = null, bool? VerifiedOnly = null)
    : IRequest<BrandAliasListResult>;

public record BrandAliasListResult(
    IReadOnlyList<BrandAliasDto> Items,
    IReadOnlyList<string> ProviderCodes);

public record BrandAliasDto(
    Guid Id,
    string ProviderCode,
    string RawValue,
    Guid? CanonicalMakeId,
    string? CanonicalMakeName,
    string Source,            // AiFuzzy | AiGuess | Human | Pending
    int? Confidence,
    bool IsVerified,
    DateTime UpdatedAt);

public class GetBrandAliasesQueryHandler
    : IRequestHandler<GetBrandAliasesQuery, BrandAliasListResult>
{
    private readonly IBrandAliasRepository _repo;
    public GetBrandAliasesQueryHandler(IBrandAliasRepository repo) => _repo = repo;

    public async Task<BrandAliasListResult> Handle(GetBrandAliasesQuery request, CancellationToken ct)
    {
        var rows = await _repo.GetAllAsync(request.ProviderCode, request.VerifiedOnly, ct);
        var providers = await _repo.GetProviderCodesAsync(ct);

        var dtos = rows.Select(a => new BrandAliasDto(
            a.Id, a.ProviderCode, a.RawValue,
            a.CanonicalMakeId, a.CanonicalMake?.Name,
            a.Source.ToString(), a.Confidence, a.IsVerified, a.UpdatedAt)).ToList();

        return new BrandAliasListResult(dtos, providers);
    }
}
