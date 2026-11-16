namespace LoanManagement.Api.Models;

public enum ApplicationStatus
{
    Draft,
    Submitted,
    UnderReview,
    Approved,
    Declined,
    Withdrawn
}

public class LoanApplication
{
    public int Id { get; set; }
    public string ApplicationNumber { get; set; } = string.Empty;
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public int LoanProductId { get; set; }
    public LoanProduct LoanProduct { get; set; } = null!;
    public decimal RequestedAmount { get; set; }
    public int TermMonths { get; set; }
    public string? Purpose { get; set; }
    public ApplicationStatus Status { get; set; } = ApplicationStatus.Draft;
    public DateTime? SubmittedAt { get; set; }
    public DateTime? DecidedAt { get; set; }
    public string? DecidedBy { get; set; }
    public string? DecisionReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<AffordabilityAssessment> Assessments { get; set; } = [];
    public Loan? Loan { get; set; }
}
