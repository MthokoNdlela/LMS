namespace LoanManagement.Api.Models;

public enum CollectionActivityType
{
    Reminder,
    Call,
    Sms,
    Email,
    ArrearsNotice,
    PromiseToPay,
    Note
}

public enum PromiseStatus
{
    Open,
    Kept,
    Broken
}

public class CollectionActivity
{
    public int Id { get; set; }
    public int LoanId { get; set; }
    public Loan Loan { get; set; } = null!;
    public CollectionActivityType ActivityType { get; set; }
    public DateTime ActivityDate { get; set; } = DateTime.UtcNow;
    public string? Outcome { get; set; }
    public string? Notes { get; set; }

    // Only set for PromiseToPay activities.
    public decimal? PromisedAmount { get; set; }
    public DateOnly? PromisedDate { get; set; }
    public PromiseStatus? PromiseStatus { get; set; }

    // Arrears position when the activity was logged.
    public decimal ArrearsAmount { get; set; }
    public int DaysInArrears { get; set; }

    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
