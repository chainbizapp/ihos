using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;

namespace Ihos.Application.Mapping.Commands;

public record CreatePlanTypeMappingCommand(
    Guid CompanyId,
    string RawName,
    PlanType CanonicalPlanType
) : IRequest<Guid>;

public class CreatePlanTypeMappingCommandHandler : IRequestHandler<CreatePlanTypeMappingCommand, Guid>
{
    private readonly IPlanTypeMappingRepository _mappings;
    private readonly ICurrentUserService _currentUser;

    public CreatePlanTypeMappingCommandHandler(
        IPlanTypeMappingRepository mappings,
        ICurrentUserService currentUser)
    {
        _mappings = mappings;
        _currentUser = currentUser;
    }

    public async Task<Guid> Handle(CreatePlanTypeMappingCommand request, CancellationToken ct)
    {
        var existing = await _mappings.GetByCompanyAndRawNameAsync(request.CompanyId, request.RawName, ct);
        if (existing != null)
        {
            return existing.Id;
        }

        var mapping = new PlanTypeMapping
        {
            CompanyId = request.CompanyId,
            RawName = request.RawName,
            CanonicalPlanType = request.CanonicalPlanType,
            CreatedBy = _currentUser.UserId
        };

        await _mappings.AddAsync(mapping, ct);
        await _mappings.SaveChangesAsync(ct);

        return mapping.Id;
    }
}
