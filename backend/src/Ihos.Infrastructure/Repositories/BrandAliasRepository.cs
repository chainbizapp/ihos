using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Ihos.Infrastructure.Repositories;

public sealed class BrandAliasRepository : IBrandAliasRepository
{
    private readonly ApplicationDbContext _db;
    public BrandAliasRepository(ApplicationDbContext db) => _db = db;

    public Task<ProviderBrandAlias?> FindVerifiedAsync(
        string providerCode, string rawValue, CancellationToken ct = default) =>
        _db.ProviderBrandAliases
            .Include(a => a.CanonicalMake)
            .FirstOrDefaultAsync(a =>
                a.ProviderCode == providerCode
                && a.RawValue.ToUpper() == rawValue.ToUpper()
                && a.IsVerified
                && a.CanonicalMakeId != null
                && !a.IsDeleted, ct);

    public async Task<IReadOnlyList<ProviderBrandAlias>> GetByProviderAsync(
        string providerCode, CancellationToken ct = default) =>
        await _db.ProviderBrandAliases
            .Include(a => a.CanonicalMake)
            .Where(a => a.ProviderCode == providerCode && !a.IsDeleted)
            .OrderBy(a => a.RawValue)
            .ToListAsync(ct);

    public Task<ProviderBrandAlias?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        _db.ProviderBrandAliases
            .Include(a => a.CanonicalMake)
            .FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted, ct);

    public async Task<IReadOnlyList<ProviderBrandAlias>> GetAllAsync(
        string? providerCode, bool? verifiedOnly, CancellationToken ct = default)
    {
        var q = _db.ProviderBrandAliases
            .Include(a => a.CanonicalMake)
            .Where(a => !a.IsDeleted);
        if (!string.IsNullOrWhiteSpace(providerCode))
            q = q.Where(a => a.ProviderCode == providerCode);
        if (verifiedOnly == true)
            q = q.Where(a => a.IsVerified);
        return await q
            .OrderBy(a => a.ProviderCode).ThenBy(a => a.RawValue)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<string>> GetProviderCodesAsync(CancellationToken ct = default) =>
        await _db.ProviderBrandAliases
            .Where(a => !a.IsDeleted)
            .Select(a => a.ProviderCode)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<VehicleMake>> GetAllMakesAsync(CancellationToken ct = default) =>
        await _db.VehicleMakes
            .AsNoTracking()
            .Where(m => !m.IsDeleted)
            .ToListAsync(ct);

    public async Task AddAsync(ProviderBrandAlias alias, CancellationToken ct = default) =>
        await _db.ProviderBrandAliases.AddAsync(alias, ct);

    public Task SaveChangesAsync(CancellationToken ct = default) => _db.SaveChangesAsync(ct);
}
