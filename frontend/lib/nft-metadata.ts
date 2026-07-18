// File: lib/nft-metadata.ts
// ✅ With embedded logo, villa image, and QR code

import axios from 'axios';
import QRCode  from 'qrcode';
import fs from 'fs';
import path from 'path';

const PINATA_API_KEY = process.env.PINATA_API_KEY!;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY!;
const PINATA_API_URL = 'https://api.pinata.cloud';

/**
 * Convert image file to base64
 */
function imageToBase64(imagePath: string): string {
  try {
    const fullPath = path.join(process.cwd(), 'public', imagePath);
    const imageBuffer = fs.readFileSync(fullPath);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).slice(1);
    return `data:image/${ext};base64,${base64Image}`;
  } catch (error) {
    console.error(`[NFT] Error loading image ${imagePath}:`, error);
    return '';
  }
}

/**
 * Generate QR code as base64 PNG
 */
async function generateQRCodeBase64(bookingId: string): Promise<string> {
  const qrData = `https://deden.space/booking/${bookingId}`;
  
  try {
    const qrDataURL = await QRCode.toDataURL(qrData, {
      color: {
        dark: '#172a46',
        light: '#E7E4DF',
      },
      width: 200,
      margin: 2,
      errorCorrectionLevel: 'H',
    });
    
    return qrDataURL;
  } catch (error) {
    console.error('[NFT] Error generating QR code:', error);
    throw error;
  }
}

/**
 * Generate enhanced SVG ticket with logo, villa, and QR code
 */
