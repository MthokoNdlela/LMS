using LoanManagement.Api.Models;

namespace LoanManagement.Api.Services;

public static class ScheduleGenerator
{
    // Reducing-balance schedule: interest accrues on the remaining principal each month.
    // The service fee is charged every installment and the initiation fee is added to the first.
    public static List<RepaymentSchedule> Generate(Loan loan)
    {
        var installments = new List<RepaymentSchedule>(loan.TermMonths);
        var balance = loan.PrincipalAmount;
        var monthlyRate = loan.AnnualInterestRate / 1200m;

        for (var n = 1; n <= loan.TermMonths; n++)
        {
            var interest = Math.Round(balance * monthlyRate, 2, MidpointRounding.AwayFromZero);
            var principal = n == loan.TermMonths
                ? balance
                : Math.Min(balance, loan.MonthlyInstallment - interest);
            balance -= principal;

            installments.Add(new RepaymentSchedule
            {
                InstallmentNumber = n,
                DueDate = loan.DisbursementDate.AddMonths(n),
                PrincipalDue = principal,
                InterestDue = interest,
                FeesDue = loan.MonthlyServiceFee + (n == 1 ? loan.InitiationFee : 0m)
            });
        }

        return installments;
    }
}

public static class LoanBalances
{
    public static void Refresh(Loan loan)
    {
        loan.OutstandingPrincipal = loan.Schedule.Sum(s => s.PrincipalDue - s.PrincipalPaid);
        loan.OutstandingInterest = loan.Schedule.Sum(s => s.InterestDue - s.InterestPaid);
        loan.OutstandingFees = loan.Schedule.Sum(s => s.FeesDue - s.FeesPaid);
    }
}

public static class ArrearsCalculator
{
    public static (decimal Amount, int Days) Calculate(IEnumerable<RepaymentSchedule> schedule, DateOnly today)
    {
        var overdue = schedule.Where(s => s.DueDate < today && s.Outstanding > 0).ToList();
        if (overdue.Count == 0) return (0m, 0);
        return (overdue.Sum(s => s.Outstanding), today.DayNumber - overdue.Min(s => s.DueDate).DayNumber);
    }
}
