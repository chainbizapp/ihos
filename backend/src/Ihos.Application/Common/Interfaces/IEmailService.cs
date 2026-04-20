namespace Ihos.Application.Common.Interfaces;

public interface IEmailService
{
    Task SendInviteAsync(string toEmail, string toName, string inviteLink, CancellationToken ct = default);
}
