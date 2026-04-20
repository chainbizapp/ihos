using Ihos.Domain.Common;
using Ihos.Domain.Enums;

namespace Ihos.Domain.Entities;

public class ImportBatch : BaseEntity
{
    public Guid CompanyId { get; set; }
    public string SourceFileName { get; set; } = string.Empty;
    public string SourceFilePath { get; set; } = string.Empty;
    public Guid UploadedBy { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public ImportBatchStatus Status { get; set; } = ImportBatchStatus.Processing;
    public int TotalRows { get; set; } = 0;
    public int ResolvedRows { get; set; } = 0;
    public int PendingRows { get; set; } = 0;
    public int ApprovedRows { get; set; } = 0;
    public int RejectedRows { get; set; } = 0;
    public Guid? PublishedBy { get; set; }
    public DateTime? PublishedAt { get; set; }
    public string? FailureReason { get; set; }
    public Guid? DeletedBy { get; set; }
    public DateTime? DeletedAt { get; set; }
    public string? DeletionReason { get; set; }

    public InsuranceCompany Company { get; set; } = null!;
    public ICollection<ImportRecord> Records { get; set; } = new List<ImportRecord>();
}
