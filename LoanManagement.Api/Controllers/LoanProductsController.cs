using LoanManagement.Api.Data;
using LoanManagement.Api.Dtos;
using LoanManagement.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LoanManagement.Api.Controllers;

[Route("api/loan-products")]
public class LoanProductsController(AppDbContext db) : ApiControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<LoanProductResponse>>> GetAll([FromQuery] bool? active, CancellationToken ct)
    {
        var query = db.LoanProducts.AsNoTracking();
        if (active is not null) query = query.Where(p => p.IsActive == active);

        var products = await query.OrderBy(p => p.Name).ToListAsync(ct);
        return Ok(products.Select(LoanProductResponse.From));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<LoanProductResponse>> Get(int id, CancellationToken ct)
    {
        var product = await db.LoanProducts.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, ct);
        return product is null ? NotFound() : LoanProductResponse.From(product);
    }

    [HttpPost]
    public async Task<ActionResult<LoanProductResponse>> Create(LoanProductRequest request, CancellationToken ct)
    {
        if (await NameTaken(request.Name, null, ct)) return ConflictProblem("A product with this name already exists.");

        var product = new LoanProduct();
        Apply(product, request);
        db.LoanProducts.Add(product);
        db.Audit("LoanProduct.Created", product, product.Name);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(Get), new { id = product.Id }, LoanProductResponse.From(product));
    }

    // Existing loans keep the terms they were approved with, so editing a product only affects new applications.
    [HttpPut("{id:int}")]
    public async Task<ActionResult<LoanProductResponse>> Update(int id, LoanProductRequest request, CancellationToken ct)
    {
        var product = await db.LoanProducts.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product is null) return NotFound();
        if (await NameTaken(request.Name, id, ct)) return ConflictProblem("A product with this name already exists.");

        Apply(product, request);
        db.Audit("LoanProduct.Updated", product, product.Name);
        await db.SaveChangesAsync(ct);

        return LoanProductResponse.From(product);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var product = await db.LoanProducts.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (product is null) return NotFound();

        if (await db.LoanApplications.AnyAsync(a => a.LoanProductId == id, ct))
            return ConflictProblem("Product is used by loan applications. Deactivate it instead.");

        db.LoanProducts.Remove(product);
        db.Audit("LoanProduct.Deleted", product, product.Name);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private Task<bool> NameTaken(string name, int? excludeId, CancellationToken ct)
    {
        var normalized = name.Trim();
        return db.LoanProducts.AnyAsync(p => p.Name == normalized && p.Id != excludeId, ct);
    }

    private static void Apply(LoanProduct p, LoanProductRequest r)
    {
        p.Name = r.Name.Trim();
        p.Description = r.Description?.Trim();
        p.InterestMethod = r.InterestMethod;
        p.AnnualInterestRate = r.AnnualInterestRate;
        p.MinAmount = r.MinAmount;
        p.MaxAmount = r.MaxAmount;
        p.MinTermMonths = r.MinTermMonths;
        p.MaxTermMonths = r.MaxTermMonths;
        p.OriginationFeePercent = r.OriginationFeePercent;
        p.MonthlyServiceFee = r.MonthlyServiceFee;
        p.LateFeeAmount = r.LateFeeAmount;
        p.ArrearsGraceDays = r.ArrearsGraceDays;
        p.IsActive = r.IsActive;
    }
}
