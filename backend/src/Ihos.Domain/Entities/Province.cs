using Ihos.Domain.Enums;

namespace Ihos.Domain.Entities;

public class Province
{
    public int    Id       { get; set; }
    public string NameTh   { get; set; } = string.Empty;
    public string NameEn   { get; set; } = string.Empty;
    public ThaiRegion Region { get; set; }
}
