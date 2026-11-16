using LoanManagement.Api.Data;
using LoanManagement.Api.Dtos;
using LoanManagement.Api.Models;
using LoanManagement.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LoanManagement.Api.Controllers;

[Route("api/loan-applications")]
public class LoanApplicationsController(AppDbContext db, ICurrentUser user) : ApiControllerBase
{
    private static readonly DocumentType[] RequiredDocuments =
        [DocumentType.IdDocument, DocumentType.ProofOfAddress, DocumentType.ProofOfIncome];

    private IQueryable<LoanApplication> Applications =>
        db.LoanApplications.Include(a => a.Customer).Include(a => a.LoanProduct).Include(a => a.Loan);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<LoanApplicationResponse>>> GetAll(
        [FromQuery] int? customerId, [FromQuery] ApplicationStatus? status, CancellationToken ct)
    {
        var query = Applications.AsNoTracking();
        if (customerId is not null) query = query.Where(a => a.CustomerId == customerId);
        if (status is not null) query = query.Where(a => a.Status == status);

        var applications = await query.OrderByDescending(a => a.CreatedAt).ToListAsync(ct);
        return Ok(applications.Select(LoanApplicationResponse.From));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<LoanApplicationResponse>> Get(int id, CancellationToken ct)
    {
        var application = await Applications.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id, ct);
        return application is null ? NotFound() : LoanApplicationResponse.From(application);
    }

    [HttpPost]
    public async Task<ActionResult<LoanApplicationResponse>> Create(LoanApplicationRequest request, CancellationToken ct)
    {
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId, ct);
        if (customer is null) return Invalid(nameof(request.CustomerId), "Customer does not exist.");

        var product = await db.LoanProducts.FirstOrDefaultAsync(p => p.Id == request.LoanProductId, ct);
        if (product is null) return Invalid(nameof(request.LoanProductId), "Loan product does not exist.");
        if (!product.IsActive) return Invalid(nameof(request.LoanProductId), "Loan product is not active.");
        if (CheckProductLimits(product, request.RequestedAmount, request.TermMonths) is { } invalid) return invalid;

