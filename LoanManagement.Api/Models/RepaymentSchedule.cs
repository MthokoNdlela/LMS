namespace LoanManagement.Api.Models;

public enum InstallmentStatus
{
    Pending,
    PartiallyPaid,
    Paid
}

// One row per scheduled installment. Overdue is derived from DueDate, not stored.
public class RepaymentSchedule
{
    public int Id { get; set; }
    public int LoanId { get; set; }
    public Loan Loan { get; set; } = null!;
    public int InstallmentNumber { get; set; }
    public DateOnly DueDate { get; set; }

    public decimal PrincipalDue { get; set; }
    public decimal InterestDue { get; set; }
    public decimal FeesDue { get; set; }
    public decimal PrincipalPaid { get; set; }
    public decimal InterestPaid { get; set; }
    public decimal FeesPaid { get; set; }

    public bool LateFeeCharged { get; set; }
    public InstallmentStatus Status { get; set; } = InstallmentStatus.Pending;
    public DateOnly? LastPaidDate { get; set; }

    public decimal TotalDue => PrincipalDue + InterestDue + FeesDue;
    public decimal TotalPaid => PrincipalPaid + InterestPaid + FeesPaid;
    public decimal Outstanding => TotalDue - TotalPaid;
}
