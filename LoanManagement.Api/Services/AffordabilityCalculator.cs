using LoanManagement.Api.Models;

namespace LoanManagement.Api.Services;

public static class AffordabilityCalculator
{
    private const decimal PassDtiPercent = 40m;
    private const decimal MaxDtiPercent = 50m;

    public static AffordabilityAssessment Assess(
        decimal grossIncome, decimal netIncome, decimal expenses, decimal debtObligations, decimal proposedInstallment)
    {
        var disposable = netIncome - expenses - debtObligations;
        var afterLoan = disposable - proposedInstallment;
        var dti = Math.Round((debtObligations + proposedInstallment) / grossIncome * 100m, 2);
        var maxInstallment = Math.Max(0m,
            Math.Min(disposable, grossIncome * PassDtiPercent / 100m - debtObligations));

        var outcome = afterLoan < 0m || dti > MaxDtiPercent ? AffordabilityOutcome.Fail
            : dti > PassDtiPercent ? AffordabilityOutcome.Refer
            : AffordabilityOutcome.Pass;

        return new AffordabilityAssessment
        {
            GrossMonthlyIncome = grossIncome,
            NetMonthlyIncome = netIncome,
            MonthlyExpenses = expenses,
            MonthlyDebtObligations = debtObligations,
            ProposedInstallment = proposedInstallment,
            DisposableIncome = disposable,
            DisposableAfterLoan = afterLoan,
            DebtToIncomeRatio = dti,
            MaxAffordableInstallment = Math.Round(maxInstallment, 2),
            Outcome = outcome
        };
    }
}
