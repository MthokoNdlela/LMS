using System.ComponentModel.DataAnnotations;
using LoanManagement.Api.Models;

namespace LoanManagement.Api.Dtos;

public class CollectionActivityRequest : IValidatableObject
{
    [Range(1, int.MaxValue)] public int LoanId { get; set; }
    [Required] public CollectionActivityType? ActivityType { get; set; }
    public DateTime? ActivityDate { get; set; }
    [StringLength(200)] public string? Outcome { get; set; }
    [StringLength(1000)] public string? Notes { get; set; }
    [Range(0.01d, 1_000_000_000d)] public decimal? PromisedAmount { get; set; }
    public DateOnly? PromisedDate { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (ActivityType != CollectionActivityType.PromiseToPay) yield break;

        if (PromisedAmount is null)
            yield return new ValidationResult("PromisedAmount is required for a promise to pay.", [nameof(PromisedAmount)]);
        if (PromisedDate is null)
            yield return new ValidationResult("PromisedDate is required for a promise to pay.", [nameof(PromisedDate)]);
    }
}

public class PromiseStatusRequest
{
    [Required] public PromiseStatus? Status { get; set; }
}

public record CollectionActivityResponse(
    int Id, int LoanId, CollectionActivityType ActivityType, DateTime ActivityDate, string? Outcome, string? Notes,
    decimal? PromisedAmount, DateOnly? PromisedDate, PromiseStatus? PromiseStatus, decimal ArrearsAmount,
    int DaysInArrears, string? CreatedBy, DateTime CreatedAt)
{
    public static CollectionActivityResponse From(CollectionActivity c) =>
        new(c.Id, c.LoanId, c.ActivityType, c.ActivityDate, c.Outcome, c.Notes, c.PromisedAmount, c.PromisedDate,
            c.PromiseStatus, c.ArrearsAmount, c.DaysInArrears, c.CreatedBy, c.CreatedAt);
}

public record AuditLogResponse(
    int Id, DateTime Timestamp, int? UserId, string Username, string Action, string EntityType, int? EntityId,
    string? Details)
{
    public static AuditLogResponse From(AuditLog a) =>
        new(a.Id, a.Timestamp, a.UserId, a.Username, a.Action, a.EntityType, a.EntityId, a.Details);
}
