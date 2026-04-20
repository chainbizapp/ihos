namespace Ihos.Application.Import.Services;

public record ParseError(int Row, string Column, string Reason);

public record ParseResult
{
    public bool Success { get; init; }
    public IReadOnlyList<ParseError> Errors { get; init; } = [];
    public IReadOnlyList<Dictionary<string, string>> Rows { get; init; } = [];

    public static ParseResult Ok(IReadOnlyList<Dictionary<string, string>> rows) =>
        new() { Success = true, Rows = rows };

    public static ParseResult Fail(IReadOnlyList<ParseError> errors) =>
        new() { Success = false, Errors = errors };
}
