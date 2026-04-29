using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Common;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Ihos.Infrastructure.Persistence;

public class ApplicationDbContext : DbContext
{
    private readonly ICurrentUserService _currentUserService;

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        ICurrentUserService currentUserService)
        : base(options)
    {
        _currentUserService = currentUserService;
    }

    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    // Import module
    public DbSet<InsurancePlan> InsurancePlans => Set<InsurancePlan>();
    public DbSet<InsuranceCompany> InsuranceCompanies => Set<InsuranceCompany>();
    public DbSet<VehicleMake> VehicleMakes => Set<VehicleMake>();
    public DbSet<VehicleModel> VehicleModels => Set<VehicleModel>();
    public DbSet<VehicleModelMapping> VehicleModelMappings => Set<VehicleModelMapping>();
    public DbSet<PlanTypeMapping> PlanTypeMappings => Set<PlanTypeMapping>();
    public DbSet<ImportBatch> ImportBatches => Set<ImportBatch>();
    public DbSet<ImportRecord> ImportRecords => Set<ImportRecord>();

    // Market value
    public DbSet<VehicleMarketValue> VehicleMarketValues => Set<VehicleMarketValue>();

    // Quotation module
    public DbSet<Quotation> Quotations => Set<Quotation>();
    public DbSet<Customer> Customers => Set<Customer>();

    // Reference data
    public DbSet<Province> Provinces => Set<Province>();
    public DbSet<RegionGroupMapping> RegionGroupMappings => Set<RegionGroupMapping>();

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = now;
                entry.Entity.UpdatedAt = now;
                entry.Entity.CreatedBy ??= _currentUserService.UserId;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
            }
        }

        return await base.SaveChangesAsync(cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("audit_logs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.ActionType).HasMaxLength(100).IsRequired();
            entity.Property(e => e.EntityType).HasMaxLength(100);
            entity.Property(e => e.Outcome).HasMaxLength(20).IsRequired();
            entity.Property(e => e.IpAddress).HasMaxLength(45);
            entity.Property(e => e.Metadata).HasColumnType("jsonb");
            entity.Property(e => e.OccurredAt).HasDefaultValueSql("now()");

            entity.HasIndex(e => e.ActorId);
            entity.HasIndex(e => e.ActionType);
            entity.HasIndex(e => e.OccurredAt);
            entity.HasIndex(new[] { nameof(AuditLog.EntityType), nameof(AuditLog.EntityId) });
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Email).HasMaxLength(255).IsRequired();
            entity.Property(e => e.FullName).HasMaxLength(255).IsRequired();
            entity.Property(e => e.PasswordHash).HasMaxLength(512);
            entity.Property(e => e.Role).HasConversion<string>().HasMaxLength(50).IsRequired();
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(50).IsRequired();
            entity.Property(e => e.InviteTokenHash).HasMaxLength(512);

            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.Role);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("refresh_tokens");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.TokenHash).HasMaxLength(512).IsRequired();

            entity.HasOne(e => e.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.TokenHash);
            entity.HasIndex(new[] { nameof(RefreshToken.UserId), nameof(RefreshToken.RevokedAt) });
        });

        modelBuilder.Entity<InsuranceCompany>(entity =>
        {
            entity.ToTable("insurance_companies");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Name).HasMaxLength(255).IsRequired();
            entity.Property(e => e.ShortCode).HasMaxLength(20).IsRequired();
            entity.HasIndex(e => e.Name).IsUnique();
            entity.HasIndex(e => e.ShortCode).IsUnique();
        });

        modelBuilder.Entity<VehicleMake>(entity =>
        {
            entity.ToTable("vehicle_makes");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
            entity.HasIndex(e => e.Name).IsUnique();
        });

        modelBuilder.Entity<VehicleModel>(entity =>
        {
            entity.ToTable("vehicle_models");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Name).HasMaxLength(200).IsRequired();
            entity.Property(e => e.SubModel).HasMaxLength(200);
            entity.Property(e => e.EngineCC).HasMaxLength(50);

            entity.HasOne(e => e.Make)
                .WithMany(m => m.Models)
                .HasForeignKey(e => e.MakeId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => e.MakeId);
            entity.HasIndex(new[] { nameof(VehicleModel.MakeId), nameof(VehicleModel.Name), nameof(VehicleModel.SubModel), nameof(VehicleModel.GearType), nameof(VehicleModel.EngineCC) }).IsUnique();
        });

        modelBuilder.Entity<VehicleModelMapping>(entity =>
        {
            entity.ToTable("vehicle_model_mappings");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.RawName).HasMaxLength(500).IsRequired();

            entity.HasOne(e => e.Company)
                .WithMany(c => c.VehicleModelMappings)
                .HasForeignKey(e => e.CompanyId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.CanonicalModel)
                .WithMany(m => m.Mappings)
                .HasForeignKey(e => e.CanonicalModelId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => e.CompanyId);
            entity.HasIndex(e => e.CanonicalModelId);
            entity.HasIndex(new[] { nameof(VehicleModelMapping.CompanyId), nameof(VehicleModelMapping.RawName) }).IsUnique();
        });

        modelBuilder.Entity<PlanTypeMapping>(entity =>
        {
            entity.ToTable("plan_type_mappings");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.RawName).HasMaxLength(500).IsRequired();
            entity.Property(e => e.CanonicalPlanType).HasConversion<string>().HasMaxLength(10).IsRequired();

            entity.HasOne(e => e.Company)
                .WithMany(c => c.PlanTypeMappings)
                .HasForeignKey(e => e.CompanyId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(new[] { nameof(PlanTypeMapping.CompanyId), nameof(PlanTypeMapping.RawName) }).IsUnique();
        });

        modelBuilder.Entity<ImportBatch>(entity =>
        {
            entity.ToTable("import_batches");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.SourceFileName).HasMaxLength(500).IsRequired();
            entity.Property(e => e.SourceFilePath).HasMaxLength(1000).IsRequired();
            entity.Property(e => e.Status).HasConversion<string>().HasMaxLength(50).IsRequired();
            entity.Property(e => e.FailureReason).HasColumnType("text");

            entity.HasOne(e => e.Company)
                .WithMany(c => c.ImportBatches)
                .HasForeignKey(e => e.CompanyId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => e.CompanyId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.UploadedBy);
            entity.HasIndex(e => e.UploadedAt);
        });

        modelBuilder.Entity<VehicleMarketValue>(entity =>
        {
            entity.ToTable("vehicle_market_values");

            entity.HasOne(e => e.VehicleModel)
                .WithMany(m => m.MarketValues)
                .HasForeignKey(e => e.VehicleModelId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(new[] { nameof(VehicleMarketValue.VehicleModelId), nameof(VehicleMarketValue.ProductionYear) })
                .IsUnique();

            entity.HasIndex(e => e.VehicleModelId);
            entity.HasIndex(e => e.ProductionYear);
        });

        modelBuilder.Entity<InsurancePlan>(entity =>
        {
            entity.ToTable("insurance_plans");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.PlanType).HasConversion<string>().HasMaxLength(10).IsRequired();
            entity.Property(e => e.RepairType).HasConversion<string>().HasMaxLength(20).IsRequired();
            entity.Property(e => e.SumInsured).HasColumnType("numeric(15,2)").IsRequired();
            entity.Property(e => e.PremiumTotal).HasColumnType("numeric(15,2)").IsRequired();
            entity.Property(e => e.ExcessAmount).HasColumnType("numeric(15,2)").HasDefaultValue(0m);
            entity.Property(e => e.CoverageDetails).HasColumnType("jsonb").HasDefaultValueSql("'{}'");
            entity.Property(e => e.RegionGroup).HasMaxLength(100).HasDefaultValue("").IsRequired();
            entity.Property(e => e.ExternalPackageId).HasMaxLength(100).HasDefaultValue("").IsRequired();

            // Coverage limits — nullable; null = insurer does not provide/publish this value
            entity.Property(e => e.TpbiPerPerson).HasColumnType("numeric(15,2)");
            entity.Property(e => e.TpbiPerAccident).HasColumnType("numeric(15,2)");
            entity.Property(e => e.Tppd).HasColumnType("numeric(15,2)");
            entity.Property(e => e.FireTheft).HasColumnType("numeric(15,2)");
            entity.Property(e => e.PersonalAccident).HasColumnType("numeric(15,2)");
            entity.Property(e => e.PassengerAccident).HasColumnType("numeric(15,2)");
            entity.Property(e => e.MedicalExpenses).HasColumnType("numeric(15,2)");
            entity.Property(e => e.BailBond).HasColumnType("numeric(15,2)");

            entity.Property(e => e.Remarks).HasColumnType("text");

            entity.HasOne(e => e.Company)
                .WithMany(c => c.InsurancePlans)
                .HasForeignKey(e => e.CompanyId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.VehicleModel)
                .WithMany(m => m.InsurancePlans)
                .HasForeignKey(e => e.VehicleModelId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.SourceImportRecord)
                .WithMany()
                .HasForeignKey(e => e.SourceImportRecordId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.SourceBatch)
                .WithMany()
                .HasForeignKey(e => e.SourceBatchId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(new[] {
                nameof(InsurancePlan.CompanyId),
                nameof(InsurancePlan.VehicleModelId),
                nameof(InsurancePlan.PlanType),
                nameof(InsurancePlan.RepairType),
                nameof(InsurancePlan.RegistrationYear),
                nameof(InsurancePlan.SumInsured),
                nameof(InsurancePlan.RegionGroup),
                nameof(InsurancePlan.ExternalPackageId),
                nameof(InsurancePlan.VehicleTypeCode)
            }).IsUnique();

            entity.HasIndex(e => e.CompanyId);
            entity.HasIndex(e => e.VehicleModelId);
            entity.HasIndex(e => e.IsPublished);
        });

        modelBuilder.Entity<ImportRecord>(entity =>
        {
            entity.ToTable("import_records");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.RawData).HasColumnType("jsonb").IsRequired();
            entity.Property(e => e.MappingStatus).HasConversion<string>().HasMaxLength(50).IsRequired();
            entity.Property(e => e.ReviewStatus).HasConversion<string>().HasMaxLength(50).IsRequired();
            entity.Property(e => e.RejectionReason).HasColumnType("text");

            entity.HasOne(e => e.Batch)
                .WithMany(b => b.Records)
                .HasForeignKey(e => e.BatchId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.VehicleModelMapping)
                .WithMany()
                .HasForeignKey(e => e.VehicleModelMappingId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.PlanTypeMapping)
                .WithMany()
                .HasForeignKey(e => e.PlanTypeMappingId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => e.BatchId);
            entity.HasIndex(e => e.MappingStatus);
            entity.HasIndex(e => e.ReviewStatus);
        });

        modelBuilder.Entity<Quotation>(entity =>
        {
            entity.ToTable("quotations");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.CustomerName).HasMaxLength(255).IsRequired();
            entity.Property(e => e.VehicleRegistration).HasMaxLength(50);
            entity.Property(e => e.VehicleMake).HasMaxLength(100).IsRequired();
            entity.Property(e => e.VehicleModelName).HasMaxLength(200).IsRequired();
            entity.Property(e => e.PremiumAtGeneration).HasColumnType("numeric(15,2)").IsRequired();
            entity.Property(e => e.PremiumAtGeneration2).HasColumnType("numeric(15,2)");
            entity.Property(e => e.PremiumAtGeneration3).HasColumnType("numeric(15,2)");
            entity.Property(e => e.GeneratedAt).HasDefaultValueSql("now()");

            entity.HasOne(e => e.Plan)
                .WithMany()
                .HasForeignKey(e => e.PlanId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Plan2)
                .WithMany()
                .HasForeignKey(e => e.PlanId2)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Plan3)
                .WithMany()
                .HasForeignKey(e => e.PlanId3)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => e.CreatedBy);
            entity.HasIndex(e => e.PlanId);
            entity.HasIndex(e => e.GeneratedAt);
        });

        modelBuilder.Entity<Customer>(entity =>
        {
            entity.ToTable("customers");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.FullName).HasMaxLength(255).IsRequired();
            entity.Property(e => e.Phone).HasMaxLength(30).IsRequired();
            entity.Property(e => e.Email).HasMaxLength(255);
            entity.Property(e => e.LicenseNumber).HasMaxLength(50);
            entity.Property(e => e.VehicleRegistration).HasMaxLength(50);
            entity.Property(e => e.VehicleYear);
            entity.Property(e => e.PreviousInsurer).HasMaxLength(255);

            // Unique per agent per vehicle: same customer can have multiple registrations
            entity.HasIndex(new[] { nameof(Customer.FullName), nameof(Customer.Phone), nameof(Customer.VehicleRegistration), nameof(Customer.CreatedBy) }).IsUnique();
            entity.HasIndex(e => e.CreatedBy);
            entity.HasIndex(e => e.FullName);
        });

        // ── Provinces (reference / seed) ─────────────────────────────────────
        modelBuilder.Entity<Province>(entity =>
        {
            entity.ToTable("provinces");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.NameTh).HasMaxLength(100).IsRequired();
            entity.Property(e => e.NameEn).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Region).HasConversion<string>().HasMaxLength(20).IsRequired();
            entity.HasIndex(e => e.Region);
            entity.HasIndex(e => e.NameTh).IsUnique();

            entity.HasData(ProvinceSeeder.All);
        });

        // ── RegionGroupMappings (Allianz-style regional pricing) ─────────────
        // One row per (companyShortCode, regionGroup, thaiRegion).
        // BKK  → Bangkok only
        // NE   → Northeast only
        // UPC  → everything else (North, Central, East, West, South)
        modelBuilder.Entity<RegionGroupMapping>(entity =>
        {
            entity.ToTable("region_group_mappings");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.CompanyShortCode).HasMaxLength(50).IsRequired();
            entity.Property(e => e.RegionGroup).HasMaxLength(50).IsRequired();
            entity.Property(e => e.ThaiRegion).HasConversion<string>().HasMaxLength(20).IsRequired();
            entity.HasIndex(e => new { e.CompanyShortCode, e.RegionGroup });

            entity.HasData(
                new RegionGroupMapping { Id = 1, CompanyShortCode = "ALA", RegionGroup = "BKK", ThaiRegion = ThaiRegion.Bangkok    },
                new RegionGroupMapping { Id = 2, CompanyShortCode = "ALA", RegionGroup = "NE",  ThaiRegion = ThaiRegion.Northeast  },
                new RegionGroupMapping { Id = 3, CompanyShortCode = "ALA", RegionGroup = "UPC", ThaiRegion = ThaiRegion.North      },
                new RegionGroupMapping { Id = 4, CompanyShortCode = "ALA", RegionGroup = "UPC", ThaiRegion = ThaiRegion.Central    },
                new RegionGroupMapping { Id = 5, CompanyShortCode = "ALA", RegionGroup = "UPC", ThaiRegion = ThaiRegion.East       },
                new RegionGroupMapping { Id = 6, CompanyShortCode = "ALA", RegionGroup = "UPC", ThaiRegion = ThaiRegion.West       },
                new RegionGroupMapping { Id = 7, CompanyShortCode = "ALA", RegionGroup = "UPC", ThaiRegion = ThaiRegion.South      }
            );
        });
    }
}
