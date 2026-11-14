using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Collections.Generic;
class ZedNative {
    static string Quote(string value) {
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }
    static bool ReadExact(Stream input, byte[] buffer) {
        int offset = 0;
        while (offset < buffer.Length) {
            int count = input.Read(buffer, offset, buffer.Length - offset);
            if (count == 0) return false;
            offset += count;
        }
        return true;
    }
    static int Main(string[] args) {
        if (args.Length == 0 || !args[0].StartsWith("chrome-extension://")) return 1;
        string root = AppDomain.CurrentDomain.BaseDirectory;
        var config = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(File.ReadAllText(Path.Combine(root, "config.json")));
        // Paths come from administrator-owned configuration, never from a message.
        var start = new ProcessStartInfo((string)config["python"], "-I " + Quote(Path.Combine(root, "zed_limiter.py")) + " native " + Quote(args[0]));
        start.UseShellExecute = false;
        start.CreateNoWindow = true;
        start.RedirectStandardInput = true;
        start.RedirectStandardOutput = true;
        using (var child = Process.Start(start)) {
            var output = child.StandardOutput.BaseStream.CopyToAsync(Console.OpenStandardOutput());
            // Native messages are request/response; forward exactly one framed request.
            var input = Console.OpenStandardInput();
            byte[] header = new byte[4];
            if (!ReadExact(input, header)) return 1;
            int length = BitConverter.ToInt32(header, 0);
            if (length <= 0 || length > 65536) return 1;
            child.StandardInput.BaseStream.Write(header, 0, 4);
            byte[] body = new byte[length];
            if (!ReadExact(input, body)) return 1;
            child.StandardInput.BaseStream.Write(body, 0, length);
            child.StandardInput.BaseStream.Flush();
            child.StandardInput.Close();
            child.WaitForExit();
            output.Wait();
            return child.ExitCode;
        }
    }
}
