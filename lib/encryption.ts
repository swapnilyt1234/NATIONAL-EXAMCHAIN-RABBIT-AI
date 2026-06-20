import CryptoJS from "crypto-js";

const IV_BYTES = 16;

function toAesKeyWordArray(key: string): CryptoJS.lib.WordArray {
  if (!key || key.trim().length === 0) {
    throw new Error("Encryption key is required.");
  }

  const normalizedKey = key.trim();

  if (/^[0-9a-fA-F]{64}$/.test(normalizedKey)) {
    return CryptoJS.enc.Hex.parse(normalizedKey);
  }

  return CryptoJS.SHA256(normalizedKey);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to convert file to base64."));
        return;
      }

      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };

    reader.onerror = () => {
      reject(new Error("Unable to read file for encryption."));
    };

    reader.readAsDataURL(file);
  });
}

function base64ToBlob(base64: string, mimeType = "application/octet-stream"): Blob {
  const binaryString = atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);

  for (let index = 0; index < length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

type DecryptedPayload = {
  name: string;
  type: string;
  blob: Blob;
};

export function generateKey(): string {
  return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
}

export async function encryptFile(file: File, key: string): Promise<string> {
  if (!(file instanceof File)) {
    throw new Error("A valid file is required for encryption.");
  }

  const fileBase64 = await fileToBase64(file);
  const payload = JSON.stringify({
    name: file.name,
    type: file.type || "application/octet-stream",
    data: fileBase64,
  });

  const iv = CryptoJS.lib.WordArray.random(IV_BYTES);
  const aesKey = toAesKeyWordArray(key);

  const encrypted = CryptoJS.AES.encrypt(payload, aesKey, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return `${iv.toString(CryptoJS.enc.Hex)}:${encrypted.toString()}`;
}

export function decryptFileWithMetadata(cipherText: string, key: string): DecryptedPayload {
  if (!cipherText || cipherText.trim().length === 0) {
    throw new Error("Cipher text is required for decryption.");
  }

  const [ivHex, encryptedPayload] = cipherText.split(":");
  if (!ivHex || !encryptedPayload) {
    throw new Error("Invalid encrypted format. Expected 'iv:cipherText'.");
  }

  const aesKey = toAesKeyWordArray(key);
  const iv = CryptoJS.enc.Hex.parse(ivHex);

  const decrypted = CryptoJS.AES.decrypt(encryptedPayload, aesKey, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
  if (!decryptedText) {
    throw new Error("Failed to decrypt content. Check the key and cipher text.");
  }

  let parsed: { name?: string; type?: string; data?: string };

  try {
    parsed = JSON.parse(decryptedText) as { type?: string; data?: string };
  } catch {
    throw new Error("Decrypted payload is not valid JSON.");
  }

  if (!parsed.data) {
    throw new Error("Decrypted payload does not contain file data.");
  }

  const fileName = parsed.name && parsed.name.trim().length > 0 ? parsed.name : "exam-paper.bin";
  const mimeType = parsed.type || "application/octet-stream";

  return {
    name: fileName,
    type: mimeType,
    blob: base64ToBlob(parsed.data, mimeType),
  };
}

export function decryptFile(cipherText: string, key: string): Blob {
  return decryptFileWithMetadata(cipherText, key).blob;
}
