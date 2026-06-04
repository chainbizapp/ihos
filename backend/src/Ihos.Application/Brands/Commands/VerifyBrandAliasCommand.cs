using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;
using Ihos.Domain.Enums;

namespace Ihos.Application.Brands.Commands;

/// <summary>
/// One-click "approve this AI guess" from the admin UI. Promotes an AiGuess/AiFuzzy row to
/// verified so it starts resolving live quotes. Requires the alias already point at a
/// canonical make.
/// </summary>
public record VerifyBrandAliasCommand(Guid Id, Guid? ActorUserId) : IRequest<bool>;

public class VerifyBrandAliasCommandHandler : IRequestHandler<VerifyBrandAliasCommand, bool>
{
    private readonly IBrandAliasRepository _repo;
    public VerifyBrandAliasCommandHandler(IBrandAliasRepository repo) => _repo = repo;

    public async Task<bool> Handle(VerifyBrandAliasCommand request, CancellationToken ct)
    {
        var alias = await _repo.GetByIdAsync(request.Id, ct);
        if (alias is null) return false;
        if (alias.CanonicalMakeId is null)
            throw new InvalidOperationException(
                "Cannot verify an alias with no canonical make. Assign a make first.");

        alias.Source = AliasSource.Human;
        alias.IsVerified = true;
        alias.Confidence = 100;
        alias.UpdatedBy = request.ActorUserId;
        alias.UpdatedAt = DateTime.UtcNow;
        await _repo.SaveChangesAsync(ct);
        return true;
    }
}
