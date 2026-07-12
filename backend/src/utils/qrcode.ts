import QRCode from 'qrcode';
import { env } from '../config/env';

export function getSiteParkingUrl(siteCode: string): string {
  return `${env.CLIENT_URL}/parking/${siteCode}`;
}

export async function generateSiteQrDataUrl(siteCode: string): Promise<string> {
  return QRCode.toDataURL(getSiteParkingUrl(siteCode), {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 512,
    color: { dark: '#09090b', light: '#ffffff' },
  });
}

export async function generateSiteQrPngBuffer(siteCode: string): Promise<Buffer> {
  return QRCode.toBuffer(getSiteParkingUrl(siteCode), {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 1024,
    color: { dark: '#09090b', light: '#ffffff' },
  });
}
