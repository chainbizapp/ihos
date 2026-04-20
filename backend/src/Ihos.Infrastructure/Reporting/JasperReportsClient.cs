using System.Text;
using System.Text.Json;
using Ihos.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Ihos.Infrastructure.Reporting;

public class JasperReportsClient : IJasperReportsClient
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string _baseUrl;

    public JasperReportsClient(IHttpClientFactory httpClientFactory, IConfiguration config)
    {
        _httpClientFactory = httpClientFactory;
        _baseUrl = config.GetSection("JasperReports")["BaseUrl"] ?? "http://localhost:7030/";
    }

    public async Task<byte[]> GenerateQuotationPdfAsync(
        Dictionary<string, string> parameters,
        CancellationToken ct = default)
    {
        parameters.TryGetValue("param1", out var param1);
        parameters.TryGetValue("param2", out var param2);
        parameters.TryGetValue("param3", out var param3);
        parameters.TryGetValue("srcFile", out var srcFile);
        srcFile ??= "quotation";

        var body = new
        {
            srcFile = srcFile,
            outputFile = $"{srcFile}.PDF",
            param1 = param1 ?? string.Empty,
            param2 = param2 ?? string.Empty,
            param3 = param3 ?? string.Empty,
            outputType = "PDF",
            forceDownload = true
        };

        var json = JsonSerializer.Serialize(body);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var client = _httpClientFactory.CreateClient("jasper");
        client.BaseAddress = new Uri(_baseUrl);
        client.Timeout = TimeSpan.FromSeconds(30);

        var response = await client.PostAsync("report", content, ct);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(ct);
            string errorMessage;
            try
            {
                using var doc = JsonDocument.Parse(errorBody);
                errorMessage = doc.RootElement.TryGetProperty("message", out var msg)
                    ? msg.GetString() ?? errorBody
                    : errorBody;
            }
            catch
            {
                errorMessage = errorBody;
            }
            throw new HttpRequestException($"Report service error: {errorMessage}");
        }

        return await response.Content.ReadAsByteArrayAsync(ct);
    }
}
