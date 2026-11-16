namespace LoanManagement.Api.Models;

public enum LoanStatus
{
    Active,
    Settled,
    Defaulted,
    WrittenOff
}

public class Loan
{
    public int Id { get; set; }
    public string LoanNumber { get; set; } = string.Empty;
    public int LoanApplicationId { get; set; }
    public LoanApplication LoanApplication { get; set; } = null!;
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public int LoanProductId { get; set; }
    public LoanProduct LoanProduct { get; set; } = null!;

    // Terms are copied from the product at approval so later product changes never alter an existing loan.
    public decimal PrincipalAmount { get; set; }
    public decimal AnnualInterestRate { get; set; }
    public int TermMonths { get; set; }
    public decimal InitiationFee { get; set; }
    public decimal MonthlyServiceFee { get; set; }
    public decimal LateFeeAmount { get; set; }
    public int ArrearsGraceDays { get; set; }
    public decimal MonthlyInstallment { get; set; }

    public DateOnly DisbursementDate { get; set; }
    public DateOnly FirstDueDate { get; set; }
    public DateOnly MaturityDate { get; set; }
    public LoanStatus Status { get; set; } = LoanStatus.Active;

    // Unpaid amounts across the whole schedule; recalculated from RepaymentSchedule whenever it changes.
    public decimal OutstandingPrincipal { get; set; }
    public decimal OutstandingInterest { get; set; }
    public decimal OutstandingFees { get; set; }
    public decimal TotalOutstanding => OutstandingPrincipal + OutstandingInterest + OutstandingFees;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public byte[] RowVersion { get; set; } = [];

    public List<RepaymentSchedule> Schedule { get; set; } = [];
    public List<Payment> Payments { get; set; } = [];
    public List<CollectionActivity> CollectionActivities { get; set; } = [];
}
