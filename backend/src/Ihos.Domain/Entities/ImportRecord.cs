using Ihos.Domain.Common;
using Ihos.Domain.Enums;

namespace Ihos.Domain.Entities;

public class ImportRecord : BaseEntity
{
    public Guid BatchId { get; set; }
    public int RowNumber { get; set; }
    public string RawData { get; set; } = "{}";
    public Guid? VehicleModelMappingId { get; set; }
    public Guid? PlanTypeMappingId { get; set; }
    public ImportMappingStatus MappingStatus { get; set; } = ImportMappingStatus.PendingMapping;
    public ImportReviewStatus ReviewStatus { get; set; } = ImportReviewStatus.Pending;
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? RejectionReason { get; set; }

    public ImportBatch Batch { get; set; } = null!;
    public VehicleModelMapping? VehicleModelMapping { get; set; }
    public PlanTypeMapping? PlanTypeMapping { get; set; }
}
