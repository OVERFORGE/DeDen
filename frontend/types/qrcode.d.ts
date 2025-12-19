// types/qrcode.d.ts
declare module 'qrcode' {
  export function toDataURL(
    text: string,
    options?: any
  ): Promise<string>;
  
  // Add other methods if needed
}