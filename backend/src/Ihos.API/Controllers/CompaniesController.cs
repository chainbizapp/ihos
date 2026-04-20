using Ihos.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ihos.API.Controllers;

[ApiController]
[Route("api/companies")]
[Authorize]
public class CompaniesController : ControllerBase
{
    private readonly IInsuranceCompanyRepository _companies;

    public CompaniesController(IInsuranceCompanyRepository companies) =>
        _companies = companies;

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var companies = await _companies.GetAllActiveAsync(ct);
        var result = companies.Select(c => new
        {
            id = c.Id,
            name = c.Name,
            shortCode = c.ShortCode,
            isActive = c.IsActive
        });
        return Ok(result);
    }
}
