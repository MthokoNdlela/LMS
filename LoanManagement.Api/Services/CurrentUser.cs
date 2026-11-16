using System.Security.Claims;

namespace LoanManagement.Api.Services;

public interface ICurrentUser
{
    int? UserId { get; }
    string Username { get; }
}

public class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public int? UserId => int.TryParse(
        Principal?.FindFirst("sub")?.Value ?? Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id)
        ? id : null;

    public string Username =>
        Principal?.FindFirst("unique_name")?.Value ?? Principal?.FindFirst(ClaimTypes.Name)?.Value ?? "system";
}
