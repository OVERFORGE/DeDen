const fs = require('fs');
let content = fs.readFileSync('app/admin/stays/[id]/page.tsx', 'utf8');
content = content.replace('highlights: string[];', 'highlights: string[];\n    rules: string[];\n    address: any;');
fs.writeFileSync('app/admin/stays/[id]/page.tsx', content, 'utf8');
console.log('Fixed type Stay');