        var application = new LoanApplication
        {
            ApplicationNumber = await NumberGenerator.NextApplicationNumber(db, ct),
            Customer = customer,
            LoanProduct = product,
            RequestedAmount = request.RequestedAmount,
            TermMonths = request.TermMonths,
            Purpose = request.Purpose?.Trim()
        };
        db.LoanApplications.Add(application);
        db.Audit("LoanApplication.Created", application,
            $"{application.ApplicationNumber}: {application.RequestedAmount:0.00} over {application.TermMonths} months");
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(Get), new { id = application.Id }, LoanApplicationResponse.From(application));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<LoanApplicationResponse>> Update(int id, LoanApplicationRequest request, CancellationToken ct)
    {
        var application = await Applications.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (application is null) return NotFound();
        if (application.Status != ApplicationStatus.Draft) return ConflictProblem("Only draft applications can be edited.");
        if (request.CustomerId != application.CustomerId)
            return Invalid(nameof(request.CustomerId), "An application cannot be moved to another customer.");

        var product = await db.LoanProducts.FirstOrDefaultAsync(p => p.Id == request.LoanProductId, ct);
        if (product is null) return Invalid(nameof(request.LoanProductId), "Loan product does not exist.");
        if (!product.IsActive) return Invalid(nameof(request.LoanProductId), "Loan product is not active.");
        if (CheckProductLimits(product, request.RequestedAmount, request.TermMonths) is { } invalid) return invalid;

        application.LoanProduct = product;
        application.RequestedAmount = request.RequestedAmount;
        application.TermMonths = request.TermMonths;
        application.Purpose = request.Purpose?.Trim();
        db.Audit("LoanApplication.Updated", application);
        await db.SaveChangesAsync(ct);

        return LoanApplicationResponse.From(application);
    }

    [HttpPost("{id:int}/submit")]
    public Task<ActionResult<LoanApplicationResponse>> Submit(int id, CancellationToken ct) =>
        Transition(id, [ApplicationStatus.Draft], ApplicationStatus.Submitted, "LoanApplication.Submitted", ct,
            a => a.SubmittedAt = DateTime.UtcNow);

    [HttpPost("{id:int}/review")]
    public Task<ActionResult<LoanApplicationResponse>> StartReview(int id, CancellationToken ct) =>
        Transition(id, [ApplicationStatus.Submitted], ApplicationStatus.UnderReview, "LoanApplication.ReviewStarted", ct);

    [HttpPost("{id:int}/withdraw")]
    public Task<ActionResult<LoanApplicationResponse>> Withdraw(int id, CancellationToken ct) =>
        Transition(id, [ApplicationStatus.Draft, ApplicationStatus.Submitted, ApplicationStatus.UnderReview],
            ApplicationStatus.Withdrawn, "LoanApplication.Withdrawn", ct);

    // Declining needs a reason. Approving requires verified documents and a passing (or referred) affordability
    // assessment, then creates the loan and its repayment schedule in the same transaction.
    [HttpPost("{id:int}/decision")]
    public async Task<ActionResult<LoanApplicationResponse>> Decide(int id, ApplicationDecisionRequest request, CancellationToken ct)
    {
        var application = await Applications.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (application is null) return NotFound();
        if (application.Status != ApplicationStatus.UnderReview)
            return ConflictProblem($"Only applications under review can be decided (current status: {application.Status}).");

        var reason = request.Reason?.Trim();

        if (request.Approved != true)
        {
            application.Status = ApplicationStatus.Declined;
            application.DecidedAt = DateTime.UtcNow;
            application.DecidedBy = user.Username;
            application.DecisionReason = reason;
            db.Audit("LoanApplication.Declined", application, reason);
            await db.SaveChangesAsync(ct);
            return LoanApplicationResponse.From(application);
        }

        var disbursement = request.DisbursementDate ?? Today;
        if (disbursement < Today) return Invalid(nameof(request.DisbursementDate), "Disbursement date cannot be in the past.");

        var product = application.LoanProduct;
        if (CheckProductLimits(product, application.RequestedAmount, application.TermMonths) is { } invalid) return invalid;

        var verified = await db.CustomerDocuments
            .Where(d => d.CustomerId == application.CustomerId && d.Status == DocumentStatus.Verified)
            .Select(d => d.Type).Distinct().ToListAsync(ct);
        var missing = RequiredDocuments.Except(verified).ToList();
        if (missing.Count > 0)
            return ConflictProblem($"Missing verified documents: {string.Join(", ", missing)}.");

        var assessment = await db.AffordabilityAssessments
            .Where(a => a.LoanApplicationId == id)
            .OrderByDescending(a => a.AssessedAt).ThenByDescending(a => a.Id)
            .FirstOrDefaultAsync(ct);
        if (assessment is null) return ConflictProblem("An affordability assessment is required before approval.");
        if (assessment.Outcome == AffordabilityOutcome.Fail)
            return ConflictProblem("The latest affordability assessment failed. Decline the application or reassess.");
        if (assessment.Outcome == AffordabilityOutcome.Refer && string.IsNullOrWhiteSpace(reason))
            return Invalid(nameof(request.Reason), "A reason is required to approve a referred assessment.");

        var loan = new Loan
        {
            LoanNumber = await NumberGenerator.NextLoanNumber(db, ct),
            LoanApplication = application,
            CustomerId = application.CustomerId,
            LoanProductId = product.Id,
            PrincipalAmount = application.RequestedAmount,
            AnnualInterestRate = product.AnnualInterestRate,
            TermMonths = application.TermMonths,
            InitiationFee = LoanCalculator.InitiationFee(application.RequestedAmount, product),
            MonthlyServiceFee = product.MonthlyServiceFee,
            LateFeeAmount = product.LateFeeAmount,
            ArrearsGraceDays = product.ArrearsGraceDays,
            MonthlyInstallment = LoanCalculator.MonthlyPayment(
                application.RequestedAmount, product.AnnualInterestRate, application.TermMonths),
            DisbursementDate = disbursement,
            FirstDueDate = disbursement.AddMonths(1),
            MaturityDate = disbursement.AddMonths(application.TermMonths)
        };
        loan.Schedule = ScheduleGenerator.Generate(loan);
        LoanBalances.Refresh(loan);
        db.Loans.Add(loan);

        application.Status = ApplicationStatus.Approved;
        application.DecidedAt = DateTime.UtcNow;
        application.DecidedBy = user.Username;
        application.DecisionReason = reason;
        db.Audit("LoanApplication.Approved", application, reason);
        db.Audit("Loan.Created", loan,
            $"{loan.LoanNumber}: {loan.PrincipalAmount:0.00} over {loan.TermMonths} months from application {application.ApplicationNumber}");
        await db.SaveChangesAsync(ct);

        return LoanApplicationResponse.From(application);
    }

    private async Task<ActionResult<LoanApplicationResponse>> Transition(
        int id, ApplicationStatus[] from, ApplicationStatus to, string action, CancellationToken ct,
        Action<LoanApplication>? apply = null)
    {
        var application = await Applications.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (application is null) return NotFound();
        if (!from.Contains(application.Status))
            return ConflictProblem($"Cannot move an application from {application.Status} to {to}.");

        application.Status = to;
        apply?.Invoke(application);
        db.Audit(action, application);
        await db.SaveChangesAsync(ct);

        return LoanApplicationResponse.From(application);
    }

    private ActionResult? CheckProductLimits(LoanProduct product, decimal amount, int termMonths)
    {
        if (amount < product.MinAmount || amount > product.MaxAmount)
            ModelState.AddModelError(nameof(LoanApplicationRequest.RequestedAmount),
                $"Amount must be between {product.MinAmount:0.00} and {product.MaxAmount:0.00} for {product.Name}.");
        if (termMonths < product.MinTermMonths || termMonths > product.MaxTermMonths)
            ModelState.AddModelError(nameof(LoanApplicationRequest.TermMonths),
                $"Term must be between {product.MinTermMonths} and {product.MaxTermMonths} months for {product.Name}.");

        return ModelState.IsValid ? null : ValidationProblem(ModelState);
    }
}
