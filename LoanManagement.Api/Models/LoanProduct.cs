namespace LoanManagement.Api.Models;

public enum InterestMethod
{
    ReducingBalance
}

public class LoanProduct
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public InterestMethod InterestMethod { get; set; } = InterestMethod.ReducingBalance;
    public decimal AnnualInterestRate { get; set; }
    public decimal MinAmount { get; set; }
    public decimal MaxAmount { get; set; }
    public int MinTermMonths { get; set; }
    public int MaxTermMonths { get; set; }
    public decimal OriginationFeePercent { get; set; }
    public decimal MonthlyServiceFee { get; set; }
    public decimal LateFeeAmount { get; set; }
    public int ArrearsGraceDays { get; set; }

    // Affordability policy applied when assessing an application for this product.
    public decimal StressTestRatePoints { get; set; } = 3m;
    public int BureauMinScore { get; set; } = 600;
    public int BureauReferScore { get; set; } = 650;

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
