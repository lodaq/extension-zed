import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

export const EXTENSION_DIST = path.resolve("dist")
export const parseTextContent = result => result?.content?.map(item => item.type === "text" ? item.text : JSON.stringify(item)).join("\n") ?? ""

export class DevToolsClient {
  pending = new Map()
  reqId = 0
  buffer = ""

  async start() {
    this.profile = await fs.mkdtemp(path.join(os.tmpdir(), "zed-e2e-"))
    this.proc = spawn("npx", [
      "-y", "chrome-devtools-mcp@1.13.0", "--categoryExtensions", "--headless",
      `--userDataDir=${this.profile}`,
      `--executablePath=${process.env.CHROME_PATH ?? "/home/sebaq/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome"}`,
      `--workspace=${path.resolve(".")}`, "--ignore-default-chrome-arg=--disable-extensions",
      "--chrome-arg=--no-sandbox", "--chrome-arg=--disable-setuid-sandbox",
      "--chrome-arg=--headless=new", "--no-usage-statistics", "--no-performance-crux",
    ], { stdio: ["pipe", "pipe", "inherit"], detached: process.platform !== "win32" })
    this.proc.stdout.on("data", chunk => {
      this.buffer += chunk.toString("utf8")
      const lines = this.buffer.split("\n")
      this.buffer = lines.pop() ?? ""
      for (const line of lines) {
        let message
        try { message = JSON.parse(line) } catch { continue }
        const request = this.pending.get(message.id)
        if (!request) continue
        this.pending.delete(message.id)
        clearTimeout(request.timer)
        if (message.error) request.reject(new Error(message.error.message))
        else request.resolve(message.result)
      }
    })
    const rejectPending = error => {
      for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(error) }
      this.pending.clear()
    }
    this.proc.on("error", rejectPending)
    this.proc.on("exit", code => rejectPending(new Error(`Browser test server exited: ${code}`)))
    await this.request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "zed-e2e", version: "1" } })
    this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n")
  }

  request(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.reqId
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Browser test request timed out: ${method}`)) }, 60000)
      this.pending.set(id, { resolve, reject, timer })
      this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n", error => {
        if (error) { clearTimeout(timer); this.pending.delete(id); reject(error) }
      })
    })
  }

  callTool(name, args = {}) { return this.request("tools/call", { name, arguments: args }) }

  async close() {
    if (this.proc && this.proc.exitCode === null) {
      await new Promise(resolve => {
        const timer = setTimeout(() => {
          if (process.platform === "win32") this.proc.kill()
          else { try { process.kill(-this.proc.pid, "SIGTERM") } catch { /* Process already stopped. */ } }
          resolve()
        }, 5000)
        this.proc.once("exit", () => { clearTimeout(timer); resolve() })
        this.proc.stdin.end()
      })
    }
    if (this.profile) await fs.rm(this.profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  }
}
