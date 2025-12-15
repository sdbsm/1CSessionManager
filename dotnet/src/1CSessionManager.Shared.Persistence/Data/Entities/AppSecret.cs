namespace SessionManager.Shared.Data.Entities;

/// <summary>
/// Хранилище секретов приложения (в DB, но не в открытом виде).
/// Значение хранится как DPAPI(LocalMachine) base64.
/// </summary>
public sealed class AppSecret
{
    public string Key { get; set; } = null!;
    public string ProtectedValueBase64 { get; set; } = null!;
    public DateTime UpdatedAtUtc { get; set; }
}


