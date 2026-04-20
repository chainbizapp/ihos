using System.Collections.Concurrent;
using Ihos.Application.Import.Commands;

namespace Ihos.Application.Import.Services;

public enum ImportJobStatus { Processing, Done, Failed }

public sealed class ImportJobEntry
{
    public ImportJobStatus Status         { get; set; } = ImportJobStatus.Processing;
    public UploadImportFileResult? Result { get; set; }
    public string? Error                 { get; set; }
    public DateTimeOffset StartedAt      { get; set; } = DateTimeOffset.UtcNow;
    public string Stage                  { get; set; } = "Reading file...";
    public int TotalRows                 { get; set; }
    public int ProcessedRows             { get; set; }
    /// <summary>Set once the ImportBatch DB record is created.</summary>
    public Guid? BatchId                 { get; set; }
}

/// <summary>
/// Singleton in-memory store for long-running import jobs.
/// Keeps entries for 24 h then evicts them lazily.
/// </summary>
public sealed class ImportJobService
{
    private readonly ConcurrentDictionary<Guid, ImportJobEntry> _byJobId   = new();
    private readonly ConcurrentDictionary<Guid, Guid>           _byBatchId = new(); // batchId → jobId

    public Guid CreateJob()
    {
        var id = Guid.NewGuid();
        _byJobId[id] = new ImportJobEntry();
        Evict();
        return id;
    }

    public ImportJobEntry? GetJob(Guid jobId) =>
        _byJobId.TryGetValue(jobId, out var e) ? e : null;

    public ImportJobEntry? GetJobByBatchId(Guid batchId) =>
        _byBatchId.TryGetValue(batchId, out var jobId) ? GetJob(jobId) : null;

    /// <summary>Call after the ImportBatch DB record is created so batch-list polling works.</summary>
    public void SetBatchId(Guid jobId, Guid batchId)
    {
        if (_byJobId.TryGetValue(jobId, out var entry))
        {
            entry.BatchId = batchId;
            _byBatchId[batchId] = jobId;
        }
    }

    public void UpdateProgress(Guid jobId, string stage, int processedRows, int totalRows)
    {
        if (_byJobId.TryGetValue(jobId, out var entry))
        {
            entry.Stage         = stage;
            entry.ProcessedRows = processedRows;
            entry.TotalRows     = totalRows;
        }
    }

    public void Complete(Guid jobId, UploadImportFileResult result)
    {
        if (_byJobId.TryGetValue(jobId, out var entry))
        {
            entry.Result = result;
            entry.Status = ImportJobStatus.Done;
        }
    }

    public void Fail(Guid jobId, string error)
    {
        if (_byJobId.TryGetValue(jobId, out var entry))
        {
            entry.Error  = error;
            entry.Status = ImportJobStatus.Failed;
        }
    }

    private void Evict()
    {
        var cutoff = DateTimeOffset.UtcNow.AddHours(-24);
        foreach (var kv in _byJobId)
            if (kv.Value.StartedAt < cutoff)
            {
                if (_byJobId.TryRemove(kv.Key, out var e) && e.BatchId.HasValue)
                    _byBatchId.TryRemove(e.BatchId.Value, out _);
            }
    }
}
