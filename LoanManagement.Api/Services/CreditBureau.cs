using System.Security.Cryptography;
using System.Text;
using LoanManagement.Api.Models;

namespace LoanManagement.Api.Services;

public record BureauResult(int Score, bool HasAdverseListing, string Reference);

public interface ICreditBureau
{
    Task<BureauResult> CheckAsync(Customer customer, CancellationToken ct);
}

// Demo stand-in for a real bureau: the same national ID always gives the same score (450-849)
// and adverse-listing flag, so results are repeatable. Replace with a real provider by
// registering another ICreditBureau implementation.
public class SimulatedCreditBureau : ICreditBureau
{
    public Task<BureauResult> CheckAsync(Customer customer, CancellationToken ct)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(customer.NationalIdNumber.Trim().ToUpperInvariant()));
        var score = 450 + (int)(BitConverter.ToUInt32(hash, 0) % 400);
        var adverse = hash[4] % 6 == 0;
        return Task.FromResult(new BureauResult(score, adverse, $"SIM-{Convert.ToHexString(hash, 0, 4)}"));
    }
}
