namespace Ihos.Application.Mediator;

/// <summary>Marker interface for commands/queries that return a value.</summary>
public interface IRequest<TResponse> { }

/// <summary>Marker interface for commands that return no value (void).</summary>
public interface IRequest : IRequest<Unit> { }
