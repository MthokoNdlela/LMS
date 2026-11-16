using System.ComponentModel.DataAnnotations;
using LoanManagement.Api.Models;

namespace LoanManagement.Api.Dtos;

public class LoanApplicationRequest
{
    [Range(1, int.MaxValue)] public int CustomerId { get; set; }
    [Range(1, int.MaxValue)] public int LoanProductId { get; set; }
    [Range(0.01d, 1_000_000_000d)] public decimal RequestedAmount { get; set; }
    [Range(1, 600)] public int TermMonths { get; set; }
    [StringLength(500)] public string? Purpose { get; set; }
}

public class ApplicationDecisionRequest : IValidatableObject
{
    [Required] public bool? Approved { get; set; }
    [StringLength(1000)] public string? Reason { get; set; }
    public DateOnly? DisbursementDate { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Approved == false && string.IsNullOrWhiteSpace(Reason))
            yield return new ValidationResult("A reason is required when declining.", [nameof(Reason)]);
    }
}

public record LoanApplicationResponse(
    int Id, string ApplicationNumber, int CustomerId, string CustomerName, int LoanProductId, string ProductName,
    decimal RequestedAmount, int TermMonths, string? Purpose, ApplicationStatus Status, DateTime? SubmittedAt,
    DateTime? DecidedAt, string? DecidedBy, string? DecisionReason, DateTime CreatedAt, int? LoanId)
{
    // Expects Customer, LoanProduct and Loan to be loaded.
    public static LoanApplicationResponse From(LoanApplication a) =>
        new(a.Id, a.ApplicationNumber, a.CustomerId, $"{a.Customer.FirstName} {a.Customer.LastName}",
            a.LoanProductId, a.LoanProduct.Name, a.RequestedAmount, a.TermMonths, a.Purpose, a.Status,
            a.SubmittedAt, a.DecidedAt, a.DecidedBy, a.DecisionReason, a.CreatedAt, a.Loan?.Id);
}

public class AssessmentRequest : IValidatableObject
{
    [Range(0.01d, 1_000_000_000d)] public decimal GrossMonthlyIncome { get; set; }
    [Range(0d, 1_000_000_000d)] public decimal NetMonthlyIncome { get; set; }
    [Range(0d, 1_000_000_000d)] public decimal MonthlyExpenses { get; set; }
    [Range(0d, 1_000_000_000d)] public decimal MonthlyDebtObligations { get; set; }
    [StringLength(1000)] public string? Notes { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (NetMonthlyIncome > GrossMonthlyIncome)
            yield return new ValidationResult("Net income cannot exceed gross income.", [nameof(NetMonthlyIncome)]);
    }
}

public record AssessmentResponse(
    int Id, int LoanApplicationId, decimal GrossMonthlyIncome, decimal NetMonthlyIncome, decimal MonthlyExpenses,
    decimal MonthlyDebtObligations, decimal ProposedInstallment, decimal DisposableIncome, decimal DisposableAfterLoan,
    decimal DebtToIncomeRatio, decimal MaxAffordableInstallment, AffordabilityOutcome Outcome, string? Notes,
    DateTime AssessedAt, string? AssessedBy, decimal StressedInstallment, decimal StressedDisposableAfterLoan,
    bool? StressTestPassed, int? BureauScore, bool? BureauHasAdverseListing, string? BureauReference,
    AffordabilityOutcome? BureauOutcome, string? OutcomeReasons)
{
    public static AssessmentResponse From(AffordabilityAssessment a) =>
        new(a.Id, a.LoanApplicationId, a.GrossMonthlyIncome, a.NetMonthlyIncome, a.MonthlyExpenses,
            a.MonthlyDebtObligations, a.ProposedInstallment, a.DisposableIncome, a.DisposableAfterLoan,
            a.DebtToIncomeRatio, a.MaxAffordableInstallment, a.Outcome, a.Notes, a.AssessedAt, a.AssessedBy,
            a.StressedInstallment, a.StressedDisposableAfterLoan, a.StressTestPassed, a.BureauScore,
            a.BureauHasAdverseListing, a.BureauReference, a.BureauOutcome, a.OutcomeReasons);
}
