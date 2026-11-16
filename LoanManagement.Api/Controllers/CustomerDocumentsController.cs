using LoanManagement.Api.Data;
using LoanManagement.Api.Dtos;
using LoanManagement.Api.Models;
using LoanManagement.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LoanManagement.Api.Controllers;

[Route("api/customers/{customerId:int}/documents")]
public class CustomerDocumentsController(AppDbContext db, ICurrentUser user) : ApiControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<DocumentResponse>>> GetAll(int customerId, CancellationToken ct)
    {
        if (!await db.Customers.AnyAsync(c => c.Id == customerId, ct)) return NotFound();

        var documents = await db.CustomerDocuments.AsNoTracking()
            .Where(d => d.CustomerId == customerId).OrderBy(d => d.Type).ThenByDescending(d => d.UploadedAt)
            .ToListAsync(ct);
        return Ok(documents.Select(DocumentResponse.From));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<DocumentResponse>> Get(int customerId, int id, CancellationToken ct)
    {
        var document = await db.CustomerDocuments.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id && d.CustomerId == customerId, ct);
        return document is null ? NotFound() : DocumentResponse.From(document);
    }

    [HttpPost]
    public async Task<ActionResult<DocumentResponse>> Create(int customerId, DocumentRequest request, CancellationToken ct)
    {
        if (!await db.Customers.AnyAsync(c => c.Id == customerId, ct)) return NotFound();

        var document = new CustomerDocument { CustomerId = customerId };
        Apply(document, request);
        db.CustomerDocuments.Add(document);
        db.Audit("CustomerDocument.Added", document, $"{document.Type}: {document.FileName} (customer {customerId})");
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(Get), new { customerId, id = document.Id }, DocumentResponse.From(document));
    }

    // Verified documents are evidence for decisions, so only pending or rejected ones can be edited.
    [HttpPut("{id:int}")]
    public async Task<ActionResult<DocumentResponse>> Update(int customerId, int id, DocumentRequest request, CancellationToken ct)
    {
        var document = await db.CustomerDocuments.FirstOrDefaultAsync(d => d.Id == id && d.CustomerId == customerId, ct);
        if (document is null) return NotFound();
        if (document.Status == DocumentStatus.Verified) return ConflictProblem("Verified documents cannot be edited.");

        Apply(document, request);
        document.Status = DocumentStatus.Pending;
        document.ReviewNotes = null;
        document.ReviewedAt = null;
        document.ReviewedBy = null;
        db.Audit("CustomerDocument.Updated", document, "Re-submitted for review");
        await db.SaveChangesAsync(ct);

        return DocumentResponse.From(document);
    }

    [HttpPost("{id:int}/review")]
    public async Task<ActionResult<DocumentResponse>> Review(int customerId, int id, DocumentReviewRequest request, CancellationToken ct)
    {
        var document = await db.CustomerDocuments.FirstOrDefaultAsync(d => d.Id == id && d.CustomerId == customerId, ct);
        if (document is null) return NotFound();

        var status = request.Status!.Value;
        if (status == DocumentStatus.Pending) return Invalid(nameof(request.Status), "Review must verify or reject the document.");
        if (status == DocumentStatus.Rejected && string.IsNullOrWhiteSpace(request.Notes))
            return Invalid(nameof(request.Notes), "Notes are required when rejecting a document.");

        document.Status = status;
        document.ReviewNotes = request.Notes?.Trim();
        document.ReviewedAt = DateTime.UtcNow;
        document.ReviewedBy = user.Username;
        db.Audit($"CustomerDocument.{status}", document, request.Notes);
        await db.SaveChangesAsync(ct);

        return DocumentResponse.From(document);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int customerId, int id, CancellationToken ct)
    {
        var document = await db.CustomerDocuments.FirstOrDefaultAsync(d => d.Id == id && d.CustomerId == customerId, ct);
        if (document is null) return NotFound();
        if (document.Status == DocumentStatus.Verified) return ConflictProblem("Verified documents cannot be deleted.");

        db.CustomerDocuments.Remove(document);
        db.Audit("CustomerDocument.Deleted", document, $"{document.Type}: {document.FileName}");
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static void Apply(CustomerDocument d, DocumentRequest r)
    {
        d.Type = r.Type!.Value;
        d.FileName = r.FileName.Trim();
        d.ContentType = r.ContentType?.Trim();
        d.StorageReference = r.StorageReference.Trim();
    }
}