async function generateTicketImage(booking: {
  bookingId: string;
  stayTitle: string;
  location: string;
  checkInDate: Date;
  checkOutDate: Date;
  guestName: string;
  numberOfNights: number;
}): Promise<string> {
  console.log('[NFT] Loading images...');
  
  // Load logo and villa images
  const logoBase64 = imageToBase64('images/logo-no-bg.png');
  const villaBase64 = imageToBase64('images/villa-bg-remove.png');
  
  console.log('[NFT] Generating QR code...');
  const qrCodeBase64 = await generateQRCodeBase64(booking.bookingId);
  
  console.log('[NFT] Creating ticket SVG...');
  const svg = `
    <svg width="1200" height="700" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        <!-- Gradient background -->
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#172a46;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#2a4a6a;stop-opacity:1" />
        </linearGradient>
        
        <!-- Decorative pattern -->
        <pattern id="pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="20" cy="20" r="1" fill="#E7E4DF" opacity="0.1"/>
        </pattern>
      </defs>
      
      <!-- Main Background -->
      <rect width="1200" height="700" fill="url(#grad1)"/>
      <rect width="1200" height="700" fill="url(#pattern)"/>
      
      <!-- Decorative borders -->
      <rect width="1200" height="10" fill="#E7E4DF" opacity="0.3"/>
      <rect y="690" width="1200" height="10" fill="#E7E4DF" opacity="0.3"/>
      
      <!-- ✅ LOGO - Top Center -->
      <image x="450" y="30" width="300" height="80" 
             href="${logoBase64}" 
             preserveAspectRatio="xMidYMid meet"/>
      
      <!-- Subtitle -->
      <text x="600" y="140" font-family="Arial, sans-serif" font-size="18" 
            fill="#E7E4DF" text-anchor="middle" opacity="0.7" letter-spacing="4">
        BOOKING TICKET
      </text>
      
      <!-- Decorative line -->
      <line x1="200" y1="165" x2="1000" y2="165" stroke="#E7E4DF" stroke-width="1" opacity="0.3"/>
      
      <!-- Left Section: Details -->
      <g>
        <!-- Stay Title -->
        <text x="100" y="230" font-family="Arial, sans-serif" font-size="36" 
              fill="#E7E4DF" font-weight="bold">
          ${booking.stayTitle}
        </text>
        
        <!-- Location -->
        <text x="100" y="275" font-family="Arial, sans-serif" font-size="22" 
              fill="#E7E4DF" opacity="0.8">
          📍 ${booking.location}
        </text>
        
        <!-- Guest Name Box -->
        <rect x="90" y="310" width="520" height="65" rx="12" fill="#E7E4DF" opacity="0.15"/>
        <text x="110" y="340" font-family="Arial, sans-serif" font-size="14" 
              fill="#E7E4DF" opacity="0.7">
          GUEST NAME
        </text>
        <text x="110" y="365" font-family="Arial, sans-serif" font-size="24" 
              fill="#E7E4DF" font-weight="bold">
          ${booking.guestName}
        </text>
        
        <!-- Check-in/out Grid -->
        <rect x="90" y="395" width="250" height="95" rx="12" fill="#E7E4DF" opacity="0.15"/>
        <text x="110" y="425" font-family="Arial, sans-serif" font-size="14" 
              fill="#E7E4DF" opacity="0.7">
          CHECK-IN
        </text>
        <text x="110" y="455" font-family="Arial, sans-serif" font-size="22" 
              fill="#E7E4DF" font-weight="bold">
          ${booking.checkInDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          })}
        </text>
        
        <rect x="360" y="395" width="250" height="95" rx="12" fill="#E7E4DF" opacity="0.15"/>
        <text x="380" y="425" font-family="Arial, sans-serif" font-size="14" 
              fill="#E7E4DF" opacity="0.7">
          CHECK-OUT
        </text>
        <text x="380" y="455" font-family="Arial, sans-serif" font-size="22" 
              fill="#E7E4DF" font-weight="bold">
          ${booking.checkOutDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          })}
        </text>
        
        <!-- Duration -->
        <rect x="90" y="510" width="520" height="55" rx="12" fill="#E7E4DF" opacity="0.15"/>
        <text x="110" y="548" font-family="Arial, sans-serif" font-size="20" 
              fill="#E7E4DF" font-weight="bold">
          🌙 ${booking.numberOfNights} Night${booking.numberOfNights !== 1 ? 's' : ''} Stay
        </text>
      </g>
      
      <!-- Right Section: Villa Image & QR Code -->
      <g>
        <!-- ✅ VILLA IMAGE -->
        <image x="680" y="200" width="420" height="280" 
               href="${villaBase64}" 
               preserveAspectRatio="xMidYMid meet"/>
        
        <!-- QR Code Container -->
        <rect x="780" y="490" width="240" height="140" rx="15" fill="#E7E4DF" opacity="0.95"/>
        
        <!-- ✅ QR CODE -->
        <image x="830" y="500" width="140" height="140" 
               href="${qrCodeBase64}" 
               preserveAspectRatio="xMidYMid meet"/>
        
        <!-- QR Label -->
        <text x="900" y="648" font-family="Arial, sans-serif" font-size="13" 
              fill="#172a46" text-anchor="middle" font-weight="bold">
          Scan to View Booking
        </text>
      </g>
      
      <!-- Footer: Booking ID -->
      <rect x="90" y="590" width="1020" height="45" rx="12" fill="#E7E4DF" opacity="0.1"/>
      <text x="600" y="620" font-family="monospace" font-size="16" 
            fill="#E7E4DF" text-anchor="middle" opacity="0.6">
        BOOKING ID: ${booking.bookingId}
      </text>
    </svg>
  `;

  const base64SVG = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64SVG}`;
}

/**
 * Upload NFT metadata to IPFS via Pinata
 */
export async function uploadNFTMetadata(booking: {
  bookingId: string;
  stayTitle: string;
  location: string;
  checkInDate: Date;
  checkOutDate: Date;
  guestName: string;
  numberOfNights: number;
}): Promise<string> {
  try {
    console.log(`[NFT] Generating branded ticket for booking ${booking.bookingId}...`);
    
    const imageDataURI = await generateTicketImage(booking);

    const metadata = {
      name: `DeDen: ${booking.stayTitle}`,
      description: `Decentralized Den booking ticket for ${booking.stayTitle} in ${booking.location}. Valid from ${booking.checkInDate.toLocaleDateString()} to ${booking.checkOutDate.toLocaleDateString()}. Where Web3 lives and builders connect. Scan the QR code to view your booking details.`,
      image: imageDataURI,
      external_url: `https://deden.space/booking/${booking.bookingId}`,
      attributes: [
        {
          trait_type: "Property",
          value: booking.stayTitle,
        },
        {
          trait_type: "Location",
          value: booking.location,
        },
        {
          trait_type: "Guest",
          value: booking.guestName,
        },
        {
          trait_type: "Check-in",
          value: booking.checkInDate.toISOString().split('T')[0],
          display_type: "date",
        },
        {
          trait_type: "Check-out",
          value: booking.checkOutDate.toISOString().split('T')[0],
          display_type: "date",
        },
        {
          trait_type: "Duration",
          value: booking.numberOfNights,
          display_type: "number",
        },
        {
          trait_type: "Booking ID",
          value: booking.bookingId,
        },
        {
          trait_type: "Has QR Code",
          value: "Yes",
        },
        {
          trait_type: "Branded",
          value: "DeDen Official",
        },
      ],
      properties: {
        booking_id: booking.bookingId,
        stay_title: booking.stayTitle,
        location: booking.location,
        guest_name: booking.guestName,
        check_in: booking.checkInDate.toISOString(),
        check_out: booking.checkOutDate.toISOString(),
        nights: booking.numberOfNights,
        platform: "Decentralized Den",
        website: "https://deden.space",
        qr_code_url: `https://deden.space/booking/${booking.bookingId}`,
      },
    };

    console.log(`[NFT] Uploading metadata to Pinata...`);

    const response = await axios.post(
      `${PINATA_API_URL}/pinning/pinJSONToIPFS`,
      metadata,
      {
        headers: {
          'Content-Type': 'application/json',
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY,
        },
      }
    );

    const ipfsHash = response.data.IpfsHash;
    const ipfsUri = `ipfs://${ipfsHash}`;
    
    console.log(`[NFT] ✅ Branded ticket with logo & villa uploaded successfully!`);
    console.log(`[NFT] IPFS URI: ${ipfsUri}`);
    
    return ipfsUri;
  } catch (error) {
    console.error('[NFT] ❌ Error uploading to Pinata:', error);
    if (axios.isAxiosError(error)) {
      console.error('[NFT] Response:', error.response?.data);
    }
    throw new Error(`Failed to upload metadata: ${(error as Error).message}`);
  }
}

export async function testPinataConnection(): Promise<boolean> {
  try {
    const response = await axios.get(
      `${PINATA_API_URL}/data/testAuthentication`,
      {
        headers: {
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY,
        },
      }
    );

    console.log('[NFT] ✅ Pinata connection successful!');
    return true;
  } catch (error) {
    console.error('[NFT] ❌ Pinata connection failed:', error);
    return false;
  }
}

export { generateTicketImage };