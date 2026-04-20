using Microsoft.Extensions.DependencyInjection;

namespace Ihos.Application.Mediator;

/// <summary>
/// In-house Mediator — resolves handler + pipeline behaviors from DI,
/// chains them, and dispatches the request. No third-party dependency.
/// </summary>
public sealed class Mediator : IMediator
{
    private readonly IServiceProvider _sp;

    public Mediator(IServiceProvider sp) => _sp = sp;

    public Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default)
    {
        var requestType  = request.GetType();
        var wrapperType  = typeof(HandlerWrapper<,>).MakeGenericType(requestType, typeof(TResponse));
        var handlerType  = typeof(IRequestHandler<,>).MakeGenericType(requestType, typeof(TResponse));
        var behaviorType = typeof(IEnumerable<>).MakeGenericType(
            typeof(IPipelineBehavior<,>).MakeGenericType(requestType, typeof(TResponse)));

        var handler   = _sp.GetRequiredService(handlerType);
        var behaviors = _sp.GetRequiredService(behaviorType);

        var wrapper = (IHandlerWrapper<TResponse>)Activator.CreateInstance(wrapperType, handler, behaviors)!;
        return wrapper.Handle(request, cancellationToken);
    }

    // ── Inner typed wrapper — avoids reflection on method calls ─────────────────

    private interface IHandlerWrapper<TResponse>
    {
        Task<TResponse> Handle(IRequest<TResponse> request, CancellationToken ct);
    }

    private sealed class HandlerWrapper<TRequest, TResponse> : IHandlerWrapper<TResponse>
        where TRequest : IRequest<TResponse>
    {
        private readonly IRequestHandler<TRequest, TResponse> _handler;
        private readonly IEnumerable<IPipelineBehavior<TRequest, TResponse>> _behaviors;

        public HandlerWrapper(
            IRequestHandler<TRequest, TResponse> handler,
            IEnumerable<IPipelineBehavior<TRequest, TResponse>> behaviors)
        {
            _handler   = handler;
            _behaviors = behaviors;
        }

        public Task<TResponse> Handle(IRequest<TResponse> request, CancellationToken ct)
        {
            RequestHandlerDelegate<TResponse> pipeline = () => _handler.Handle((TRequest)request, ct);

            foreach (var behavior in _behaviors.Reverse())
            {
                var next = pipeline;
                var b    = behavior;
                pipeline = () => b.Handle((TRequest)request, next, ct);
            }

            return pipeline();
        }
    }
}
