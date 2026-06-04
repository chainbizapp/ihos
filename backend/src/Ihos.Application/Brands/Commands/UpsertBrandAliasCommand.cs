using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;

namespace Ihos.Application.Brands.Commands;

/// <summary>
/// Creates a new alias or edits an existing one from the admin UI. Because this is a human
/// action it always lands as <see cref="AliasSource.Human"/> + verified — overriding any
/// prior AI guess. Used both for "fix this wrong guess" and "add a missing alias".
/// </summary>
public record UpsertBrandAliasCommand(
    Guid? Id,                  // null = create, set = edit
    string ProviderCode,
    string RawValue,
    Guid? CanonicalMakeId,     // null = leave unresolved (Pending)
    Guid? ActorUserId
) : IRequest<Guid>;

public class UpsertBrandAliasCommandHandler : IRequestHandler<UpsertBrandAliasCommand, Guid>
{
    private readonly IBrandAliasRepository _repo;
    public UpsertBrandAliasCommandHandler(IBrandAliasRepository repo) => _repo = repo;

    public async Task<Guid> Handle(UpsertBrandAliasCommand request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ProviderCode) || string.IsNullOrWhiteSpace(request.RawValue))
            throw new InvalidOperationException("ProviderCode and RawValue are required.");

        var resolved = request.CanonicalMakeId.HasValue;
        var source = resolved ? AliasSource.Human : AliasSource.Pending;

        if (request.Id is { } id)
        {
            var existing = await _repo.GetByIdAsync(id, ct)
                ?? throw new InvalidOperationException("Alias not found.");
            existing.ProviderCode = request.ProviderCode.Trim();
            existing.RawValue = request.RawValue.Trim();
            existing.CanonicalMakeId = request.CanonicalMakeId;
            existing.Source = source;
            existing.Confidence = resolved ? 100 : null;
            existing.IsVerified = resolved;
            existing.UpdatedBy = request.ActorUserId;
            existing.UpdatedAt = DateTime.UtcNow;
            await _repo.SaveChangesAsync(ct);
            return existing.Id;
        }

        var created = new ProviderBrandAlias
        {
            ProviderCode = request.ProviderCode.Trim(),
            RawValue = request.RawValue.Trim(),
            CanonicalMakeId = request.CanonicalMakeId,
            Source = source,
            Confidence = resolved ? 100 : null,
            IsVerified = resolved,
            CreatedBy = request.ActorUserId,
            UpdatedBy = request.ActorUserId,
        };
        await _repo.AddAsync(created, ct);
        await _repo.SaveChangesAsync(ct);
        return created.Id;
    }
}
