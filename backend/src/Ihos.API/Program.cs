using System.Text;
using FluentValidation;
using Ihos.API.Authorization;
using Ihos.API.Middleware;
using Ihos.Application;
using Ihos.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// ── Serilog ──────────────────────────────────────────────────────────────────
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();

// ── Controllers & OpenAPI ─────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// ── JWT Authentication ────────────────────────────────────────────────────────
var jwtSection = builder.Configuration.GetSection("Jwt");
var secretKey = jwtSection["SecretKey"]
    ?? throw new InvalidOperationException("Jwt:SecretKey is not configured.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero,
        };
    });

// ── Authorization Policies ────────────────────────────────────────────────────
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AuthorizationPolicies.RequireAdmin,
        policy => policy.RequireRole("Admin"));

    options.AddPolicy(AuthorizationPolicies.RequireManager,
        policy => policy.RequireRole("Admin", "Manager"));

    options.AddPolicy(AuthorizationPolicies.RequireSeniorStaff,
        policy => policy.RequireRole("Admin", "Manager", "SeniorStaff"));

    options.AddPolicy(AuthorizationPolicies.RequireAnyRole,
        policy => policy.RequireRole("Admin", "Manager", "SeniorStaff", "Staff"));
});

// ── CORS ──────────────────────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(
                builder.Configuration.GetValue<string>("AllowedOrigins") ?? "http://localhost:4200")
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

// ── Application & Infrastructure ─────────────────────────────────────────────
builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);

var app = builder.Build();

// ── DB migration + bootstrap seed ────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db      = scope.ServiceProvider.GetRequiredService<Ihos.Infrastructure.Persistence.ApplicationDbContext>();
    var hasher  = scope.ServiceProvider.GetRequiredService<Ihos.Application.Common.Interfaces.IPasswordHasher>();
    var cfg     = scope.ServiceProvider.GetRequiredService<IConfiguration>();
    var initLog = scope.ServiceProvider.GetRequiredService<ILoggerFactory>()
                      .CreateLogger("DbInitializer");
    await Ihos.Infrastructure.Persistence.DbInitializer.InitializeAsync(db, hasher, cfg, initLog);
}

// ── Middleware pipeline ───────────────────────────────────────────────────────
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

// Make Program accessible for integration tests
public partial class Program { }
