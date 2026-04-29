using Ihos.Application.Common.Interfaces;
using Ihos.Application.Mediator;

namespace Ihos.Application.Mapping.Commands;

public record DeleteVehicleModelMappingCommand(Guid Id) : IRequest<bool>;

public class DeleteVehicleModelMappingCommandHandler : IRequestHandler<DeleteVehicleModelMappingCommand, bool>
{
    private readonly IVehicleModelMappingRepository _mappings;

    public DeleteVehicleModelMappingCommandHandler(IVehicleModelMappingRepository mappings) =>
        _mappings = mappings;

    public Task<bool> Handle(DeleteVehicleModelMappingCommand request, CancellationToken ct) =>
        _mappings.DeleteAsync(request.Id, ct);
}
