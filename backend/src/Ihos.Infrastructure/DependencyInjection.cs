using Ihos.Application.Common.Interfaces;
using Ihos.Application.Import.Adapters;
using Ihos.Application.Import.Services;
using Ihos.Application.Providers;
using Ihos.Application.Sync;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Infrastructure.BackgroundServices;
using Ihos.Infrastructure.Caching;
using Ihos.Infrastructure.Import;
using Ihos.Infrastructure.Import.Adapters;
using Ihos.Infrastructure.Persistence;
using Ihos.Infrastructure.Providers.Mti;
using Ihos.Infrastructure.Providers.Viriyah;
using Ihos.Infrastructure.Reporting;
using Ihos.Infrastructure.Repositories;
using Ihos.Infrastructure.Resilience;
using Ihos.Infrastructure.Services;
using Ihos.Infrastructure.Sync;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Ihos.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddHttpContextAccessor();

        services.AddScoped<ICurrentUserService, HttpContextCurrentUserService>();

        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

        services.AddScoped<IAuditLogRepository, AuditLogRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();

        // Import module repositories
        services.AddScoped<IInsurancePlanRepository, InsurancePlanRepository>();
        services.AddScoped<IInsuranceCompanyRepository, InsuranceCompanyRepository>();
        services.AddScoped<IVehicleModelRepository, VehicleModelRepository>();
        services.AddScoped<IVehicleModelMappingRepository, VehicleModelMappingRepository>();
        services.AddScoped<IPlanTypeMappingRepository, PlanTypeMappingRepository>();
        services.AddScoped<IImportBatchRepository, ImportBatchRepository>();
        services.AddScoped<IImportRecordRepository, ImportRecordRepository>();

        // Import module services
        services.AddScoped<MappingResolverService>();
        services.AddScoped<IExcelImportParser, ExcelImportParser>();
        services.AddScoped<ICsvImportParser, CsvImportParser>();
        services.AddScoped<IVehicleMasterFileParser, ViriyahVehicleMasterParser>();

        // Company import adapters — add one entry per supported insurance company.
        // Customers requiring a new company must request a new adapter to be developed.
        services.AddScoped<ICompanyImportAdapter, BangkokInsuranceAdapter>();
        services.AddScoped<ICompanyImportAdapter, MuangThaiLifeAdapter>();
        services.AddScoped<ICompanyImportAdapter, ViriyahInsuranceAdapter>();
        services.AddScoped<ICompanyImportAdapter, AllianzInsuranceAdapter>();
        services.AddScoped<ICompanyAdapterRegistry, CompanyAdapterRegistry>();

        // Reporting module
        services.AddScoped<IReportingRepository, ReportingRepository>();

        // Quotation + Reporting module
        services.AddScoped<IQuotationRepository, QuotationRepository>();
        services.AddScoped<ICustomerRepository, CustomerRepository>();
        services.AddHttpClient("jasper");
        services.AddScoped<IJasperReportsClient, JasperReportsClient>();
        services.AddScoped<ReportExportService>();

        services.AddScoped<IPasswordHasher, Argon2idPasswordHasher>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IEmailService, MailKitEmailService>();
        services.AddSingleton<IAppSettings, AppSettings>();

        // ── Multi-provider integration (feature 002) ─────────────────────────
        // Cache: in-memory distributed cache for SWR quote caching (research.md §3).
        // Swap to Redis later by replacing this registration; QuoteCacheService stays unchanged.
        services.AddDistributedMemoryCache();

        // Per-provider resilience pipelines (timeout + breaker + retry).
        services.AddSingleton<PollyPolicyFactory>();

        // SWR cache wrapper used by API-sourced provider adapters.
        services.AddSingleton<QuoteCacheService>();

        // Provider abstraction: registry resolves DI-registered providers by ShortCode against
        // the active InsuranceCompany rows. Adapters for MTI/Viriyah land in US1 (Phase 3).
        services.AddScoped<IProviderRegistry, ProviderRegistry>();

        // ImportQuoteProvider is NOT registered in DI directly — each instance is bound to a
        // specific InsuranceCompany row. ProviderRegistry constructs one on the fly for every
        // active Import-source company (i.e. companies with DataSource = Import that have no
        // API IInsurerQuoteProvider registered). See ProviderRegistry.GetActiveQuoteProvidersAsync.

        // ── MTI provider (Muang Thai Insurance) — feature 002 ─────────────────
        services.Configure<MtiOptions>(configuration.GetSection(MtiOptions.SectionName));
        services.AddHttpClient<MtiHttpClient>()
            .AddStandardResilienceHandler(o =>
            {
                o.AttemptTimeout.Timeout = TimeSpan.FromSeconds(10);
                o.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(20);
                o.CircuitBreaker.FailureRatio = 0.5;
                o.CircuitBreaker.MinimumThroughput = 5;
                o.CircuitBreaker.BreakDuration = TimeSpan.FromSeconds(60);
                o.Retry.MaxRetryAttempts = 1;
            });
        services.AddScoped<IInsurerQuoteProvider, MtiApiQuoteProvider>();
        services.AddScoped<IVehicleMasterSyncer, MtiVehicleMasterSyncer>();

        // ── Viriyah provider — feature 002 ─────────────────────────────────────
        services.Configure<ViriyahOptions>(configuration.GetSection(ViriyahOptions.SectionName));
        services.Configure<ViriyahMasterOptions>(
            configuration.GetSection(ViriyahMasterOptions.SectionName));
        services.AddSingleton<ViriyahTokenCache>();
        services.AddHttpClient(ViriyahTokenCache.TokenHttpClientName);
        services.AddHttpClient<ViriyahHttpClient>()
            .AddStandardResilienceHandler(o =>
            {
                o.AttemptTimeout.Timeout = TimeSpan.FromSeconds(10);
                o.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(20);
                o.CircuitBreaker.FailureRatio = 0.5;
                o.CircuitBreaker.MinimumThroughput = 5;
                o.CircuitBreaker.BreakDuration = TimeSpan.FromSeconds(60);
                o.Retry.MaxRetryAttempts = 1;
            });
        services.AddScoped<IInsurerQuoteProvider, ViriyahVmiQuoteProvider>();
        services.AddScoped<IVehicleMasterSyncer, ViriyahCsvMasterImporter>();

        // ── Sync orchestration + audit reader (Phase 5 US3) ────────────────────
        services.AddSingleton<ISyncOrchestrator, SyncOrchestrator>();
        services.AddScoped<IVehicleSyncLogReader, VehicleSyncLogReader>();

        // ── Scheduled daily sync (Phase 6 US4) ─────────────────────────────────
        services.Configure<SyncScheduleOptions>(
            configuration.GetSection(SyncScheduleOptions.SectionName));
        services.AddHostedService<VehicleSyncBackgroundService>();

        // ── Recover orphan Running rows after process restart (Phase 7+) ───────
        services.AddHostedService<OrphanSyncRecoveryService>();

        return services;
    }
}
