import CryptoJS from "crypto-js";

export function generatePromptHash(prompt: string): string {
  return CryptoJS.SHA256(prompt.toLowerCase().trim()).toString().substring(0, 16);
}
