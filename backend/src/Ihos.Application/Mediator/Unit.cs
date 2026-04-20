namespace Ihos.Application.Mediator;

/// <summary>
/// Represents a void return value for commands that don't return data.
/// Equivalent to MediatR's Unit.
/// </summary>
public readonly struct Unit
{
    public static readonly Unit Value = new();
}
