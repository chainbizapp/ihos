using Ihos.Application.Common.Interfaces;
using MailKit.Net.Smtp;
using Microsoft.Extensions.Configuration;
using MimeKit;

namespace Ihos.Infrastructure.Services;

public class MailKitEmailService : IEmailService
{
    private readonly IConfiguration _config;

    public MailKitEmailService(IConfiguration config) => _config = config;

    public async Task SendInviteAsync(string toEmail, string toName, string inviteLink, CancellationToken ct = default)
    {
        var smtp = _config.GetSection("Smtp");
        var host = smtp["Host"] ?? "localhost";
        var port = smtp.GetValue<int>("Port", 1025);
        var from = smtp["From"] ?? "noreply@ihos.local";
        var fromName = smtp["FromName"] ?? "IHOS System";

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, from));
        message.To.Add(new MailboxAddress(toName, toEmail));
        message.Subject = "You have been invited to IHOS";

        var body = new BodyBuilder
        {
            HtmlBody = $"""
                <p>Hello {toName},</p>
                <p>You have been invited to access the IHOS Motor Insurance System.</p>
                <p><a href="{inviteLink}">Click here to accept your invitation and set your password</a></p>
                <p>This link expires in 48 hours.</p>
                <p>If you did not expect this invitation, please ignore this email.</p>
                """,
            TextBody = $"Hello {toName},\n\nYou have been invited to IHOS.\n\nAccept here: {inviteLink}\n\nThis link expires in 48 hours."
        };

        message.Body = body.ToMessageBody();

        using var client = new SmtpClient();
        await client.ConnectAsync(host, port, MailKit.Security.SecureSocketOptions.None, ct);
        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }
}
