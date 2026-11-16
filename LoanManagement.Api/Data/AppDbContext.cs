using LoanManagement.Api.Models;
using LoanManagement.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace LoanManagement.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUser currentUser) : DbContext(options)
{
    public const string ApplicationNumberSequence = "ApplicationNumberSeq";
    public const string LoanNumberSequence = "LoanNumberSeq";

    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<CustomerDocument> CustomerDocuments => Set<CustomerDocument>();
    public DbSet<LoanProduct> LoanProducts => Set<LoanProduct>();
    public DbSet<LoanApplication> LoanApplications => Set<LoanApplication>();
    public DbSet<AffordabilityAssessment> AffordabilityAssessments => Set<AffordabilityAssessment>();
    public DbSet<Loan> Loans => Set<Loan>();
    public DbSet<RepaymentSchedule> RepaymentSchedules => Set<RepaymentSchedule>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<PaymentAllocation> PaymentAllocations => Set<PaymentAllocation>();
    public DbSet<CollectionActivity> CollectionActivities => Set<CollectionActivity>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<AppUser> Users => Set<AppUser>();

    private readonly List<(AuditLog Log, object Entity)> _pendingAudit = [];

    // Queues an audit entry that is written in the same transaction as the next SaveChangesAsync,
    // after the entity has its database-generated Id.
    public void Audit(string action, object entity, string? details = null)
    {
        _pendingAudit.Add((new AuditLog
        {
            Action = action,
            EntityType = entity.GetType().Name,
            Details = details is { Length: > 2000 } ? details[..2000] : details
        }, entity));
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        if (_pendingAudit.Count == 0) return await base.SaveChangesAsync(cancellationToken);

        var pending = _pendingAudit.ToList();
        _pendingAudit.Clear();

        await using var transaction = Database.CurrentTransaction is null
            ? await Database.BeginTransactionAsync(cancellationToken)
            : null;

        var result = await base.SaveChangesAsync(cancellationToken);

        foreach (var (log, entity) in pending)
        {
            log.Timestamp = DateTime.UtcNow;
            log.UserId = currentUser.UserId;
            log.Username = currentUser.Username;
            log.EntityId = Entry(entity).Property("Id").CurrentValue as int?;
            AuditLogs.Add(log);
        }
        await base.SaveChangesAsync(cancellationToken);

        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return result;
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<Enum>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<decimal>().HavePrecision(18, 2);
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        configurationBuilder.Properties<DateTime?>().HaveConversion<UtcDateTimeConverter>();
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasSequence<int>(ApplicationNumberSequence);
        modelBuilder.HasSequence<int>(LoanNumberSequence);

        modelBuilder.Entity<Customer>(e =>
        {
            e.Property(x => x.FirstName).HasMaxLength(100);
            e.Property(x => x.LastName).HasMaxLength(100);
            e.Property(x => x.Email).HasMaxLength(256);
            e.Property(x => x.Phone).HasMaxLength(30);
            e.Property(x => x.NationalIdNumber).HasMaxLength(30);
            e.Property(x => x.AddressLine1).HasMaxLength(200);
            e.Property(x => x.AddressLine2).HasMaxLength(200);
            e.Property(x => x.City).HasMaxLength(100);
            e.Property(x => x.PostalCode).HasMaxLength(20);
            e.HasIndex(x => x.Email).IsUnique();
            e.HasIndex(x => x.NationalIdNumber).IsUnique();
        });

        modelBuilder.Entity<CustomerDocument>(e =>
        {
            e.Property(x => x.FileName).HasMaxLength(260);
            e.Property(x => x.ContentType).HasMaxLength(100);
            e.Property(x => x.StorageReference).HasMaxLength(500);
            e.Property(x => x.ReviewNotes).HasMaxLength(500);
            e.Property(x => x.ReviewedBy).HasMaxLength(100);
            e.HasOne(x => x.Customer).WithMany(c => c.Documents)
                .HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.CustomerId, x.Type });
        });

        modelBuilder.Entity<LoanProduct>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(100);
            e.Property(x => x.Description).HasMaxLength(500);
            e.Property(x => x.AnnualInterestRate).HasPrecision(5, 2);
            e.Property(x => x.OriginationFeePercent).HasPrecision(5, 2);
            e.HasIndex(x => x.Name).IsUnique();
            e.HasData(new LoanProduct
            {
                Id = 1,
                Name = "Personal Loan",
                Description = "Unsecured personal loan with reducing-balance interest.",
                InterestMethod = InterestMethod.ReducingBalance,
                AnnualInterestRate = 18.5m,
                MinAmount = 1000m,
                MaxAmount = 100000m,
                MinTermMonths = 6,
                MaxTermMonths = 60,
                OriginationFeePercent = 2.5m,
                MonthlyServiceFee = 60m,
                LateFeeAmount = 150m,
                ArrearsGraceDays = 5,
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            });
        });

        modelBuilder.Entity<LoanApplication>(e =>
        {
            e.Property(x => x.ApplicationNumber).HasMaxLength(30);
            e.Property(x => x.Purpose).HasMaxLength(500);
            e.Property(x => x.DecidedBy).HasMaxLength(100);
            e.Property(x => x.DecisionReason).HasMaxLength(1000);
            e.HasIndex(x => x.ApplicationNumber).IsUnique();
            e.HasIndex(x => new { x.CustomerId, x.Status });
            e.HasOne(x => x.Customer).WithMany(c => c.Applications)
                .HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.LoanProduct).WithMany()
                .HasForeignKey(x => x.LoanProductId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AffordabilityAssessment>(e =>
        {
            e.Property(x => x.DebtToIncomeRatio).HasPrecision(7, 2);
            e.Property(x => x.Notes).HasMaxLength(1000);
            e.Property(x => x.AssessedBy).HasMaxLength(100);
            e.HasOne(x => x.LoanApplication).WithMany(a => a.Assessments)
                .HasForeignKey(x => x.LoanApplicationId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Loan>(e =>
        {
            e.Property(x => x.LoanNumber).HasMaxLength(30);
            e.Property(x => x.AnnualInterestRate).HasPrecision(5, 2);
            e.Property(x => x.RowVersion).IsRowVersion();
            e.Ignore(x => x.TotalOutstanding);
            e.HasIndex(x => x.LoanNumber).IsUnique();
            e.HasIndex(x => new { x.CustomerId, x.Status });
            e.HasOne(x => x.LoanApplication).WithOne(a => a.Loan)
                .HasForeignKey<Loan>(x => x.LoanApplicationId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Customer).WithMany(c => c.Loans)
                .HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.LoanProduct).WithMany()
                .HasForeignKey(x => x.LoanProductId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<RepaymentSchedule>(e =>
        {
            e.Ignore(x => x.TotalDue);
            e.Ignore(x => x.TotalPaid);
            e.Ignore(x => x.Outstanding);
            e.HasIndex(x => new { x.LoanId, x.InstallmentNumber }).IsUnique();
            e.HasIndex(x => new { x.DueDate, x.Status });
            e.HasOne(x => x.Loan).WithMany(l => l.Schedule)
                .HasForeignKey(x => x.LoanId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Payment>(e =>
        {
            e.Property(x => x.Reference).HasMaxLength(100);
            e.Property(x => x.ReceivedBy).HasMaxLength(100);
            e.HasIndex(x => new { x.LoanId, x.PaymentDate });
            e.HasOne(x => x.Loan).WithMany(l => l.Payments)
                .HasForeignKey(x => x.LoanId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PaymentAllocation>(e =>
        {
            e.HasOne(x => x.Payment).WithMany(p => p.Allocations)
                .HasForeignKey(x => x.PaymentId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.RepaymentSchedule).WithMany()
                .HasForeignKey(x => x.RepaymentScheduleId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<CollectionActivity>(e =>
        {
            e.Property(x => x.Outcome).HasMaxLength(200);
            e.Property(x => x.Notes).HasMaxLength(1000);
            e.Property(x => x.CreatedBy).HasMaxLength(100);
            e.HasIndex(x => new { x.LoanId, x.ActivityDate });
            e.HasOne(x => x.Loan).WithMany(l => l.CollectionActivities)
                .HasForeignKey(x => x.LoanId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AuditLog>(e =>
        {
            e.Property(x => x.Username).HasMaxLength(100);
            e.Property(x => x.Action).HasMaxLength(100);
            e.Property(x => x.EntityType).HasMaxLength(100);
            e.Property(x => x.Details).HasMaxLength(2000);
            e.HasIndex(x => new { x.EntityType, x.EntityId });
            e.HasIndex(x => x.Timestamp);
        });

        modelBuilder.Entity<AppUser>(e =>
        {
            e.Property(x => x.Username).HasMaxLength(100);
            e.HasIndex(x => x.Username).IsUnique();
        });
    }
}
