const fs = require('fs');

// Fix app/admin/stays/[id]/page.tsx
const adminFile = 'app/admin/stays/[id]/page.tsx';
let adminContent = fs.readFileSync(adminFile, 'utf8');

// Fix type Room
adminContent = adminContent.replace(
    /type Room = \{[\s\S]*?amenities: string\[\];\r?\n\};/,
    `type Room = {
    id?: string;
    name: string;
    description: string;
    capacity: number;
    priceUSDC: number;
    priceUSDT: number;
    images: string[];
    amenities: string[];
    beds?: string;
    area?: string;
    roomsLeft?: number;
};`
);

// Fix implicit any
adminContent = adminContent.replace(/landmarks\.filter\(\(\_, i\)/g, 'landmarks.filter((_: any, i: number)');
adminContent = adminContent.replace(/\.map\(\(landmark, i\)/g, '.map((landmark: any, i: number)');

fs.writeFileSync(adminFile, adminContent, 'utf8');
console.log('Fixed admin page');

// Fix app/stay/[stayId]/page.tsx
const stayFile = 'app/stay/[stayId]/page.tsx';
let stayContent = fs.readFileSync(stayFile, 'utf8');

stayContent = stayContent.replace(
    /address: stay\.address,/g,
    'address: stay.address as any,'
);

fs.writeFileSync(stayFile, stayContent, 'utf8');
console.log('Fixed stay page');
