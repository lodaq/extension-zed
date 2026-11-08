export const CWS_ENV_KEYS = [
  "CWS_CLIENT_ID",
  "CWS_CLIENT_SECRET",
  "CWS_REFRESH_TOKEN",
  "CWS_PUBLISHER_ID",
  "CWS_EXTENSION_ID",
]

export function requireCwsEnvironment(env = process.env) {
  for (const name of CWS_ENV_KEYS) {
    if (!env[name]) throw new Error(`Missing required environment variable: ${name}`)
  }
}

export async function readJson(response, action) {
  const body = await response.text()
  let data
  try {
    data = body ? JSON.parse(body) : {}
  } catch {
    throw new Error(`${action} returned an invalid JSON response`)
  }
  if (!response.ok) {
    const message = typeof data.error?.message === "string" ? data.error.message : body
    throw new Error(`${action} failed (${response.status}): ${message.slice(0, 1000)}`)
  }
  return data
}

export async function getCwsAccessToken(env = process.env) {
  requireCwsEnvironment(env)
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.CWS_CLIENT_ID,
      client_secret: env.CWS_CLIENT_SECRET,
      refresh_token: env.CWS_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  })
  const data = await readJson(response, "Access-token request")
  if (typeof data.access_token !== "string") {
    throw new Error("Access-token response did not contain an access token")
  }
  return data.access_token
}

export async function fetchCwsItemStatus(accessToken, publisherId, extensionId) {
  const itemPath = `publishers/${encodeURIComponent(publisherId)}/items/${encodeURIComponent(extensionId)}`
  const response = await fetch(
    `https://chromewebstore.googleapis.com/v2/${itemPath}:fetchStatus`,
    { headers: { authorization: `Bearer ${accessToken}` } }
  )
  return readJson(response, "Chrome Web Store status request")
}
