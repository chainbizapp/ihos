using Ihos.Application.Common.Interfaces;
using Ihos.Domain.Entities;
using Ihos.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ihos.API.Controllers;

[ApiController]
[Route("api/vehicles")]
[AllowAnonymous]
public class VehiclesController : ControllerBase
{
    private readonly IVehicleModelRepository _vehicles;
    private readonly ICurrentUserService _currentUser;
    private readonly ApplicationDbContext _db;

    public VehiclesController(IVehicleModelRepository vehicles, ICurrentUserService currentUser, ApplicationDbContext db)
    {
        _vehicles    = vehicles;
        _currentUser = currentUser;
        _db          = db;
    }

    /// <summary>
    /// Get all vehicle makes.
    /// </summary>
    [HttpGet("makes")]
    public async Task<IActionResult> GetMakes(CancellationToken ct)
    {
        var makes = await _vehicles.GetAllMakesAsync(ct);
        return Ok(makes.Select(m => new { id = m.Id, name = m.Name }));
    }

    /// <summary>
    /// Get models for a specific make, including the year range derived from published insurance plans.
    /// minYear/maxYear are null when no plans exist for that model yet.
    /// </summary>
    [HttpGet("makes/{makeId:guid}/models")]
    public async Task<IActionResult> GetModelsByMake(Guid makeId, CancellationToken ct)
    {
        var models = await _db.VehicleModels
            .Where(m => m.MakeId == makeId && !m.IsDeleted)
            .Select(m => new
            {
                id       = m.Id,
                makeId   = m.MakeId,
                makeName = m.Make.Name,
                name     = m.Name,
                subModel = m.SubModel,
                engineCC = m.EngineCC,
                gearType = m.GearType,
                // Aggregate year ranges from all published plans linked to this model
                minYear  = m.InsurancePlans.Where(p => !p.IsDeleted).Min(p => (int?)p.MinYear),
                maxYear  = m.InsurancePlans.Where(p => !p.IsDeleted).Max(p => (int?)p.MaxYear)
            })
            .OrderBy(m => m.name)
            .ToListAsync(ct);

        return Ok(models);
    }

    /// <summary>
    /// Get all vehicle models (for mapping selection).
    /// </summary>
    [HttpGet("models")]
    public async Task<IActionResult> GetAllModels(CancellationToken ct)
    {
        var models = await _vehicles.GetAllAsync(ct);
        return Ok(models.Select(m => new
        {
            id = m.Id,
            makeId = m.MakeId,
            makeName = m.Make?.Name,
            name = m.Name,
            subModel = m.SubModel,
            engineCC = m.EngineCC
        }));
    }

    public record CreateMakeRequest(string Name);

    /// <summary>
    /// Create a new vehicle make.
    /// </summary>
    [HttpPost("makes")]
    public async Task<IActionResult> CreateMake([FromBody] CreateMakeRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { error = "Make name is required." });

        var existing = await _vehicles.FindMakeByNameAsync(req.Name.Trim(), ct);
        if (existing != null)
            return Ok(new { id = existing.Id, name = existing.Name, isNew = false });

        var make = new VehicleMake { Name = req.Name.Trim(), CreatedBy = _currentUser.UserId };
        await _vehicles.AddMakeAsync(make, ct);
        await _vehicles.SaveChangesAsync(ct);
        return Ok(new { id = make.Id, name = make.Name, isNew = true });
    }

    public record CreateModelRequest(Guid MakeId, string Name, string? SubModel, string? EngineCC = null);

    /// <summary>
    /// Create a new vehicle model (optionally with sub-model / trim).
    /// </summary>
    [HttpPost("models")]
    public async Task<IActionResult> CreateModel([FromBody] CreateModelRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { error = "Model name is required." });

        var subModel = string.IsNullOrWhiteSpace(req.SubModel) ? null : req.SubModel.Trim();

        var existing = await _vehicles.FindModelAsync(req.MakeId, req.Name.Trim(), subModel, ct);
        if (existing != null)
            return Ok(new { id = existing.Id, makeId = existing.MakeId, name = existing.Name, subModel = existing.SubModel, isNew = false });

        var engineCC = string.IsNullOrWhiteSpace(req.EngineCC) ? null : req.EngineCC.Trim();

        var model = new VehicleModel
        {
            MakeId    = req.MakeId,
            Name      = req.Name.Trim(),
            SubModel  = subModel,
            EngineCC  = engineCC,
            CreatedBy = _currentUser.UserId
        };
        await _vehicles.AddModelAsync(model, ct);
        await _vehicles.SaveChangesAsync(ct);
        return Ok(new { id = model.Id, makeId = model.MakeId, name = model.Name, subModel = model.SubModel, engineCC = model.EngineCC, isNew = true });
    }
}
