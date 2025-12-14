using System.Security.Cryptography;
using System.Text;

namespace SessionManager.Agent.Services;

public sealed class AgentIdentityProvider
{
    private readonly string _dataDir;
    private readonly string _idFilePath;

    public AgentIdentityProvider()
    {
        var programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
        _dataDir = Path.Combine(programData, "1CSessionManager");
        _idFilePath = Path.Combine(_dataDir, "agent-id.txt");
    }

    public Guid GetOrCreateAgentId()
    {
        Directory.CreateDirectory(_dataDir);

        if (File.Exists(_idFilePath))
        {
            var txt = File.ReadAllText(_idFilePath).Trim();
            if (Guid.TryParse(txt, out var id))
                return id;
        }

        // Deterministic fallback based on machine name (so it is stable even if file is deleted)
        // plus random salt to avoid collisions between clones if needed.
        var stable = CreateDeterministicGuid(Environment.MachineName);
        File.WriteAllText(_idFilePath, stable.ToString("D"), Encoding.UTF8);
        return stable;
    }

    private static Guid CreateDeterministicGuid(string input)
    {
        var bytes = Encoding.UTF8.GetBytes(input);
        var hash = SHA256.HashData(bytes);
        Span<byte> guidBytes = stackalloc byte[16];
        hash.AsSpan(0, 16).CopyTo(guidBytes);
        return new Guid(guidBytes);
    }
}


