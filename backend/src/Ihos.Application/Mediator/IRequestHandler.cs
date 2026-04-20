namespace Ihos.Application.Mediator;

/// <summary>Handles a request and returns a response.</summary>
public interface IRequestHandler<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
{
    Task<TResponse> Handle(TRequest request, CancellationToken cancellationToken);
}

/// <summary>Handles a void command (no return value).</summary>
public abstract class RequestHandler<TRequest> : IRequestHandler<TRequest, Unit>
    where TRequest : IRequest<Unit>
{
    public async Task<Unit> Handle(TRequest request, CancellationToken cancellationToken)
    {
        await HandleCore(request, cancellationToken);
        return Unit.Value;
    }

    protected abstract Task HandleCore(TRequest request, CancellationToken cancellationToken);
}

/// <summary>Convenience interface matching MediatR's single-generic IRequestHandler pattern.</summary>
public interface IRequestHandler<TRequest> : IRequestHandler<TRequest, Unit>
    where TRequest : IRequest<Unit>
{
    new Task Handle(TRequest request, CancellationToken cancellationToken);

    Task<Unit> IRequestHandler<TRequest, Unit>.Handle(TRequest request, CancellationToken ct)
        => Handle(request, ct).ContinueWith(_ => Unit.Value, ct);
}
