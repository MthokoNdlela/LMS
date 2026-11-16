namespace LoanManagement.Api.Models;

public enum AffordabilityOutcome
{
    Pass,
    Refer,
    Fail
}

// Inputs plus the calculated snapshot at the time of assessment. An application can be reassessed; the latest row counts.
public class AffordabilityAssessment
{
    public int Id { get; set; }
    public int LoanApplicationId { get; set; }
    public LoanApplication LoanApplication { get; set; } = null!;

    public decimal GrossMonthlyIncome { get; set; }
    public decimal NetMonthlyIncome { get; set; }
    public decimal MonthlyExpenses { get; set; }
    public decimal MonthlyDebtObligations { get; set; }

    public decimal ProposedInstallment { get; set; }
    public decimal DisposableIncome { get; set; }
    public decimal DisposableAfterLoan { get; set; }
    public decimal DebtToIncomeRatio { get; set; }
    public decimal MaxAffordableInstallment { get; set; }

    // The instalment re-calculated at the product rate plus the stress margin.
    public decimal StressedInstallment { get; set; }
    public decimal StressedDisposableAfterLoan { get; set; }
    public bool? StressTestPassed { get; set; }

    public int? BureauScore { get; set; }
    public bool? BureauHasAdverseListing { get; set; }
    public string? BureauReference { get; set; }
    public AffordabilityOutcome? BureauOutcome { get; set; }

    public AffordabilityOutcome Outcome { get; set; }
    // Why the outcome is not a clean pass, one reason per failed or referred check.
    public string? OutcomeReasons { get; set; }

    public string? Notes { get; set; }
    public DateTime AssessedAt { get; set; } = DateTime.UtcNow;
    public string? AssessedBy { get; set; }
}
