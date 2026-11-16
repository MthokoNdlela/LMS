using LoanManagement.Api.Data;
using LoanManagement.Api.Dtos;
using LoanManagement.Api.Models;
using LoanManagement.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LoanManagement.Api.Controllers;

// Payments are append-only: they are allocated to the schedule when received and are never edited or deleted.
[Route("api/[controller]")]
public class PaymentsController(AppDbContext db, ICurrentUser user) : ApiControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PaymentResponse>>> GetAll([FromQuery] int? loanId, CancellationToken ct)
    {
        var query = db.Payments.AsNoTracking();
        if (loanId is not null) query = query.Where(p => p.LoanId == loanId);

        var payments = await query.OrderByDescending(p => p.PaymentDate).ThenByDescending(p => p.Id).ToListAsync(ct);
        return Ok(payments.Select(p => PaymentResponse.From(p)));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PaymentResponse>> Get(int id, CancellationToken ct)
    {
        var payment = await db.Payments.AsNoTracking()
            .Include(p => p.Allocations).ThenInclude(a => a.RepaymentSchedule)
            .FirstOrDefaultAsync(p => p.Id == id, ct);
        return payment is null ? NotFound() : PaymentResponse.From(payment, includeAllocations: true);
    }

    [HttpPost]
    public async Task<ActionResult<PaymentResponse>> Create(PaymentRequest request, CancellationToken ct)
    {
        var loan = await db.Loans.Include(l => l.Schedule).FirstOrDefaultAsync(l => l.Id == request.LoanId, ct);
        if (loan is null) return Invalid(nameof(request.LoanId), "Loan does not exist.");

        if (loan.Status is not (LoanStatus.Active or LoanStatus.Defaulted))
            return ConflictProblem($"Payments cannot be made on a {loan.Status} loan.");

        if (decimal.Round(request.Amount, 2) != request.Amount)
            return Invalid(nameof(request.Amount), "Amount cannot have more than two decimal places.");

        var paymentDate = request.PaymentDate ?? Today;
        if (paymentDate > Today) return Invalid(nameof(request.PaymentDate), "Payment date cannot be in the future.");
        if (paymentDate < loan.DisbursementDate)
            return Invalid(nameof(request.PaymentDate), "Payment date cannot be before the loan was disbursed.");

        var outstanding = loan.Schedule.Sum(s => s.Outstanding);
        if (request.Amount > outstanding)
            return Invalid(nameof(request.Amount), $"Amount exceeds the outstanding balance of {outstanding:0.00}.");

        var allocations = PaymentAllocator.Allocate(loan.Schedule, request.Amount, paymentDate);
        var payment = new Payment
        {
            Loan = loan,
            Amount = request.Amount,
            PaymentDate = paymentDate,
            Method = request.Method,
            Reference = request.Reference?.Trim(),
            FeesAllocated = allocations.Sum(a => a.FeesAmount),
            InterestAllocated = allocations.Sum(a => a.InterestAmount),
            PrincipalAllocated = allocations.Sum(a => a.PrincipalAmount),
            ReceivedBy = user.Username,
            Allocations = allocations
        };
        db.Payments.Add(payment);

        LoanBalances.Refresh(loan);
        db.Audit("Payment.Received", payment,
            $"Loan {loan.LoanNumber}: {payment.Amount:0.00} (fees {payment.FeesAllocated:0.00}, interest {payment.InterestAllocated:0.00}, principal {payment.PrincipalAllocated:0.00})");
        if (loan.TotalOutstanding == 0m)
        {
            loan.Status = LoanStatus.Settled;
            db.Audit("Loan.Settled", loan, $"Fully repaid by payment of {payment.Amount:0.00}");
        }

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return ConflictProblem("The loan was modified by another request. Reload it and try again.");
        }

        return CreatedAtAction(nameof(Get), new { id = payment.Id }, PaymentResponse.From(payment, includeAllocations: true));
    }
}
