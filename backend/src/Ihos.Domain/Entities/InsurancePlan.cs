using Ihos.Domain.Common;
using Ihos.Domain.Enums;

namespace Ihos.Domain.Entities;

public class InsurancePlan : BaseEntity
{
    public Guid CompanyId { get; set; }
    public Guid VehicleModelId { get; set; }
    public PlanType PlanType { get; set; }
    public RepairType RepairType { get; set; }
    /// <summary>
    /// Actual vehicle registration year this plan applies to (e.g. 2020).
    /// 0 = plan covers all years (no year restriction).
    /// Part of the business unique key.
    /// </summary>
    public int RegistrationYear { get; set; }
    public decimal SumInsured { get; set; }
    public decimal PremiumTotal { get; set; }
    public decimal ExcessAmount { get; set; } = 0;
    public string CoverageDetails { get; set; } = "{}";
    /// <summary>
    /// Geographic region code for insurers with regional pricing (e.g. Allianz REGION_GROUP).
    /// Empty string for companies without regional pricing (Viriyah, etc.).
    /// Part of the business unique key.
    /// </summary>
    public string RegionGroup { get; set; } = "";

/// <summary>
    /// Company-assigned package/product ID (e.g. Allianz PACKAGE_ID).
    /// Empty string for companies that don't use package IDs.
    /// Part of the business unique key — allows multiple price tiers for the same coverage.
    /// </summary>
    public string ExternalPackageId { get; set; } = "";
    /// <summary>
    /// Vehicle type code from the insurer's file (e.g. Viriyah vehicle_type_code).
    /// Empty string for companies that don't use this field.
    /// Part of the business unique key.
    /// </summary>
    public string VehicleTypeCode { get; set; } = "";
    // ── Structured coverage limits (nullable = company doesn't provide this value) ──
    /// <summary>ความรับผิดชอบต่อคู่กรณี ต่อคน — TPBI per person</summary>
    public decimal? TpbiPerPerson { get; set; }
    /// <summary>ความรับผิดชอบต่อคู่กรณี ต่อครั้ง — TPBI per accident</summary>
    public decimal? TpbiPerAccident { get; set; }
    /// <summary>ความเสียหายต่อทรัพย์สินคู่กรณี — Third Party Property Damage</summary>
    public decimal? Tppd { get; set; }
    /// <summary>รถยนต์สูญหาย/ไฟไหม้ — Fire &amp; Theft</summary>
    public decimal? FireTheft { get; set; }
    /// <summary>อุบัติเหตุส่วนบุคคล (ผู้ขับขี่) — Driver Personal Accident</summary>
    public decimal? PersonalAccident { get; set; }
    /// <summary>อุบัติเหตุส่วนบุคคล (ผู้โดยสาร) — Passenger Personal Accident</summary>
    public decimal? PassengerAccident { get; set; }
    /// <summary>ค่ารักษาพยาบาล — Medical Expenses per person</summary>
    public decimal? MedicalExpenses { get; set; }
    /// <summary>ประกันตัวผู้ขับขี่ — Bail Bond</summary>
    public decimal? BailBond { get; set; }

    public string? Remarks { get; set; }
    public Guid? SourceImportRecordId { get; set; }
    public Guid? SourceBatchId { get; set; }
    public bool IsPublished { get; set; } = false;

    public InsuranceCompany Company { get; set; } = null!;
    public VehicleModel VehicleModel { get; set; } = null!;
    public ImportRecord? SourceImportRecord { get; set; }
    public ImportBatch? SourceBatch { get; set; }
}
