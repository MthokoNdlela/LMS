using LoanManagement.Api.Data;
using LoanManagement.Api.Dtos;
using LoanManagement.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LoanManagement.Api.Controllers;

[Route("api/[controller]")]
public class CustomersController(AppDbContext db) : ApiControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<CustomerResponse>>> GetAll([FromQuery] string? search, CancellationToken ct)
    {
        var query = db.Customers.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(c => c.FirstName.Contains(term) || c.LastName.Contains(term)
                || c.Email.Contains(term) || c.NationalIdNumber.Contains(term));
        }

        var customers = await query.OrderBy(c => c.LastName).ThenBy(c => c.FirstName).ToListAsync(ct);
        return Ok(customers.Select(CustomerResponse.From));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CustomerResponse>> Get(int id, CancellationToken ct)
    {
        var customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct);
        return customer is null ? NotFound() : CustomerResponse.From(customer);
    }

    [HttpPost]
    public async Task<ActionResult<CustomerResponse>> Create(CustomerRequest request, CancellationToken ct)
    {
        if (!IsAdult(request.DateOfBirth!.Value)) return Invalid(nameof(request.DateOfBirth), "Customer must be at least 18 years old.");
        if (await Duplicate(request, null, ct) is { } conflict) return conflict;

        var customer = new Customer();
        Apply(customer, request);
        db.Customers.Add(customer);
        db.Audit("Customer.Created", customer, $"{customer.FirstName} {customer.LastName}");
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(Get), new { id = customer.Id }, CustomerResponse.From(customer));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<CustomerResponse>> Update(int id, CustomerRequest request, CancellationToken ct)
    {
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (customer is null) return NotFound();
        if (!IsAdult(request.DateOfBirth!.Value)) return Invalid(nameof(request.DateOfBirth), "Customer must be at least 18 years old.");
        if (await Duplicate(request, id, ct) is { } conflict) return conflict;

        Apply(customer, request);
        customer.UpdatedAt = DateTime.UtcNow;
        db.Audit("Customer.Updated", customer);
        await db.SaveChangesAsync(ct);

        return CustomerResponse.From(customer);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (customer is null) return NotFound();

        if (await db.LoanApplications.AnyAsync(a => a.CustomerId == id, ct))
            return ConflictProblem("Customer has loan applications and cannot be deleted.");

        db.Customers.Remove(customer);
        db.Audit("Customer.Deleted", customer, $"{customer.FirstName} {customer.LastName}");
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static bool IsAdult(DateOnly dateOfBirth) => dateOfBirth <= Today.AddYears(-18);

    private async Task<ObjectResult?> Duplicate(CustomerRequest request, int? excludeId, CancellationToken ct)
    {
        var email = request.Email.Trim();
        var nationalId = request.NationalIdNumber.Trim();
        if (await db.Customers.AnyAsync(c => c.Email == email && c.Id != excludeId, ct))
            return ConflictProblem("A customer with this email already exists.");
        if (await db.Customers.AnyAsync(c => c.NationalIdNumber == nationalId && c.Id != excludeId, ct))
            return ConflictProblem("A customer with this national ID number already exists.");
        return null;
    }

    private static void Apply(Customer c, CustomerRequest r)
    {
        c.FirstName = r.FirstName.Trim();
        c.LastName = r.LastName.Trim();
        c.Email = r.Email.Trim();
        c.Phone = r.Phone?.Trim();
        c.DateOfBirth = r.DateOfBirth!.Value;
        c.NationalIdNumber = r.NationalIdNumber.Trim();
        c.AddressLine1 = r.AddressLine1.Trim();
        c.AddressLine2 = r.AddressLine2?.Trim();
        c.City = r.City.Trim();
        c.PostalCode = r.PostalCode.Trim();
    }
}
