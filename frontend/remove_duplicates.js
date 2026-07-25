const fs = require('fs');
let content = fs.readFileSync('app/admin/stays/[id]/page.tsx', 'utf8');

const regex = /rules:\s*stay\?\.rules\s*\|\|\s*\[\],\s*address:\s*stay\?\.address\s*\|\|\s*null,\s*rules:\s*stay\?\.rules\s*\|\|\s*\[\],\s*address:\s*stay\?\.address\s*\|\|\s*null,/g;

if (regex.test(content)) {
    content = content.replace(regex, `rules: stay?.rules || [],
                    address: stay?.address || null,`);
    fs.writeFileSync('app/admin/stays/[id]/page.tsx', content, 'utf8');
    console.log('Successfully removed duplicates from onSubmit');
} else {
    console.log('Regex did not match.');
}
