declare module "jsqr" {
  export type QRCode = {
    data: string;
  } | null;

  export default function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" },
  ): QRCode;
}
