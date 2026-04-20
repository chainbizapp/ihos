using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;

namespace Ihos.Application.Mapping.Commands;

public record UpdateVehicleModelMappingCommand(
    Guid Id,
    Guid CanonicalModelId
) : IRequest<bool>;

public class UpdateVehicleModelMappingCommandHandler : IRequestHandler<UpdateVehicleModelMappingCommand, bool>
{
    private readonly IVehicleModelMappingRepository _mappings;

    public UpdateVehicleModelMappingCommandHandler(IVehicleModelMappingRepository mappings) =>
        _mappings = mappings;

    public async Task<bool> Handle(UpdateVehicleModelMappingCommand request, CancellationToken ct)
    {
        var mapping = await _mappings.GetByIdAsync(request.Id, ct);
        if (mapping == null) return false;

        mapping.CanonicalModelId = request.CanonicalModelId;
        mapping.IsAutoSuggested = false;

        await _mappings.SaveChangesAsync(ct);
        return true;
    }
}
