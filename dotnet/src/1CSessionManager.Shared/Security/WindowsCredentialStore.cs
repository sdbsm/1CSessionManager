using System.Runtime.InteropServices;
using System.Text;

namespace SessionManager.Shared.Security;

/// <summary>
/// Minimal wrapper around Windows Credential Manager.
/// Stores secrets in OS vault (DPAPI protected), not in files.
/// </summary>
public sealed class WindowsCredentialStore
{
    public string? ReadSecret(string target)
    {
        if (!OperatingSystem.IsWindows())
            throw new PlatformNotSupportedException("Windows Credential Manager is supported only on Windows.");

        if (!CredRead(target, CRED_TYPE_GENERIC, 0, out var credPtr))
            return null;

        try
        {
            var cred = Marshal.PtrToStructure<CREDENTIAL>(credPtr);
            if (cred.CredentialBlobSize == 0 || cred.CredentialBlob == IntPtr.Zero)
                return null;

            var bytes = new byte[cred.CredentialBlobSize];
            Marshal.Copy(cred.CredentialBlob, bytes, 0, bytes.Length);
            return Encoding.UTF8.GetString(bytes);
        }
        finally
        {
            CredFree(credPtr);
        }
    }

    public void WriteSecret(string target, string secret)
    {
        if (!OperatingSystem.IsWindows())
            throw new PlatformNotSupportedException("Windows Credential Manager is supported only on Windows.");

        var bytes = Encoding.UTF8.GetBytes(secret);
        if (bytes.Length > 5120)
            throw new ArgumentOutOfRangeException(nameof(secret), "Credential blob too large.");

        var cred = new CREDENTIAL
        {
            Type = CRED_TYPE_GENERIC,
            TargetName = target,
            Persist = CRED_PERSIST_LOCAL_MACHINE,
            CredentialBlobSize = (uint)bytes.Length,
            CredentialBlob = Marshal.AllocHGlobal(bytes.Length),
            UserName = Environment.UserName
        };

        try
        {
            Marshal.Copy(bytes, 0, cred.CredentialBlob, bytes.Length);
            if (!CredWrite(ref cred, 0))
            {
                var err = Marshal.GetLastWin32Error();
                throw new InvalidOperationException($"CredWrite failed. Win32Error={err}");
            }
        }
        finally
        {
            if (cred.CredentialBlob != IntPtr.Zero)
                Marshal.FreeHGlobal(cred.CredentialBlob);
        }
    }

    private const uint CRED_TYPE_GENERIC = 1;
    private const uint CRED_PERSIST_LOCAL_MACHINE = 2;

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CredRead(string target, uint type, int reservedFlag, out IntPtr credentialPtr);

    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CredWrite([In] ref CREDENTIAL userCredential, [In] uint flags);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern void CredFree([In] IntPtr buffer);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct CREDENTIAL
    {
        public uint Flags;
        public uint Type;
        public string TargetName;
        public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }
}


