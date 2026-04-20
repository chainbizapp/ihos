namespace Ihos.Application.Mediator;

public delegate Task<TResponse> RequestHandlerDelegate<TResponse>();

/// <summary>Wraps handler execution — used for validation, logging, etc.</summary>
public interface IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
{
    Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken);
}
