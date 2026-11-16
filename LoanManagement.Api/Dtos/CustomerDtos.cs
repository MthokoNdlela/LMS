using System.ComponentModel.DataAnnotations;
using LoanManagement.Api.Models;

namespace LoanManagement.Api.Dtos;

public class CustomerRequest
{
    [Required, StringLength(100)] public string FirstName { get; set; } = string.Empty;
    [Required, StringLength(100)] public string LastName { get; set; } = string.Empty;
    [Required, EmailAddress, StringLength(256)] public string Email { get; set; } = string.Empty;
    [Phone, StringLength(30)] public string? Phone { get; set; }
    [Required] public DateOnly? DateOfBirth { get; set; }
    [Required, StringLength(30)] public string NationalIdNumber { get; set; } = string.Empty;
    [Required, StringLength(200)] public string AddressLine1 { get; set; } = string.Empty;
    [StringLength(200)] public string? AddressLine2 { get; set; }
    [Required, StringLength(100)] public string City { get; set; } = string.Empty;
    [Required, StringLength(20)] public string PostalCode { get; set; } = string.Empty;
}

public record CustomerResponse(
    int Id, string FirstName, string LastName, string Email, string? Phone, DateOnly DateOfBirth,
    string NationalIdNumber, string AddressLine1, string? AddressLine2, string City, string PostalCode,
    DateTime CreatedAt, DateTime? UpdatedAt)
{
    public static CustomerResponse From(Customer c) =>
        new(c.Id, c.FirstName, c.LastName, c.Email, c.Phone, c.DateOfBirth, c.NationalIdNumber,
            c.AddressLine1, c.AddressLine2, c.City, c.PostalCode, c.CreatedAt, c.UpdatedAt);
}

public class DocumentRequest
{
    [Required] public DocumentType? Type { get; set; }
    [Required, StringLength(260)] public string FileName { get; set; } = string.Empty;
    [StringLength(100)] public string? ContentType { get; set; }
    [Required, StringLength(500)] public string StorageReference { get; set; } = string.Empty;
}

public class DocumentReviewRequest
{
    [Required] public DocumentStatus? Status { get; set; }
    [StringLength(500)] public string? Notes { get; set; }
}

public record DocumentResponse(
    int Id, int CustomerId, DocumentType Type, string FileName, string? ContentType, string StorageReference,
    DocumentStatus Status, string? ReviewNotes, DateTime UploadedAt, DateTime? ReviewedAt, string? ReviewedBy)
{
    public static DocumentResponse From(CustomerDocument d) =>
        new(d.Id, d.CustomerId, d.Type, d.FileName, d.ContentType, d.StorageReference, d.Status,
            d.ReviewNotes, d.UploadedAt, d.ReviewedAt, d.ReviewedBy);
}
