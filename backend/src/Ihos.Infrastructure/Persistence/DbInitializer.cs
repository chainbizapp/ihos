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
            return;
        }

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
}
