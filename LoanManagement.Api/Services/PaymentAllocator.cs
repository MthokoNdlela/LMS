using LoanManagement.Api.Models;

namespace LoanManagement.Api.Services;

public static class PaymentAllocator
{
    // Fills the oldest unpaid installment first (prepayments flow to the next one).
    // Inside an installment the order is fees, then interest, then principal.
    public static List<PaymentAllocation> Allocate(IEnumerable<RepaymentSchedule> schedule, decimal amount, DateOnly paymentDate)
    {
        var allocations = new List<PaymentAllocation>();
        var remaining = amount;

        foreach (var installment in schedule.OrderBy(s => s.InstallmentNumber))
        {
            if (remaining <= 0m) break;

            var fees = Math.Min(remaining, installment.FeesDue - installment.FeesPaid);
            remaining -= fees;
            var interest = Math.Min(remaining, installment.InterestDue - installment.InterestPaid);
            remaining -= interest;
            var principal = Math.Min(remaining, installment.PrincipalDue - installment.PrincipalPaid);
            remaining -= principal;

            if (fees + interest + principal == 0m) continue;

            installment.FeesPaid += fees;
            installment.InterestPaid += interest;
            installment.PrincipalPaid += principal;
            installment.LastPaidDate = paymentDate;
            installment.Status = installment.Outstanding == 0m ? InstallmentStatus.Paid : InstallmentStatus.PartiallyPaid;

            allocations.Add(new PaymentAllocation
            {
                RepaymentSchedule = installment,
                FeesAmount = fees,
                InterestAmount = interest,
                PrincipalAmount = principal
            });
        }

        return allocations;
    }
}
