using LoanManagement.Api.Models;

namespace LoanManagement.Api.Services;

public record AffordabilityInputs(
    decimal GrossIncome, decimal NetIncome, decimal Expenses, decimal DebtObligations,
    decimal Principal, int TermMonths);

public static class AffordabilityCalculator
{
    private const decimal PassDtiPercent = 40m;
    private const decimal MaxDtiPercent = 50m;

    // Runs three checks and keeps the worst result (Fail > Refer > Pass):
    //  1. Debt-to-income ratio, and the instalment must fit within disposable income.
    //  2. Stress test: the instalment at the product rate plus a margin must still fit within disposable income.
    //  3. Credit bureau: score below the minimum fails, below the refer score or any adverse listing refers.
    public static AffordabilityAssessment Assess(AffordabilityInputs input, LoanProduct product, BureauResult bureau)
    {
        var installment = LoanCalculator.MonthlyPayment(input.Principal, product.AnnualInterestRate, input.TermMonths)
            + product.MonthlyServiceFee;
        var stressedInstallment = LoanCalculator.MonthlyPayment(
            input.Principal, product.AnnualInterestRate + product.StressTestRatePoints, input.TermMonths)
            + product.MonthlyServiceFee;

        var disposable = input.NetIncome - input.Expenses - input.DebtObligations;
        var afterLoan = disposable - installment;
        var stressedAfterLoan = disposable - stressedInstallment;
        var dti = Math.Round((input.DebtObligations + installment) / input.GrossIncome * 100m, 2);
        var maxInstallment = Math.Max(0m, Math.Min(disposable, input.GrossIncome * PassDtiPercent / 100m - input.DebtObligations));

        var reasons = new List<string>();
        var outcome = AffordabilityOutcome.Pass;

        void Raise(AffordabilityOutcome level, string reason)
        {
            reasons.Add(reason);
            if (level > outcome) outcome = level;
        }

        if (afterLoan < 0m)
            Raise(AffordabilityOutcome.Fail,
                $"The instalment of {installment:0.00} is more than the disposable income of {disposable:0.00}.");

        if (dti > MaxDtiPercent)
            Raise(AffordabilityOutcome.Fail, $"Debt-to-income {dti:0.00}% is above {MaxDtiPercent:0}%.");
        else if (dti > PassDtiPercent)
            Raise(AffordabilityOutcome.Refer, $"Debt-to-income {dti:0.00}% is above {PassDtiPercent:0}%.");

        var stressPassed = stressedAfterLoan >= 0m;
        if (!stressPassed)
            Raise(AffordabilityOutcome.Refer,
                $"At {product.AnnualInterestRate + product.StressTestRatePoints:0.##}% (+{product.StressTestRatePoints:0.##} points) the instalment is {stressedInstallment:0.00}, which is more than the disposable income of {disposable:0.00}.");

        var bureauOutcome = AffordabilityOutcome.Pass;
        if (bureau.Score < product.BureauMinScore)
        {
            bureauOutcome = AffordabilityOutcome.Fail;
            Raise(bureauOutcome, $"Bureau score {bureau.Score} is below the minimum of {product.BureauMinScore}.");
        }
        else if (bureau.Score < product.BureauReferScore)
        {
            bureauOutcome = AffordabilityOutcome.Refer;
            Raise(bureauOutcome, $"Bureau score {bureau.Score} is below {product.BureauReferScore}.");
        }

        if (bureau.HasAdverseListing)
        {
            if (bureauOutcome == AffordabilityOutcome.Pass) bureauOutcome = AffordabilityOutcome.Refer;
            Raise(AffordabilityOutcome.Refer, "The credit bureau reports an adverse listing.");
        }

        return new AffordabilityAssessment
        {
            GrossMonthlyIncome = input.GrossIncome,
            NetMonthlyIncome = input.NetIncome,
            MonthlyExpenses = input.Expenses,
            MonthlyDebtObligations = input.DebtObligations,
            ProposedInstallment = installment,
            DisposableIncome = disposable,
            DisposableAfterLoan = afterLoan,
            DebtToIncomeRatio = dti,
            MaxAffordableInstallment = Math.Round(maxInstallment, 2),
            StressedInstallment = stressedInstallment,
            StressedDisposableAfterLoan = stressedAfterLoan,
            StressTestPassed = stressPassed,
            BureauScore = bureau.Score,
            BureauHasAdverseListing = bureau.HasAdverseListing,
            BureauReference = bureau.Reference,
            BureauOutcome = bureauOutcome,
            Outcome = outcome,
            OutcomeReasons = reasons.Count == 0 ? null : string.Join(" ", reasons)
        };
    }
}
