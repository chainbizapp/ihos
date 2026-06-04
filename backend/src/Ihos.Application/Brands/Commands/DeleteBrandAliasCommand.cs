using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;

namespace Ihos.Application.Brands.Commands;

/// <summary>Soft-deletes an alias (Constitution Principle V — no hard deletes).</summary>
public record DeleteBrandAliasCommand(Guid Id, Guid? ActorUserId) : IRequest<bool>;

public class DeleteBrandAliasCommandHandler : IRequestHandler<DeleteBrandAliasCommand, bool>
{
    private readonly IBrandAliasRepository _repo;
    public DeleteBrandAliasCommandHandler(IBrandAliasRepository repo) => _repo = repo;

    public async Task<bool> Handle(DeleteBrandAliasCommand request, CancellationToken ct)
    {
        var alias = await _repo.GetByIdAsync(request.Id, ct);
        if (alias is null) return false;
        alias.IsDeleted = true;
        alias.UpdatedBy = request.ActorUserId;
        alias.UpdatedAt = DateTime.UtcNow;
        await _repo.SaveChangesAsync(ct);
        return true;
    }
}
