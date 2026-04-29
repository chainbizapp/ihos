using Ihos.Application.Customer.Queries;
using Ihos.Application.Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ihos.API.Controllers;

[ApiController]
[Route("api/customers")]
[Authorize]
public class CustomersController : ControllerBase
{
    private readonly IMediator _mediator;

    public CustomersController(IMediator mediator) => _mediator = mediator;

    /// <summary>
    /// Search customers by name prefix — used for auto-suggest on the quotation form.
    /// Returns up to 10 matches belonging to the authenticated agent.
    /// </summary>
    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string q, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
            return Ok(Array.Empty<CustomerSuggestionDto>());

        var results = await _mediator.Send(new SearchCustomersQuery(q), ct);
        return Ok(results);
    }
}
