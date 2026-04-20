using Ihos.Application.Common.Interfaces;
using Ihos.Application.Import.Adapters;
using Ihos.Application.Import.Services;
using Ihos.Infrastructure.Import;
using Ihos.Infrastructure.Import.Adapters;
using Ihos.Infrastructure.Persistence;
using Ihos.Infrastructure.Reporting;
using Ihos.Infrastructure.Repositories;
using Ihos.Infrastructure.Services;
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
        services.AddHttpClient("jasper");
        services.AddScoped<IJasperReportsClient, JasperReportsClient>();
        services.AddScoped<ReportExportService>();

        services.AddScoped<IPasswordHasher, Argon2idPasswordHasher>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IEmailService, MailKitEmailService>();
        services.AddSingleton<IAppSettings, AppSettings>();

        return services;
    }
}
