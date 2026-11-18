using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;

class ZedDownloader {
    static int Main() {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        var start = new ProcessStartInfo {
            FileName = File.ReadAllText(Path.Combine(root, "python-path.txt")).Trim(),
            Arguments = "-I \"" + Path.Combine(root, "zed_downloader.py") + "\"",
            UseShellExecute = false, RedirectStandardInput = true,
            RedirectStandardOutput = true, CreateNoWindow = true
        };
        using (var child = Process.Start(start)) {
            var input = Task.Run(async () => {
                await Console.OpenStandardInput().CopyToAsync(child.StandardInput.BaseStream);
                child.StandardInput.Close();
            });
            child.StandardOutput.BaseStream.CopyTo(Console.OpenStandardOutput());
            child.WaitForExit();
            return child.ExitCode;
        }
    }
}
