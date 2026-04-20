using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Enums;
using Ihos.Application.Mediator;

namespace Ihos.Application.Mapping.Commands;

public record UpdatePlanTypeMappingCommand(
    Guid Id,
    PlanType CanonicalPlanType
) : IRequest<bool>;

public class UpdatePlanTypeMappingCommandHandler : IRequestHandler<UpdatePlanTypeMappingCommand, bool>
{
    private readonly IPlanTypeMappingRepository _mappings;

    public UpdatePlanTypeMappingCommandHandler(IPlanTypeMappingRepository mappings) =>
        _mappings = mappings;

    public async Task<bool> Handle(UpdatePlanTypeMappingCommand request, CancellationToken ct)
    {
        var mapping = await _mappings.GetByIdAsync(request.Id, ct);
        if (mapping == null) return false;

        mapping.CanonicalPlanType = request.CanonicalPlanType;

        await _mappings.SaveChangesAsync(ct);
        return true;
    }
}
