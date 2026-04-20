using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Text.Json;
using Testcontainers.PostgreSql;

namespace Ihos.API.IntegrationTests.Search;

public class SearchPlansTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    // Remove existing DB context
                    var descriptor = services.SingleOrDefault(
                        d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
                    if (descriptor != null) services.Remove(descriptor);

                    services.AddDbContext<ApplicationDbContext>(options =>
                        options.UseNpgsql(_postgres.GetConnectionString()));
                });
            });

        _client = _factory.CreateClient();

        // Run migrations
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.Database.MigrateAsync();

        // Seed test data
        await SeedTestDataAsync(db);
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    private static async Task SeedTestDataAsync(ApplicationDbContext db)
    {
        var company = new InsuranceCompany { Name = "Test Insurance", ShortCode = "TEST", IsActive = true };
        await db.InsuranceCompanies.AddAsync(company);

        var make = new VehicleMake { Name = "Toyota" };
        await db.VehicleMakes.AddAsync(make);

        var model = new VehicleModel { MakeId = make.Id, Name = "Corolla" };
        await db.VehicleModels.AddAsync(model);

        await db.SaveChangesAsync();

        // Plan eligible for age 5 (productionYear = current - 5)
        var plan1 = new InsurancePlan
        {
            CompanyId = company.Id,
            VehicleModelId = model.Id,
            PlanType = PlanType.Type1,
            RepairType = RepairType.Garage,
            MinYear = 1,
            MaxYear = 7,
            SumInsured = 800_000m,
            PremiumTotal = 18_500m,
            ExcessAmount = 2_000m,
            CoverageDetails = "{}",
            IsPublished = true
        };

        // Plan NOT eligible for age 5 (minYear > 5)
        var plan2 = new InsurancePlan
        {
            CompanyId = company.Id,
            VehicleModelId = model.Id,
            PlanType = PlanType.Type1,
            RepairType = RepairType.Garage,
            MinYear = 8,
            MaxYear = 15,
            SumInsured = 600_000m,
            PremiumTotal = 12_000m,
            ExcessAmount = 3_000m,
            CoverageDetails = "{}",
            IsPublished = true
        };

        // Same as plan1 but higher premium (for sort test)
        var plan3 = new InsurancePlan
        {
            CompanyId = company.Id,
            VehicleModelId = model.Id,
            PlanType = PlanType.Type1,
            RepairType = RepairType.Garage,
            MinYear = 1,
            MaxYear = 7,
            SumInsured = 700_000m,
            PremiumTotal = 16_000m,
            ExcessAmount = 1_000m,
            CoverageDetails = "{}",
            IsPublished = true
        };

        // Unpublished plan — must NOT appear in results
        var plan4 = new InsurancePlan
        {
            CompanyId = company.Id,
            VehicleModelId = model.Id,
            PlanType = PlanType.Type1,
            RepairType = RepairType.Garage,
            MinYear = 1,
            MaxYear = 7,
            SumInsured = 900_000m,
            PremiumTotal = 20_000m,
            ExcessAmount = 0m,
            CoverageDetails = "{}",
            IsPublished = false
        };

        await db.InsurancePlans.AddRangeAsync(plan1, plan2, plan3, plan4);
        await db.SaveChangesAsync();

        // Store model id for use in tests (inject into a static for simplicity)
        TestData.CompanyId = company.Id;
        TestData.ModelId = model.Id;
    }

    [Fact]
    public async Task Search_ReturnsResults_WithinTwoSeconds()
    {
        var productionYear = DateTime.UtcNow.Year - 5; // age = 5, eligible for minYear=1 maxYear=7
        var url = $"/api/plans/search?vehicleModelId={TestData.ModelId}&productionYear={productionYear}&planType=Type1&repairType=Garage";

        var start = DateTime.UtcNow;
        var response = await _client.GetAsync(url);
        var elapsed = (DateTime.UtcNow - start).TotalMilliseconds;

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(elapsed < 2000, $"Request took {elapsed}ms, expected < 2000ms");
    }

    [Fact]
    public async Task Search_YearFilter_ExcludesIneligiblePlans()
    {
        var productionYear = DateTime.UtcNow.Year - 5; // age = 5
        var url = $"/api/plans/search?vehicleModelId={TestData.ModelId}&productionYear={productionYear}&planType=Type1&repairType=Garage";

        var response = await _client.GetAsync(url);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<SearchResult>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.NotNull(result);
        // plan1 and plan3 match (age 5 within 1-7), plan2 does NOT (min 8-15), plan4 is unpublished
        Assert.Equal(2, result!.TotalCount);
        Assert.All(result.Items, item =>
        {
            Assert.True(item.MinYear <= 5 && item.MaxYear >= 5,
                $"Plan with minYear={item.MinYear} maxYear={item.MaxYear} should not have been returned for age 5");
        });
    }

    [Fact]
    public async Task Search_NoResults_ReturnsEmptyArray()
    {
        var productionYear = DateTime.UtcNow.Year - 20; // age = 20, no plans cover this
        var url = $"/api/plans/search?vehicleModelId={TestData.ModelId}&productionYear={productionYear}&planType=Type1&repairType=Garage";

        var response = await _client.GetAsync(url);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<SearchResult>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.NotNull(result);
        Assert.Empty(result!.Items);
        Assert.Equal(0, result.TotalCount);
    }

    [Fact]
    public async Task Search_Page2_ReturnsCorrectOffset()
    {
        var productionYear = DateTime.UtcNow.Year - 5; // age = 5 → 2 matching plans
        var url = $"/api/plans/search?vehicleModelId={TestData.ModelId}&productionYear={productionYear}&planType=Type1&repairType=Garage&page=2&pageSize=1";

        var response = await _client.GetAsync(url);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<SearchResult>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.NotNull(result);
        Assert.Equal(2, result!.TotalCount);  // total is still 2
        Assert.Single(result.Items);          // page 2 with pageSize 1 → 1 item
    }

    private record SearchResult(
        List<PlanItem> Items,
        int TotalCount,
        int Page,
        int PageSize
    );

    private record PlanItem(
        Guid Id,
        string CompanyName,
        string PlanType,
        string RepairType,
        string VehicleModel,
        string VehicleMake,
        int MinYear,
        int MaxYear,
        decimal SumInsured,
        decimal PremiumTotal,
        decimal ExcessAmount
    );
}

internal static class TestData
{
    public static Guid CompanyId { get; set; }
    public static Guid ModelId { get; set; }
}
