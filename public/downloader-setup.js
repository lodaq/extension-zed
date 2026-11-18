import setup from "./downloader-setup-data.js"

const status = document.querySelector("#copy-status")
const field = document.querySelector("#setup-command")

for (const button of document.querySelectorAll("button[data-python]")) {
  button.addEventListener("click", async () => {
    const install = `-I -c "import base64, io, pathlib, runpy, tempfile, zipfile; folder = tempfile.TemporaryDirectory(); zipfile.ZipFile(io.BytesIO(base64.b64decode('${setup.helper}'))).extractall(folder.name); runpy.run_path(str(pathlib.Path(folder.name) / 'install.py'), run_name='__main__'); folder.cleanup()"`
    const shellScript = `${setup.unix}exec python3 ${install} "$@"`
    const command = button.dataset.python === "python"
      ? `& {
${setup.windows}& python ${install} @args
if ($LASTEXITCODE -ne 0) { throw 'Downloader registration failed.' }
}`
      : `sh -c '${shellScript.replaceAll("'", "'\\''")}' zed-downloader-setup`
    try {
      await navigator.clipboard.writeText(command)
      status.textContent = "Setup command copied."
      field.hidden = true
    } catch {
      status.textContent = "Clipboard unavailable. Copy the command from the field below."
      field.value = command
      field.hidden = false
      field.focus()
      field.select()
    }
  })
}
