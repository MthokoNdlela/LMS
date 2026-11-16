using System.ComponentModel.DataAnnotations;

namespace LoanManagement.Api.Dtos;

public class RegisterRequest
{
    [Required, StringLength(100, MinimumLength = 3)] public string Username { get; set; } = string.Empty;
    [Required, StringLength(128, MinimumLength = 8)] public string Password { get; set; } = string.Empty;
}

public class LoginRequest
{
    [Required] public string Username { get; set; } = string.Empty;
    [Required] public string Password { get; set; } = string.Empty;
}

public record AuthResponse(string Token, DateTime ExpiresAt, string Username);
