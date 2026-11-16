using LoanManagement.Api.Data;
using LoanManagement.Api.Dtos;
using LoanManagement.Api.Models;
using LoanManagement.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LoanManagement.Api.Controllers;

[Route("api/loan-applications/{applicationId:int}/assessments")]
public class AffordabilityAssessmentsController(AppDbContext db, ICurrentUser user) : ApiControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AssessmentResponse>>> GetAll(int applicationId, CancellationToken ct)
    {
        if (!await db.LoanApplications.AnyAsync(a => a.Id == applicationId, ct)) return NotFound();

        var assessments = await db.AffordabilityAssessments.AsNoTracking()
            .Where(a => a.LoanApplicationId == applicationId)
            .OrderByDescending(a => a.AssessedAt).ThenByDescending(a => a.Id)
            .ToListAsync(ct);
        return Ok(assessments.Select(AssessmentResponse.From));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AssessmentResponse>> Get(int applicationId, int id, CancellationToken ct)
    {
        var assessment = await db.AffordabilityAssessments.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id && a.LoanApplicationId == applicationId, ct);
        return assessment is null ? NotFound() : AssessmentResponse.From(assessment);
    }

    [HttpPost]
    public async Task<ActionResult<AssessmentResponse>> Create(int applicationId, AssessmentRequest request, CancellationToken ct)
    {
        var application = await db.LoanApplications.Include(a => a.LoanProduct)
            .FirstOrDefaultAsync(a => a.Id == applicationId, ct);
        if (application is null) return NotFound();

        if (application.Status is not (ApplicationStatus.Submitted or ApplicationStatus.UnderReview))
            return ConflictProblem($"Assessments can only be recorded for submitted applications (current status: {application.Status}).");

        var product = application.LoanProduct;
        var proposedInstallment = LoanCalculator.MonthlyPayment(
            application.RequestedAmount, product.AnnualInterestRate, application.TermMonths) + product.MonthlyServiceFee;

        var assessment = AffordabilityCalculator.Assess(
            request.GrossMonthlyIncome, request.NetMonthlyIncome, request.MonthlyExpenses,
            request.MonthlyDebtObligations, proposedInstallment);
        assessment.LoanApplicationId = applicationId;
        assessment.Notes = request.Notes?.Trim();
        assessment.AssessedBy = user.Username;

        db.AffordabilityAssessments.Add(assessment);
        db.Audit("AffordabilityAssessment.Created", assessment,
            $"Application {application.ApplicationNumber}: {assessment.Outcome}, DTI {assessment.DebtToIncomeRatio:0.00}%");
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(Get), new { applicationId, id = assessment.Id }, AssessmentResponse.From(assessment));
    }
}
