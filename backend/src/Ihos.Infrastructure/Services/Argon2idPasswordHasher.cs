using Ihos.Application.Common.Interfaces;
using Isopoh.Cryptography.Argon2;

namespace Ihos.Infrastructure.Services;

public class Argon2idPasswordHasher : IPasswordHasher
{
    // OWASP-recommended params: memory=65536 KB, iterations=3, parallelism=4
    private const int MemoryCost = 65536;
    private const int Iterations = 3;
    private const int Parallelism = 4;

    public string Hash(string password)
    {
        var config = new Argon2Config
        {
            Type = Argon2Type.DataIndependentAddressing,
            Version = Argon2Version.Nineteen,
            MemoryCost = MemoryCost,
            TimeCost = Iterations,
            Lanes = Parallelism,
            Threads = Parallelism,
            Password = System.Text.Encoding.UTF8.GetBytes(password),
            Salt = System.Security.Cryptography.RandomNumberGenerator.GetBytes(16),
            HashLength = 32
        };

        using var argon2 = new Argon2(config);
        using var hash = argon2.Hash();
        return config.EncodeString(hash.Buffer);
    }

    public bool Verify(string password, string hash)
    {
        if (string.IsNullOrWhiteSpace(hash)) return false;
        
        try
        {
            return Argon2.Verify(hash, password);
        }
        catch
        {
            // Catch IndexOutOfRange or format exceptions if DB contains invalid/legacy hashes
            return false;
        }
    }
}
