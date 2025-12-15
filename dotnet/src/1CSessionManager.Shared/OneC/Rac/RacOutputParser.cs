using System.Globalization;

namespace SessionManager.Shared.OneC.Rac;

public static class RacOutputParser
{
    public static IReadOnlyList<Dictionary<string, string>> ParseBlocks(string? output)
    {
        if (string.IsNullOrWhiteSpace(output))
            return Array.Empty<Dictionary<string, string>>();

        var normalized = output.Replace("\r\n", "\n");
        var blocks = normalized.Split("\n\n", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var list = new List<Dictionary<string, string>>(blocks.Length);
        foreach (var block in blocks)
        {
            var item = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var lines = block.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            foreach (var line in lines)
            {
                var idx = line.IndexOf(':');
                if (idx <= 0) continue;

                var rawKey = line[..idx].Trim().TrimStart('\uFEFF'); // remove BOM if any
                var key = NormalizeKey(rawKey);
                if (key.Length == 0) continue;

                var val = line[(idx + 1)..].Trim();
                if (val.Length >= 2 && val.StartsWith('"') && val.EndsWith('"'))
                    val = val[1..^1];

                item[key] = val;
            }

            if (item.Count > 0)
                list.Add(item);
        }

        return list;
    }

    public static DateTime? TryParseRacDateUtc(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        // RAC sometimes returns ISO-ish, sometimes local-ish. We keep tolerant parsing.
        if (DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var dto))
            return dto.UtcDateTime;

        if (DateTime.TryParse(value, CultureInfo.GetCultureInfo("ru-RU"), DateTimeStyles.AssumeLocal, out var dt))
            return DateTime.SpecifyKind(dt, DateTimeKind.Local).ToUniversalTime();

        return null;
    }

    private static string NormalizeKey(string key)
    {
        return key
            .Trim()
            .ToLowerInvariant()
            .Replace("-", "_")
            .Replace(" ", "_");
    }
}
