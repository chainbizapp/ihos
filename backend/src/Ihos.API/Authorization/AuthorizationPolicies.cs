namespace Ihos.API.Authorization;

public static class AuthorizationPolicies
{
    public const string RequireAdmin = "RequireAdmin";
    public const string RequireManager = "RequireManager";
    public const string RequireSeniorStaff = "RequireSeniorStaff";
    public const string RequireAnyRole = "RequireAnyRole";
}
