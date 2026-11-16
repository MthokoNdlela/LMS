using LoanManagement.Api.Data;
using LoanManagement.Api.Dtos;
using LoanManagement.Api.Models;
using LoanManagement.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LoanManagement.Api.Controllers;

public record LateFeeResult(int InstallmentsCharged, decimal FeesCharged, LoanResponse Loan);

// Loans are created by approving a loan application; they are never created or deleted directly.
[Route("api/[controller]")]
public class LoansController(AppDbContext db) : ApiControllerBase
{
    private IQueryable<Loan> Loans =>
        db.Loans.Include(l => l.Customer).Include(l => l.LoanProduct).Include(l => l.Schedule);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<LoanResponse>>> GetAll(
        [FromQuery] int? customerId, [FromQuery] LoanStatus? status, [FromQuery] bool? inArrears, CancellationToken ct)
    {
        var query = Loans.AsNoTracking();
        if (customerId is not null) query = query.Where(l => l.CustomerId == customerId);
        if (status is not null) query = query.Where(l => l.Status == status);

        var today = Today;
        var loans = (await query.OrderByDescending(l => l.CreatedAt).ToListAsync(ct))
            .Select(l => LoanResponse.From(l, today));
        if (inArrears is not null) loans = loans.Where(l => (l.ArrearsAmount > 0) == inArrears);

        return Ok(loans.ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<LoanResponse>> Get(int id, CancellationToken ct)
    {
        var loan = await Loans.AsNoTracking().FirstOrDefaultAsync(l => l.Id == id, ct);
        return loan is null ? NotFound() : LoanResponse.From(loan, Today);
    }

    [HttpGet("{id:int}/schedule")]
    public async Task<ActionResult<IEnumerable<ScheduleResponse>>> GetSchedule(int id, CancellationToken ct)
    {
        if (!await db.Loans.AnyAsync(l => l.Id == id, ct)) return NotFound();

        var schedule = await db.RepaymentSchedules.AsNoTracking()
            .Where(s => s.LoanId == id).OrderBy(s => s.InstallmentNumber).ToListAsync(ct);
        var today = Today;
        return Ok(schedule.Select(s => ScheduleResponse.From(s, today)));
    }

    // Allowed: Active -> Defaulted, Defaulted -> Active, Defaulted -> WrittenOff. Settled is set by payments.
    [HttpPost("{id:int}/status")]
    public async Task<ActionResult<LoanResponse>> UpdateStatus(int id, LoanStatusRequest request, CancellationToken ct)
    {
        var loan = await Loans.FirstOrDefaultAsync(l => l.Id == id, ct);
        if (loan is null) return NotFound();

        var target = request.Status!.Value;
        var allowed = (loan.Status, target) is
            (LoanStatus.Active, LoanStatus.Defaulted) or
            (LoanStatus.Defaulted, LoanStatus.Active) or
            (LoanStatus.Defaulted, LoanStatus.WrittenOff);
        if (!allowed) return ConflictProblem($"Cannot change loan status from {loan.Status} to {target}.");

        if (target is LoanStatus.Defaulted or LoanStatus.WrittenOff && string.IsNullOrWhiteSpace(request.Reason))
            return Invalid(nameof(request.Reason), $"A reason is required to mark a loan as {target}.");

        var previous = loan.Status;
        loan.Status = target;
        db.Audit("Loan.StatusChanged", loan, $"{previous} -> {target}. {request.Reason}".Trim());
        if (await TrySave(ct) is { } conflict) return conflict;

        return LoanResponse.From(loan, Today);
    }

    // Adds the product's late fee to each installment that is past its grace period and still unpaid.
    [HttpPost("{id:int}/late-fees")]
    public async Task<ActionResult<LateFeeResult>> AssessLateFees(int id, CancellationToken ct)
    {
        var loan = await Loans.FirstOrDefaultAsync(l => l.Id == id, ct);
        if (loan is null) return NotFound();
        if (loan.Status is not (LoanStatus.Active or LoanStatus.Defaulted))
            return ConflictProblem($"Late fees cannot be assessed on a {loan.Status} loan.");

        var today = Today;
        var due = loan.LateFeeAmount <= 0m
            ? []
            : loan.Schedule.Where(s => !s.LateFeeCharged && s.Outstanding > 0
                && s.DueDate.AddDays(loan.ArrearsGraceDays) < today).ToList();

        foreach (var installment in due)
        {
            installment.FeesDue += loan.LateFeeAmount;
            installment.LateFeeCharged = true;
            if (installment.Status == InstallmentStatus.Paid) installment.Status = InstallmentStatus.PartiallyPaid;
        }

        var total = due.Count * loan.LateFeeAmount;
        if (due.Count > 0)
        {
            LoanBalances.Refresh(loan);
            db.Audit("Loan.LateFeesAssessed", loan, $"{due.Count} installment(s), {total:0.00} in late fees");
            if (await TrySave(ct) is { } conflict) return conflict;
        }

        return new LateFeeResult(due.Count, total, LoanResponse.From(loan, today));
    }

    private async Task<ObjectResult?> TrySave(CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
            return null;
        }
        catch (DbUpdateConcurrencyException)
        {
            return ConflictProblem("The loan was modified by another request. Reload it and try again.");
        }
    }
}
