using ClosedXML.Excel;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;
using Testcontainers.PostgreSql;

namespace Ihos.API.IntegrationTests.Import;

/// <summary>
/// Integration tests for the import pipeline:
/// 1. Upload valid Excel → batch created → approve all records → publish → search returns plans
/// 2. Upload corrupt file → 400 with error details
/// 3. Parse-fail (unsupported extension) → 400, no batch in DB
/// </summary>
public class ImportPipelineTests : IAsyncLifetime
{
    private const string TestJwtSecret = "ihos-integration-test-secret-key-32ch";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

    // IDs set during seeding
    private Guid _companyId;
    private Guid _makeId;
    private Guid _modelId;
    private Guid _adminUserId = Guid.NewGuid();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    // Replace DB context
                    var descriptor = services.SingleOrDefault(
                        d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
                    if (descriptor != null) services.Remove(descriptor);

                    services.AddDbContext<ApplicationDbContext>(options =>
                        options.UseNpgsql(_postgres.GetConnectionString()));

                    // Override JWT secret so we can mint tokens in tests
                    services.Configure<Microsoft.Extensions.Configuration.IConfiguration>(_ => { });
                });

                builder.UseSetting("Jwt:SecretKey", TestJwtSecret);
                builder.UseSetting("Jwt:ExpiryMinutes", "60");
                builder.UseSetting("JasperReports:BaseUrl", "http://localhost:9999/"); // not called in these tests
            });

        _client = _factory.CreateClient();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.Database.MigrateAsync();
        await SeedAsync(db);
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    // ── Seed ──────────────────────────────────────────────────────────────────────

    private async Task SeedAsync(ApplicationDbContext db)
    {
        var company = new InsuranceCompany { Name = "Import Test Co", ShortCode = "ITC", IsActive = true };
        await db.InsuranceCompanies.AddAsync(company);

        var make = new VehicleMake { Name = "Honda" };
        await db.VehicleMakes.AddAsync(make);

        var model = new VehicleModel { MakeId = make.Id, Name = "Civic" };
        await db.VehicleModels.AddAsync(model);

        // Vehicle model mapping: raw "Honda Civic" → canonical model
        var vmMapping = new VehicleModelMapping
        {
            CompanyId = company.Id,
            RawName = "Honda Civic",
            CanonicalModelId = model.Id,
            CreatedBy = _adminUserId
        };
        await db.VehicleModelMappings.AddAsync(vmMapping);

        // Plan type mapping: raw "Type1" → canonical Type1
        var ptMapping = new PlanTypeMapping
        {
            CompanyId = company.Id,
            RawName = "Type1",
            CanonicalPlanType = PlanType.Type1,
            CreatedBy = _adminUserId
        };
        await db.PlanTypeMappings.AddAsync(ptMapping);

        await db.SaveChangesAsync();

        _companyId = company.Id;
        _makeId    = make.Id;
        _modelId   = model.Id;
    }

    // ── Token helpers ─────────────────────────────────────────────────────────────

    private string MintToken(string role)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestJwtSecret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, _adminUserId.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, "admin@test.local"),
            new Claim(ClaimTypes.Name, "Test Admin"),
            new Claim(ClaimTypes.Role, role),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };
        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private HttpRequestMessage WithAuth(HttpRequestMessage req, string role = "Admin")
    {
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", MintToken(role));
        return req;
    }

    // ── Excel builder ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Builds a valid import Excel file with one plan row.
    /// </summary>
    private static byte[] BuildValidExcel(
        string vehicleModel = "Honda Civic",
        string planType     = "Type1",
        string repairType   = "Garage",
        int minYear         = 1,
        int maxYear         = 7,
        decimal sumInsured  = 500_000m,
        decimal premium     = 15_000m,
        decimal excess      = 2_000m)
    {
        using var wb  = new XLWorkbook();
        var ws = wb.Worksheets.Add("Plans");
        ws.Cell(1, 1).Value = "vehicle_model";
        ws.Cell(1, 2).Value = "plan_type";
        ws.Cell(1, 3).Value = "repair_type";
        ws.Cell(1, 4).Value = "min_year";
        ws.Cell(1, 5).Value = "max_year";
        ws.Cell(1, 6).Value = "sum_insured";
        ws.Cell(1, 7).Value = "premium_total";
        ws.Cell(1, 8).Value = "excess_amount";

        ws.Cell(2, 1).Value = vehicleModel;
        ws.Cell(2, 2).Value = planType;
        ws.Cell(2, 3).Value = repairType;
        ws.Cell(2, 4).Value = minYear;
        ws.Cell(2, 5).Value = maxYear;
        ws.Cell(2, 6).Value = (double)sumInsured;
        ws.Cell(2, 7).Value = (double)premium;
        ws.Cell(2, 8).Value = (double)excess;

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    private static MultipartFormDataContent BuildUploadForm(
        Guid companyId, byte[] fileBytes, string fileName = "plans.xlsx")
    {
        var form = new MultipartFormDataContent();
        form.Add(new StringContent(companyId.ToString()), "companyId");
        var fileContent = new ByteArrayContent(fileBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        form.Add(fileContent, "file", fileName);
        return form;
    }

    // ── Tests ──────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Happy path: upload valid Excel → batch created with PendingReview status →
    /// approve all records → publish batch → search returns the newly published plan.
    /// </summary>
    [Fact]
    public async Task FullPipeline_ValidExcel_BatchCreatedApprovedPublishedAndSearchable()
    {
        var fileBytes = BuildValidExcel();
        var form = BuildUploadForm(_companyId, fileBytes);

        // Step 1: Upload
        var uploadReq = WithAuth(new HttpRequestMessage(HttpMethod.Post, "/api/imports/upload"), "Manager");
        uploadReq.Content = form;
        var uploadRes = await _client.SendAsync(uploadReq);

        Assert.Equal(HttpStatusCode.Created, uploadRes.StatusCode);
        var uploadBody = await uploadRes.Content.ReadAsStringAsync();
        var uploadDoc = JsonDocument.Parse(uploadBody);
        var batchId = Guid.Parse(uploadDoc.RootElement.GetProperty("batchId").GetString()!);
        Assert.NotEqual(Guid.Empty, batchId);

        // Step 2: Fetch batch to get record IDs
        var batchReq = WithAuth(new HttpRequestMessage(HttpMethod.Get, $"/api/imports/batches/{batchId}"), "Manager");
        var batchRes = await _client.SendAsync(batchReq);
        batchRes.EnsureSuccessStatusCode();

        var batchDoc = JsonDocument.Parse(await batchRes.Content.ReadAsStringAsync());
        var records  = batchDoc.RootElement.GetProperty("records").EnumerateArray().ToList();
        Assert.Single(records);

        var recordId = Guid.Parse(records[0].GetProperty("id").GetString()!);

        // Step 3: Approve the record
        var approveReq = WithAuth(new HttpRequestMessage(HttpMethod.Put, $"/api/imports/records/{recordId}/approve"), "Manager");
        approveReq.Content = new StringContent("{}", Encoding.UTF8, "application/json");
        var approveRes = await _client.SendAsync(approveReq);
        Assert.Equal(HttpStatusCode.NoContent, approveRes.StatusCode);

        // Step 4: Publish the batch
        var publishReq = WithAuth(new HttpRequestMessage(HttpMethod.Post, $"/api/imports/batches/{batchId}/publish"), "Manager");
        publishReq.Content = new StringContent("{}", Encoding.UTF8, "application/json");
        var publishRes = await _client.SendAsync(publishReq);
        Assert.Equal(HttpStatusCode.OK, publishRes.StatusCode);
        var publishDoc = JsonDocument.Parse(await publishRes.Content.ReadAsStringAsync());
        Assert.True(publishDoc.RootElement.GetProperty("plansCreated").GetInt32() > 0);

        // Step 5: Search — published plan must appear
        var productionYear = DateTime.UtcNow.Year - 3; // age 3, within minYear=1 maxYear=7
        var searchUrl = $"/api/plans/search?vehicleModelId={_modelId}&productionYear={productionYear}&planType=Type1&repairType=Garage";
        var searchReq = WithAuth(new HttpRequestMessage(HttpMethod.Get, searchUrl));
        var searchRes = await _client.SendAsync(searchReq);
        searchRes.EnsureSuccessStatusCode();

        var searchDoc    = JsonDocument.Parse(await searchRes.Content.ReadAsStringAsync());
        var totalCount   = searchDoc.RootElement.GetProperty("totalCount").GetInt32();
        Assert.True(totalCount >= 1, $"Expected at least 1 search result, got {totalCount}");
    }

    /// <summary>
    /// Uploading a corrupt/random byte array as .xlsx → 400 with parseErrors in body.
    /// </summary>
    [Fact]
    public async Task Upload_CorruptFile_Returns400WithParseErrors()
    {
        // Random bytes that are not a valid XLSX
        var corrupt = new byte[] { 0xFF, 0xFE, 0x00, 0x01, 0x02, 0x03 };
        var form    = BuildUploadForm(_companyId, corrupt, "corrupt.xlsx");

        var req = WithAuth(new HttpRequestMessage(HttpMethod.Post, "/api/imports/upload"), "Manager");
        req.Content = form;
        var res = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        var body = await res.Content.ReadAsStringAsync();
        Assert.Contains("error", body, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Uploading a .txt file (unsupported extension) → 400, no ImportBatch row created in DB.
    /// </summary>
    [Fact]
    public async Task Upload_UnsupportedFileType_Returns400AndNoBatchInDb()
    {
        var content = new ByteArrayContent(Encoding.UTF8.GetBytes("not an excel file"));
        content.Headers.ContentType = new MediaTypeHeaderValue("text/plain");

        var form = new MultipartFormDataContent();
        form.Add(new StringContent(_companyId.ToString()), "companyId");
        form.Add(content, "file", "plans.txt");

        var req = WithAuth(new HttpRequestMessage(HttpMethod.Post, "/api/imports/upload"), "Manager");
        req.Content = form;
        var res = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);

        // Verify no batch was persisted
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var batchCount = await db.ImportBatches
            .CountAsync(b => b.CompanyId == _companyId);
        Assert.Equal(0, batchCount);
    }

    /// <summary>
    /// Unauthenticated upload request → 401.
    /// </summary>
    [Fact]
    public async Task Upload_Unauthenticated_Returns401()
    {
        var fileBytes = BuildValidExcel();
        var form      = BuildUploadForm(_companyId, fileBytes);

        var res = await _client.PostAsync("/api/imports/upload", form);
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    /// <summary>
    /// Staff role (not SeniorStaff) cannot upload → 403.
    /// </summary>
    [Fact]
    public async Task Upload_InsufficientRole_Returns403()
    {
        var fileBytes = BuildValidExcel();
        var form      = BuildUploadForm(_companyId, fileBytes);

        var req = WithAuth(new HttpRequestMessage(HttpMethod.Post, "/api/imports/upload"), "Staff");
        req.Content = form;
        var res = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }
}
