using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Application.Mediator;

namespace Ihos.Application.Mapping.Commands;

public record CreateVehicleModelMappingCommand(
    Guid CompanyId,
    string RawName,
    Guid CanonicalModelId
) : IRequest<Guid>;

public class CreateVehicleModelMappingCommandHandler : IRequestHandler<CreateVehicleModelMappingCommand, Guid>
{
    private readonly IVehicleModelMappingRepository _mappings;
    private readonly ICurrentUserService _currentUser;

    public CreateVehicleModelMappingCommandHandler(
        IVehicleModelMappingRepository mappings,
        ICurrentUserService currentUser)
    {
        _mappings = mappings;
        _currentUser = currentUser;
    }

    public async Task<Guid> Handle(CreateVehicleModelMappingCommand request, CancellationToken ct)
    {
        var mapping = new VehicleModelMapping
        {
            CompanyId = request.CompanyId,
            RawName = request.RawName,
            CanonicalModelId = request.CanonicalModelId,
            IsAutoSuggested = false,
            CreatedBy = _currentUser.UserId
        };

        await _mappings.AddAsync(mapping, ct);
        await _mappings.SaveChangesAsync(ct);

        return mapping.Id;
    }
}
