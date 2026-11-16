namespace LoanManagement.Api.Models;

public enum PaymentMethod
{
    Eft,
    DebitOrder,
    Card,
    Cash
}

// Payments are immutable once recorded. The totals below are the sum of the PaymentAllocation rows.
public class Payment
{
    public int Id { get; set; }
    public int LoanId { get; set; }
    public Loan Loan { get; set; } = null!;
    public decimal Amount { get; set; }
    public DateOnly PaymentDate { get; set; }
    public PaymentMethod Method { get; set; }
    public string? Reference { get; set; }

    public decimal FeesAllocated { get; set; }
    public decimal InterestAllocated { get; set; }
    public decimal PrincipalAllocated { get; set; }

    public string? ReceivedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<PaymentAllocation> Allocations { get; set; } = [];
}

public class PaymentAllocation
{
    public int Id { get; set; }
    public int PaymentId { get; set; }
    public Payment Payment { get; set; } = null!;
    public int RepaymentScheduleId { get; set; }
    public RepaymentSchedule RepaymentSchedule { get; set; } = null!;
    public decimal FeesAmount { get; set; }
    public decimal InterestAmount { get; set; }
    public decimal PrincipalAmount { get; set; }
}
