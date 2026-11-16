using LoanManagement.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace LoanManagement.Api.Services;

public static class NumberGenerator
{
    private const string ApplicationSql = "SELECT NEXT VALUE FOR dbo.ApplicationNumberSeq AS [Value]";
    private const string LoanSql = "SELECT NEXT VALUE FOR dbo.LoanNumberSeq AS [Value]";

    public static Task<string> NextApplicationNumber(AppDbContext db, CancellationToken ct) =>
        Next(db, ApplicationSql, "APP", ct);

    public static Task<string> NextLoanNumber(AppDbContext db, CancellationToken ct) =>
        Next(db, LoanSql, "LN", ct);

    private static async Task<string> Next(AppDbContext db, string sql, string prefix, CancellationToken ct)
    {
        var values = await db.Database.SqlQueryRaw<int>(sql).ToListAsync(ct);
        return $"{prefix}-{values[0]:D6}";
    }
}
