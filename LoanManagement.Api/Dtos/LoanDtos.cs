using System.ComponentModel.DataAnnotations;
using LoanManagement.Api.Models;
using LoanManagement.Api.Services;

namespace LoanManagement.Api.Dtos;

public class LoanStatusRequest
{
    [Required] public LoanStatus? Status { get; set; }
    [StringLength(500)] public string? Reason { get; set; }
}

public record LoanResponse(
    int Id, string LoanNumber, int LoanApplicationId, int CustomerId, string CustomerName, int LoanProductId,
    string ProductName, decimal PrincipalAmount, decimal AnnualInterestRate, int TermMonths, decimal InitiationFee,
    decimal MonthlyServiceFee, decimal MonthlyInstallment, DateOnly DisbursementDate, DateOnly FirstDueDate,
    DateOnly MaturityDate, LoanStatus Status, decimal OutstandingPrincipal, decimal OutstandingInterest,
    decimal OutstandingFees, decimal TotalOutstanding, decimal ArrearsAmount, int DaysInArrears, DateTime CreatedAt)
{
    // Expects Customer, LoanProduct and Schedule to be loaded.
    public static LoanResponse From(Loan l, DateOnly today)
    {
        var (arrears, days) = ArrearsCalculator.Calculate(l.Schedule, today);
        return new(l.Id, l.LoanNumber, l.LoanApplicationId, l.CustomerId,
            $"{l.Customer.FirstName} {l.Customer.LastName}", l.LoanProductId, l.LoanProduct.Name, l.PrincipalAmount,
            l.AnnualInterestRate, l.TermMonths, l.InitiationFee, l.MonthlyServiceFee, l.MonthlyInstallment,
            l.DisbursementDate, l.FirstDueDate, l.MaturityDate, l.Status, l.OutstandingPrincipal,
            l.OutstandingInterest, l.OutstandingFees, l.TotalOutstanding, arrears, days, l.CreatedAt);
    }
}

public record ScheduleResponse(
    int Id, int InstallmentNumber, DateOnly DueDate, decimal PrincipalDue, decimal InterestDue, decimal FeesDue,
    decimal TotalDue, decimal PrincipalPaid, decimal InterestPaid, decimal FeesPaid, decimal TotalPaid,
    decimal Outstanding, InstallmentStatus Status, bool LateFeeCharged, bool IsOverdue, int DaysOverdue,
    DateOnly? LastPaidDate)
{
    public static ScheduleResponse From(RepaymentSchedule s, DateOnly today)
    {
        var overdue = s.DueDate < today && s.Outstanding > 0;
        return new(s.Id, s.InstallmentNumber, s.DueDate, s.PrincipalDue, s.InterestDue, s.FeesDue, s.TotalDue,
            s.PrincipalPaid, s.InterestPaid, s.FeesPaid, s.TotalPaid, s.Outstanding, s.Status, s.LateFeeCharged,
            overdue, overdue ? today.DayNumber - s.DueDate.DayNumber : 0, s.LastPaidDate);
    }
}

public class PaymentRequest
{
    [Range(1, int.MaxValue)] public int LoanId { get; set; }
    [Range(0.01d, 1_000_000_000d)] public decimal Amount { get; set; }
    public DateOnly? PaymentDate { get; set; }
    public PaymentMethod Method { get; set; } = PaymentMethod.Eft;
    [StringLength(100)] public string? Reference { get; set; }
}

public record AllocationResponse(
    int RepaymentScheduleId, int InstallmentNumber, decimal FeesAmount, decimal InterestAmount, decimal PrincipalAmount);

public record PaymentResponse(
    int Id, int LoanId, decimal Amount, DateOnly PaymentDate, PaymentMethod Method, string? Reference,
    decimal FeesAllocated, decimal InterestAllocated, decimal PrincipalAllocated, string? ReceivedBy,
    DateTime CreatedAt, IReadOnlyList<AllocationResponse>? Allocations)
{
    // Pass includeAllocations only when Allocations (and their RepaymentSchedule) are loaded.
    public static PaymentResponse From(Payment p, bool includeAllocations = false) =>
        new(p.Id, p.LoanId, p.Amount, p.PaymentDate, p.Method, p.Reference, p.FeesAllocated, p.InterestAllocated,
            p.PrincipalAllocated, p.ReceivedBy, p.CreatedAt,
            includeAllocations
                ? p.Allocations.OrderBy(a => a.RepaymentSchedule.InstallmentNumber)
                    .Select(a => new AllocationResponse(a.RepaymentScheduleId, a.RepaymentSchedule.InstallmentNumber,
                        a.FeesAmount, a.InterestAmount, a.PrincipalAmount)).ToList()
                : null);
}
