using Ihos.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Ihos.Infrastructure.Services;

public class AppSettings : IAppSettings
{
    public string BaseUrl { get; }

    public AppSettings(IConfiguration config)
    {
        BaseUrl = config["App:BaseUrl"] ?? "http://localhost:4200";
    }
}
