using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Ihos.Infrastructure.Persistence;

/// <summary>
/// Runs EF Core migrations and seeds the bootstrap Admin account on first startup.
/// Call from Program.cs after building the app.
/// </summary>
public static class DbInitializer
{
    public static async Task InitializeAsync(
        ApplicationDbContext db,
        IPasswordHasher hasher,
        IConfiguration configuration,
        ILogger logger)
    {
        // Apply any pending migrations
        await db.Database.MigrateAsync();

        var defaultPassword = configuration["Bootstrap:AdminPassword"] ?? "Admin@1234!";

        var existingAdmin = await db.Users.FirstOrDefaultAsync(u => u.Email == "admin@ihos.local");
        if (existingAdmin != null)
        {
            // Auto-heal the broken hash from the previous bug
            existingAdmin.PasswordHash = hasher.Hash(defaultPassword);
            await db.SaveChangesAsync();
        }
        else
        {
            logger.LogInformation("Seeding bootstrap admin user (admin@ihos.local)...");

            var admin = new User
            {
                Email        = "admin@ihos.local",
                PasswordHash = hasher.Hash(defaultPassword),
                FullName     = "System Administrator",
                Role         = UserRole.Admin,
                Status       = UserStatus.Active
            };

            await db.Users.AddAsync(admin);
            await db.SaveChangesAsync();

            logger.LogInformation("Bootstrap admin seeded. Email: admin@ihos.local | Password: {Pwd}", defaultPassword);
        }

        // Always run — seeds are skipped internally if data already exists
        await SeedCompaniesAsync(db, logger);
    }

    private static async Task SeedCompaniesAsync(ApplicationDbContext db, ILogger logger)
    {
        if (await db.InsuranceCompanies.AnyAsync())
            return;

        logger.LogInformation("Seeding insurance companies...");

        var companies = new[]
        {
            new InsuranceCompany { Id = new Guid("11111111-0000-0000-0000-000000000001"), Name = "Bangkok Insurance",                 ShortCode = "BKI", IsActive = true },
            new InsuranceCompany { Id = new Guid("11111111-0000-0000-0000-000000000002"), Name = "Muang Thai Life",                   ShortCode = "MTL", IsActive = true },
            new InsuranceCompany { Id = new Guid("11111111-0000-0000-0000-000000000003"), Name = "Viriyah Insurance",                 ShortCode = "VRY", IsActive = true },
            new InsuranceCompany { Id = new Guid("11111111-0000-0000-0000-000000000004"), Name = "Allianz Ayudhya General Insurance", ShortCode = "ALZ", IsActive = true },
        };

        await db.InsuranceCompanies.AddRangeAsync(companies);
        await db.SaveChangesAsync();

        logger.LogInformation("Insurance companies seeded ({Count}).", companies.Length);
    }
}
