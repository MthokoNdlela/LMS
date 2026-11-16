using LoanManagement.Api.Data;
using LoanManagement.Api.Dtos;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LoanManagement.Api.Controllers;

// Read-only: audit entries are written by the API when important changes and decisions happen.
[Route("api/audit-logs")]
public class AuditLogsController(AppDbContext db) : ApiControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AuditLogResponse>>> GetAll(
        [FromQuery] string? entityType, [FromQuery] int? entityId, [FromQuery] string? username,
        [FromQuery] string? action, [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] int take = 100, CancellationToken ct = default)
    {
        var query = db.AuditLogs.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(entityType)) query = query.Where(a => a.EntityType == entityType);
        if (entityId is not null) query = query.Where(a => a.EntityId == entityId);
        if (!string.IsNullOrWhiteSpace(username)) query = query.Where(a => a.Username == username);
        if (!string.IsNullOrWhiteSpace(action)) query = query.Where(a => a.Action.StartsWith(action));
        if (from is not null) query = query.Where(a => a.Timestamp >= from);
        if (to is not null) query = query.Where(a => a.Timestamp <= to);

        var logs = await query.OrderByDescending(a => a.Timestamp).ThenByDescending(a => a.Id)
            .Take(Math.Clamp(take, 1, 500)).ToListAsync(ct);
        return Ok(logs.Select(AuditLogResponse.From));
    }
}
