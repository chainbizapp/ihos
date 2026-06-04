using Ihos.Application.Brands;
using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;

namespace Ihos.Application.Tests.Brands;

/// <summary>
/// Unit tests for the three-tier brand resolver. Uses a hand-rolled fake repository — no DB,
/// no EF Core. This is exactly the payoff of keeping the resolver in the Application layer:
/// it's pure logic and trivially testable.
/// </summary>
public class BrandAliasResolverTests
{
    private static VehicleMake Make(string name) => new() { Id = Guid.NewGuid(), Name = name };

    // ── Fake repo ────────────────────────────────────────────────────────────────
    private sealed class FakeRepo : IBrandAliasRepository
    {
        public List<VehicleMake> Makes { get; } = new();
        public List<ProviderBrandAlias> Aliases { get; } = new();
        public List<ProviderBrandAlias> Added { get; } = new();

        public Task<ProviderBrandAlias?> FindVerifiedAsync(string p, string raw, CancellationToken ct = default)
            => Task.FromResult(Aliases.FirstOrDefault(a =>
                a.ProviderCode == p && a.RawValue.Equals(raw, StringComparison.OrdinalIgnoreCase)
                && a.IsVerified && a.CanonicalMakeId != null));

        public Task<IReadOnlyList<ProviderBrandAlias>> GetByProviderAsync(string p, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<ProviderBrandAlias>>(Aliases.Where(a => a.ProviderCode == p).ToList());

        public Task<ProviderBrandAlias?> GetByIdAsync(Guid id, CancellationToken ct = default)
            => Task.FromResult(Aliases.FirstOrDefault(a => a.Id == id));

        public Task<IReadOnlyList<ProviderBrandAlias>> GetAllAsync(
            string? p, bool? verifiedOnly, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<ProviderBrandAlias>>(Aliases
                .Where(a => p == null || a.ProviderCode == p)
                .Where(a => verifiedOnly != true || a.IsVerified)
                .ToList());

        public Task<IReadOnlyList<string>> GetProviderCodesAsync(CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<string>>(Aliases.Select(a => a.ProviderCode).Distinct().ToList());

        public Task<IReadOnlyList<VehicleMake>> GetAllMakesAsync(CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<VehicleMake>>(Makes);

        public Task AddAsync(ProviderBrandAlias a, CancellationToken ct = default) { Added.Add(a); return Task.CompletedTask; }
        public Task SaveChangesAsync(CancellationToken ct = default) => Task.CompletedTask;
    }

    [Fact]
    public async Task VerifiedAlias_TakesPriority_AndIsUsable()
    {
        var repo = new FakeRepo();
        var isuzu = Make("Isuzu");
        repo.Makes.Add(isuzu);
        repo.Aliases.Add(new ProviderBrandAlias
        {
            ProviderCode = "MTI", RawValue = "ISUZ",
            CanonicalMakeId = isuzu.Id, CanonicalMake = isuzu,
            Source = AliasSource.Human, IsVerified = true,
        });

        var r = await new BrandAliasResolver(repo).ResolveAsync("MTI", "ISUZ");

        Assert.Equal(isuzu.Id, r.CanonicalMakeId);
        Assert.Equal(AliasSource.Human, r.Source);
        Assert.True(r.IsUsable);
    }

    [Fact]
    public async Task Fuzzy_LongName_OneEdit_IsUsable()
    {
        // "TRIUMP" -> "Triumph" : distance 1 on a 7-char name → AiFuzzy, usable.
        var repo = new FakeRepo();
        repo.Makes.Add(Make("Triumph"));

        var r = await new BrandAliasResolver(repo).ResolveAsync("MTI", "TRIUMP");

        Assert.NotNull(r.CanonicalMakeId);
        Assert.Equal("Triumph", r.CanonicalMakeName);
        Assert.Equal(AliasSource.AiFuzzy, r.Source);
        Assert.True(r.IsUsable);
    }

    [Fact]
    public async Task Fuzzy_NormalizesPunctuation()
    {
        // "ROLLS-ROYCE" vs "Rolls Royce" : equal after normalize → distance 0.
        var repo = new FakeRepo();
        repo.Makes.Add(Make("Rolls Royce"));

        var r = await new BrandAliasResolver(repo).ResolveAsync("MTI", "ROLLS-ROYCE");

        Assert.NotNull(r.CanonicalMakeId);
        Assert.Equal(100, r.Confidence);
        Assert.True(r.IsUsable);
    }

    [Fact]
    public async Task Fuzzy_ShortName_TwoEdits_IsRejected()
    {
        // "TR" vs "AC" : distance 2 but the name is short (≤4) → guard rejects → Pending.
        // This is the critical false-positive guard ("SMART"->"SEAT" class of error).
        var repo = new FakeRepo();
        repo.Makes.Add(Make("AC"));

        var r = await new BrandAliasResolver(repo).ResolveAsync("MTI", "TR");

        Assert.Null(r.CanonicalMakeId);
        Assert.Equal(AliasSource.Pending, r.Source);
        Assert.False(r.IsUsable);
    }

    [Fact]
    public async Task Fuzzy_LongName_TwoEdits_IsGuess_NotUsable()
    {
        // distance 2 on a long name → AiGuess (suggested) but NOT usable until verified.
        var repo = new FakeRepo();
        repo.Makes.Add(Make("Reliant"));     // "VALIANT" vs "Reliant" ~ distance 2

        var r = await new BrandAliasResolver(repo).ResolveAsync("MTI", "VALIANT");

        Assert.NotNull(r.CanonicalMakeId);
        Assert.Equal(AliasSource.AiGuess, r.Source);
        Assert.False(r.IsUsable);            // guess must wait for human review
    }

    [Fact]
    public async Task NoCloseMatch_ReturnsPending()
    {
        var repo = new FakeRepo();
        repo.Makes.Add(Make("Toyota"));
        repo.Makes.Add(Make("Honda"));

        var r = await new BrandAliasResolver(repo).ResolveAsync("MTI", "Lamborghini");

        Assert.Null(r.CanonicalMakeId);
        Assert.Equal(AliasSource.Pending, r.Source);
    }

    [Fact]
    public async Task EmptyInput_ReturnsPending()
    {
        var r = await new BrandAliasResolver(new FakeRepo()).ResolveAsync("MTI", "   ");
        Assert.Equal(AliasSource.Pending, r.Source);
        Assert.False(r.IsUsable);
    }
}
