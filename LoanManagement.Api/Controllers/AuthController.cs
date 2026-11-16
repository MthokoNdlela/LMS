using LoanManagement.Api.Data;
using LoanManagement.Api.Dtos;
using LoanManagement.Api.Models;
using LoanManagement.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LoanManagement.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/[controller]")]
public class AuthController(AppDbContext db, TokenService tokens) : ControllerBase
{
    private readonly PasswordHasher<AppUser> _hasher = new();

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request, CancellationToken ct)
    {
        var username = request.Username.Trim();
        if (await db.Users.AnyAsync(u => u.Username == username, ct))
            return Problem(statusCode: StatusCodes.Status409Conflict, detail: "Username is already taken.");

        var user = new AppUser { Username = username };
        user.PasswordHash = _hasher.HashPassword(user, request.Password);
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        var (token, expires) = tokens.CreateToken(user);
        return StatusCode(StatusCodes.Status201Created, new AuthResponse(token, expires, user.Username));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken ct)
    {
        var username = request.Username.Trim();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username, ct);

        var valid = user is not null &&
            _hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password) != PasswordVerificationResult.Failed;
        if (!valid) return Unauthorized(new ProblemDetails { Status = 401, Detail = "Invalid username or password." });

        var (token, expires) = tokens.CreateToken(user!);
        return new AuthResponse(token, expires, user!.Username);
    }
}
