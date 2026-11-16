namespace LoanManagement.Api.Models;

public enum DocumentType
{
    IdDocument,
    ProofOfAddress,
    ProofOfIncome,
    Other
}

public enum DocumentStatus
{
    Pending,
    Verified,
    Rejected
}

// Metadata only: StorageReference points at the file in external storage; no file bytes live in the database.
public class CustomerDocument
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public DocumentType Type { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string? ContentType { get; set; }
    public string StorageReference { get; set; } = string.Empty;
    public DocumentStatus Status { get; set; } = DocumentStatus.Pending;
    public string? ReviewNotes { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewedBy { get; set; }
}
