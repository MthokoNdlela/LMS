using LoanManagement.Api.Data;
using LoanManagement.Api.Dtos;
using LoanManagement.Api.Models;
using LoanManagement.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LoanManagement.Api.Controllers;

[Route("api/collection-activities")]
public class CollectionActivitiesController(AppDbContext db, ICurrentUser user) : ApiControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<CollectionActivityResponse>>> GetAll(
        [FromQuery] int? loanId, [FromQuery] CollectionActivityType? type, CancellationToken ct)
    {
        var query = db.CollectionActivities.AsNoTracking();
        if (loanId is not null) query = query.Where(c => c.LoanId == loanId);
        if (type is not null) query = query.Where(c => c.ActivityType == type);

        var activities = await query.OrderByDescending(c => c.ActivityDate).ThenByDescending(c => c.Id).ToListAsync(ct);
        return Ok(activities.Select(CollectionActivityResponse.From));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CollectionActivityResponse>> Get(int id, CancellationToken ct)
    {
        var activity = await db.CollectionActivities.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct);
        return activity is null ? NotFound() : CollectionActivityResponse.From(activity);
    }

    [HttpPost]
    public async Task<ActionResult<CollectionActivityResponse>> Create(CollectionActivityRequest request, CancellationToken ct)
    {
        var loan = await db.Loans.Include(l => l.Schedule).FirstOrDefaultAsync(l => l.Id == request.LoanId, ct);
        if (loan is null) return Invalid(nameof(request.LoanId), "Loan does not exist.");
        if (loan.Status is not (LoanStatus.Active or LoanStatus.Defaulted))
            return ConflictProblem($"Collection activity cannot be logged on a {loan.Status} loan.");

        var type = request.ActivityType!.Value;
        var isPromise = type == CollectionActivityType.PromiseToPay;
        if (isPromise && request.PromisedDate < Today)
            return Invalid(nameof(request.PromisedDate), "Promised date cannot be in the past.");

        var (arrears, days) = ArrearsCalculator.Calculate(loan.Schedule, Today);
        var activity = new CollectionActivity
        {
            LoanId = loan.Id,
            ActivityType = type,
            ActivityDate = request.ActivityDate ?? DateTime.UtcNow,
            Outcome = request.Outcome?.Trim(),
            Notes = request.Notes?.Trim(),
            PromisedAmount = isPromise ? request.PromisedAmount : null,
            PromisedDate = isPromise ? request.PromisedDate : null,
            PromiseStatus = isPromise ? PromiseStatus.Open : null,
            ArrearsAmount = arrears,
            DaysInArrears = days,
            CreatedBy = user.Username
        };
        db.CollectionActivities.Add(activity);
        db.Audit("CollectionActivity.Logged", activity,
            $"Loan {loan.LoanNumber}: {type}, arrears {arrears:0.00} ({days} days)");
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(Get), new { id = activity.Id }, CollectionActivityResponse.From(activity));
    }

    [HttpPost("{id:int}/promise-status")]
    public async Task<ActionResult<CollectionActivityResponse>> UpdatePromiseStatus(
        int id, PromiseStatusRequest request, CancellationToken ct)
    {
        var activity = await db.CollectionActivities.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (activity is null) return NotFound();
        if (activity.ActivityType != CollectionActivityType.PromiseToPay)
            return ConflictProblem("Only promise-to-pay activities have a promise status.");
        if (activity.PromiseStatus != PromiseStatus.Open)
            return ConflictProblem($"This promise is already {activity.PromiseStatus}.");

        var status = request.Status!.Value;
        if (status == PromiseStatus.Open) return Invalid(nameof(request.Status), "Mark the promise as Kept or Broken.");

        activity.PromiseStatus = status;
        db.Audit("CollectionActivity.PromiseStatusChanged", activity, $"Open -> {status}");
        await db.SaveChangesAsync(ct);

        return CollectionActivityResponse.From(activity);
    }
}
