const fs = require('fs');
const path = require('path');

const filePath = path.join('d:\\PROGRAMMING\\Projects\\DeDen\\frontend', 'components/VillaStayCard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update imports
content = content.replace(
  /import { Bed, Tag, Home, Users, Globe, Coffee, Backpack, ArrowRight, ArrowLeft } from "lucide-react";/,
  `import { Bed, Tag, Home, Users, Globe, Coffee, Backpack, ArrowRight, ArrowLeft, Wifi, MapPin, Sun, Wind, Music, TreePine } from "lucide-react";`
);

// 2. Add IconMap and update StayProps
content = content.replace(
  /type StayProps = \{/,
  `const IconMap: Record<string, any> = { Home, Users, Globe, Coffee, Backpack, Wifi, MapPin, Sun, Wind, Music, TreePine };

type StayProps = {`
);

content = content.replace(
  /heroImage\?: string \| null;/,
  `heroImage?: string | null;
    amenityIcons?: { icon: string; text: string }[];`
);

// 3. Update the Bottom Amenities Bar
const bottomBarRegex = /\{\/\* Bottom Amenities Bar \*\/\}.*?<\/div>\s*<\/div>\s*\);\s*\}/s;

const newBottomBar = `{/* Bottom Amenities Bar */}
      <div className="w-full bg-[#ebdcc2] rounded-xl mt-4 py-4 px-6 md:px-12 flex flex-wrap justify-between items-center shadow-sm">
        {(stay.amenityIcons && stay.amenityIcons.length > 0) ? (
          stay.amenityIcons.map((am, i) => {
            const IconComponent = IconMap[am.icon] || Home;
            return (
              <div key={i} className="flex items-center gap-1.5 md:gap-3 mb-2 md:mb-0 w-[45%] md:w-auto mt-2 md:mt-0">
                <IconComponent size={22} className="text-[#46392b]/70" strokeWidth={1} />
                <span className="text-[7px] font-black text-[#46392b]/70 uppercase tracking-widest">{am.text}</span>
                {i < stay.amenityIcons!.length - 1 && (
                  <div className="hidden md:block w-px h-6 bg-[#46392b]/10 ml-6"></div>
                )}
              </div>
            );
          })
        ) : (
          // Default fallback
          <>
            <div className="flex flex-col items-center gap-1.5 mb-2 md:mb-0 w-[30%] md:w-auto">
              <Home size={22} className="text-[#46392b]/70" strokeWidth={1} />
              <span className="text-[7px] font-black text-[#46392b]/70 uppercase tracking-widest">Cozy Spaces</span>
            </div>
            <div className="hidden md:block w-px h-6 bg-[#46392b]/10"></div>
            <div className="flex flex-col items-center gap-1.5 mb-2 md:mb-0 w-[30%] md:w-auto">
              <Users size={22} className="text-[#46392b]/70" strokeWidth={1} />
              <span className="text-[7px] font-black text-[#46392b]/70 uppercase tracking-widest">Good People</span>
            </div>
            <div className="hidden md:block w-px h-6 bg-[#46392b]/10"></div>
            <div className="flex flex-col items-center gap-1.5 mb-2 md:mb-0 w-[30%] md:w-auto">
              <Globe size={22} className="text-[#46392b]/70" strokeWidth={1} />
              <span className="text-[7px] font-black text-[#46392b]/70 uppercase tracking-widest">New Stories</span>
            </div>
            <div className="hidden md:block w-px h-6 bg-[#46392b]/10"></div>
            <div className="flex flex-col items-center gap-1.5 mb-2 md:mb-0 w-[45%] md:w-auto mt-2 md:mt-0">
              <Coffee size={22} className="text-[#46392b]/70" strokeWidth={1} />
              <span className="text-[7px] font-black text-[#46392b]/70 uppercase tracking-widest">Slow Days</span>
            </div>
            <div className="hidden md:block w-px h-6 bg-[#46392b]/10"></div>
            <div className="flex flex-col items-center gap-1.5 mb-2 md:mb-0 w-[45%] md:w-auto mt-2 md:mt-0">
              <Backpack size={22} className="text-[#46392b]/70" strokeWidth={1} />
              <span className="text-[7px] font-black text-[#46392b]/70 uppercase tracking-widest">Lasting Memories</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}`;

content = content.replace(bottomBarRegex, newBottomBar);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated VillaStayCard.tsx');
