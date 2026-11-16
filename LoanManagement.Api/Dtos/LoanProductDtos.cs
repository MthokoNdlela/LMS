using System.ComponentModel.DataAnnotations;
using LoanManagement.Api.Models;

namespace LoanManagement.Api.Dtos;

public class LoanProductRequest : IValidatableObject
{
    [Required, StringLength(100)] public string Name { get; set; } = string.Empty;
    [StringLength(500)] public string? Description { get; set; }
    public InterestMethod InterestMethod { get; set; } = InterestMethod.ReducingBalance;
    [Range(0d, 100d)] public decimal AnnualInterestRate { get; set; }
    [Range(0.01d, 1_000_000_000d)] public decimal MinAmount { get; set; }
    [Range(0.01d, 1_000_000_000d)] public decimal MaxAmount { get; set; }
    [Range(1, 600)] public int MinTermMonths { get; set; }
    [Range(1, 600)] public int MaxTermMonths { get; set; }
    [Range(0d, 100d)] public decimal OriginationFeePercent { get; set; }
    [Range(0d, 1_000_000d)] public decimal MonthlyServiceFee { get; set; }
    [Range(0d, 1_000_000d)] public decimal LateFeeAmount { get; set; }
    [Range(0, 365)] public int ArrearsGraceDays { get; set; }
    [Range(0d, 20d)] public decimal StressTestRatePoints { get; set; } = 3m;
    [Range(300, 850)] public int BureauMinScore { get; set; } = 600;
    [Range(300, 850)] public int BureauReferScore { get; set; } = 650;
    public bool IsActive { get; set; } = true;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (MinAmount > MaxAmount)
            yield return new ValidationResult("MinAmount cannot exceed MaxAmount.", [nameof(MinAmount)]);
        if (MinTermMonths > MaxTermMonths)
            yield return new ValidationResult("MinTermMonths cannot exceed MaxTermMonths.", [nameof(MinTermMonths)]);
        if (BureauMinScore > BureauReferScore)
            yield return new ValidationResult("BureauMinScore cannot exceed BureauReferScore.", [nameof(BureauMinScore)]);
    }
}

public record LoanProductResponse(
    int Id, string Name, string? Description, InterestMethod InterestMethod, decimal AnnualInterestRate,
    decimal MinAmount, decimal MaxAmount, int MinTermMonths, int MaxTermMonths, decimal OriginationFeePercent,
    decimal MonthlyServiceFee, decimal LateFeeAmount, int ArrearsGraceDays, decimal StressTestRatePoints,
    int BureauMinScore, int BureauReferScore, bool IsActive, DateTime CreatedAt)
{
    public static LoanProductResponse From(LoanProduct p) =>
        new(p.Id, p.Name, p.Description, p.InterestMethod, p.AnnualInterestRate, p.MinAmount, p.MaxAmount,
            p.MinTermMonths, p.MaxTermMonths, p.OriginationFeePercent, p.MonthlyServiceFee, p.LateFeeAmount,
            p.ArrearsGraceDays, p.StressTestRatePoints, p.BureauMinScore, p.BureauReferScore, p.IsActive,
            p.CreatedAt);
}
