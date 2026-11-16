using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace LoanManagement.Api.Data;

// SQL Server returns datetime2 values with an unspecified kind; tag them as UTC so JSON carries a "Z".
public class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
    v => v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : v,
    v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
