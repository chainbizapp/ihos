using Ihos.Application.Import.Adapters;

namespace Ihos.Infrastructure.Import.Adapters;

/// <summary>
/// Builds a lookup from all registered ICompanyImportAdapter implementations.
/// Inject all adapters via IEnumerable — DI takes care of discovering them.
/// </summary>
public sealed class CompanyAdapterRegistry : ICompanyAdapterRegistry
{
    private readonly IReadOnlyDictionary<Guid, ICompanyImportAdapter> _map;
    private readonly IReadOnlyList<ICompanyImportAdapter> _all;

    public CompanyAdapterRegistry(IEnumerable<ICompanyImportAdapter> adapters)
    {
        _all = adapters.ToList();
        _map = _all.ToDictionary(a => a.CompanyId);
    }

    public ICompanyImportAdapter? GetAdapter(Guid companyId) =>
        _map.TryGetValue(companyId, out var adapter) ? adapter : null;

    public IReadOnlyList<ICompanyImportAdapter> GetAll() => _all;
}
