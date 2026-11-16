using LoanManagement.Api.Models;

namespace LoanManagement.Api.Services;

public static class LoanCalculator
{
    // Standard amortised monthly payment; falls back to straight division for 0% loans.
    public static decimal MonthlyPayment(decimal principal, decimal annualRatePercent, int termMonths)
    {
        if (termMonths <= 0) return 0m;
        if (annualRatePercent == 0m) return Math.Round(principal / termMonths, 2);

        var r = (double)annualRatePercent / 1200d;
        var payment = (double)principal * r / (1d - Math.Pow(1d + r, -termMonths));
        return Math.Round((decimal)payment, 2);
    }

    public static decimal InitiationFee(decimal principal, LoanProduct product) =>
        Math.Round(principal * product.OriginationFeePercent / 100m, 2, MidpointRounding.AwayFromZero);
}
