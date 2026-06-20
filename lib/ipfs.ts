const PINATA_BASE_URL = "https://api.pinata.cloud";
const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs";

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 500;

function getPinataCredentials() {
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;
  const apiKey = process.env.NEXT_PUBLIC_PINATA_API_KEY;
  const secret = process.env.NEXT_PUBLIC_PINATA_SECRET;

  if (jwt && jwt.trim().length > 0) {
    return { authType: "jwt" as const, jwt: jwt.trim() };
  }

  if (!apiKey || !secret) {
    throw new Error(
      "Missing Pinata credentials. Set NEXT_PUBLIC_PINATA_JWT (recommended) or NEXT_PUBLIC_PINATA_API_KEY + NEXT_PUBLIC_PINATA_SECRET.",
    );
  }

  return { authType: "keypair" as const, apiKey, secret };
}

function buildPinataHeaders(): Record<string, string> {
  const credentials = getPinataCredentials();

  if (credentials.authType === "jwt") {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${credentials.jwt}`,
    };
  }

  return {
    "Content-Type": "application/json",
    pinata_api_key: credentials.apiKey,
    pinata_secret_api_key: credentials.secret,
  };
}

async function withRetry<T>(operation: () => Promise<T>, context: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) break;

      const delay = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${context} failed after ${MAX_RETRIES} attempts: ${message}`);
}

async function readResponseTextWithProgress(response: Response, label: string): Promise<string> {
  const contentLengthHeader = response.headers.get("content-length");
  const totalBytes = contentLengthHeader ? Number(contentLengthHeader) : undefined;

  if (!response.body) {
    return response.text();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    chunks.push(value);
    loadedBytes += value.length;

    if (totalBytes && totalBytes > 0) {
      const percent = Math.min(100, Math.round((loadedBytes / totalBytes) * 100));
      console.info(`[IPFS:${label}] download progress ${percent}%`);
    }
  }

  const merged = new Uint8Array(loadedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder().decode(merged);
}

/**
 * Client-side flow:
 * 1) File -> Encrypt (AES) in browser
 * 2) Upload encrypted payload to IPFS
 * 3) Store returned CID on-chain
 * 4) Fetch by CID -> Download encrypted payload
 * 5) Decrypt client-side and display content
 */
export async function uploadToIPFS(encryptedData: string): Promise<string> {
  if (!encryptedData || encryptedData.trim().length === 0) {
    throw new Error("Encrypted data is required for IPFS upload.");
  }

  const headers = buildPinataHeaders();

  return withRetry(async () => {
    console.info("[IPFS:upload] progress 10% - preparing payload");

    const response = await fetch(`${PINATA_BASE_URL}/pinning/pinJSONToIPFS`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        pinataMetadata: {
          name: `edu-encrypted-content-${Date.now()}`,
        },
        pinataContent: {
          encryptedData,
          createdAt: new Date().toISOString(),
        },
      }),
    });

    console.info("[IPFS:upload] progress 80% - waiting for CID");

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 403 && body.includes("NO_SCOPES_FOUND")) {
        throw new Error(
          "Pinata upload forbidden: API key/JWT is missing required scopes. Enable pinning scope for pinJSONToIPFS (or create a JWT with pinning access).",
        );
      }
      throw new Error(`Pinata upload error (${response.status}): ${body}`);
    }

    const data = (await response.json()) as { IpfsHash?: string };
    if (!data.IpfsHash) {
      throw new Error("Pinata response missing IpfsHash.");
    }

    console.info("[IPFS:upload] progress 100% - upload complete");
    return data.IpfsHash;
  }, "IPFS upload");
}

export async function fetchFromIPFS(cid: string): Promise<string> {
  if (!cid || cid.trim().length === 0) {
    throw new Error("CID is required to fetch IPFS content.");
  }

  return withRetry(async () => {
    const response = await fetch(`${PINATA_GATEWAY}/${cid}`);

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`IPFS fetch error (${response.status}): ${body}`);
    }

    const raw = await readResponseTextWithProgress(response, "fetch");

    try {
      const parsed = JSON.parse(raw) as { encryptedData?: string };
      if (parsed.encryptedData && typeof parsed.encryptedData === "string") {
        return parsed.encryptedData;
      }
      return raw;
    } catch {
      return raw;
    }
  }, "IPFS fetch");
}
