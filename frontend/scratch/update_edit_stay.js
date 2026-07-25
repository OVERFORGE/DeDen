const fs = require('fs');
const path = require('path');

const filePath = path.join('d:\\PROGRAMMING\\Projects\\DeDen\\frontend', 'app/admin/stays/[id]/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add amenityIcons to type
content = content.replace(
  /enabledChains:\s*number\[\];\s*}/,
  "enabledChains: number[];\n    amenityIcons?: { icon: string; text: string }[];\n}"
);

// 2. Add 'icons' to activeTab
content = content.replace(
  /const \[activeTab,\s*setActiveTab\]\s*=\s*useState<.*?>\('basic'\);/,
  "const [activeTab, setActiveTab] = useState<'basic' | 'images' | 'rooms' | 'amenities' | 'icons' | 'location' | 'rules' | 'reservation'>('basic');"
);

// 3. Add states for icons
content = content.replace(
  /const \[newRule, setNewRule\] = useState\(''\);/,
  "const [newRule, setNewRule] = useState('');\n    const [newIconName, setNewIconName] = useState('Home');\n    const [newIconText, setNewIconText] = useState('');"
);

// 4. Initialize in fetchStay
content = content.replace(
  /data\.rules = data\.rules \|\| \[\];/,
  "data.rules = data.rules || [];\n            data.amenityIcons = data.amenityIcons || [];"
);

// 5. Add icon removal function
content = content.replace(
  /const removeRule = \(index: number\) => \{[^}]+\};\n/,
  `$&
    const addIcon = () => {
        if (!newIconText.trim() || !stay) return;
        const currentIcons = stay.amenityIcons || [];
        setStay({ ...stay, amenityIcons: [...currentIcons, { icon: newIconName, text: newIconText.trim() }] });
        setNewIconText('');
    };

    const removeIcon = (index: number) => {
        if (!stay) return;
        const newIcons = [...(stay.amenityIcons || [])];
        newIcons.splice(index, 1);
        setStay({ ...stay, amenityIcons: newIcons });
    };
`
);

// 6. Add tab button
const tabRegex = /(<button[^>]*onClick={\(\) => setActiveTab\('amenities'\)}[^>]*>.*?<\/button>)/s;
content = content.replace(tabRegex, `$1\n                                <button\n                                    type="button"\n                                    onClick={() => setActiveTab('icons')}\n                                    className={\`px-4 py-3 font-medium text-sm whitespace-nowrap transition-colors border-b-2 \${activeTab === 'icons' ? 'border-[#3D4331] text-[#3D4331]' : 'border-transparent text-[#3D4331]/60 hover:text-[#3D4331] hover:border-[#96A476]'}\`}\n                                >\n                                    Card Icons\n                                </button>`);


// 7. Add tab content
const amenitiesTabContentRegex = /(\{\/\*\s*Amenities Tab\s*\*\/.*?\}\s*\))(?=\s*\{\/\*\s*Location Tab\s*\*\/)/s;
content = content.replace(amenitiesTabContentRegex, `$1

                {/* Icons Tab */}
                {activeTab === 'icons' && (
                    <div className="bg-[#EBE1D0] p-6 rounded-xl shadow-sm mb-6 space-y-5 border border-[#96A476]/20">
                        <h3 className="text-2xl font-serif font-bold text-[#3D4331] border-b border-[#96A476]/30 pb-3 mb-4">Card Icons</h3>
                        <p className="text-sm text-[#3D4331]/70 mb-4">These icons will be displayed dynamically at the bottom of the VillaStayCard on the main listings page.</p>
                        
                        <div className="flex gap-3">
                            <select
                                value={newIconName}
                                onChange={(e) => setNewIconName(e.target.value)}
                                className="w-40 p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476] bg-[#F3EDE0] text-[#3D4331]"
                            >
                                <option value="Home">Home</option>
                                <option value="Users">Users</option>
                                <option value="Globe">Globe</option>
                                <option value="Coffee">Coffee</option>
                                <option value="Backpack">Backpack</option>
                                <option value="Wifi">Wifi</option>
                                <option value="MapPin">MapPin</option>
                                <option value="Sun">Sun</option>
                                <option value="Wind">Wind</option>
                                <option value="Music">Music</option>
                                <option value="TreePine">TreePine</option>
                            </select>
                            <input
                                type="text"
                                value={newIconText}
                                onChange={(e) => setNewIconText(e.target.value)}
                                placeholder="E.g., Cozy Spaces"
                                className="flex-grow p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476] bg-[#F3EDE0] text-[#3D4331]"
                            />
                            <button type="button" onClick={addIcon} className="px-4 py-2 bg-[#3D4331] text-[#F3EDE0] rounded-lg hover:bg-[#525942] transition duration-150">
                                <Plus size={20} />
                            </button>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mt-4">
                            {stay?.amenityIcons?.map((iconObj, i) => (
                                <div key={i} className="flex items-center gap-2 bg-[#F3EDE0] border border-[#96A476]/30 px-3 py-1.5 rounded-lg">
                                    <span className="text-xs font-black text-[#3D4331] uppercase tracking-widest">{iconObj.icon}: {iconObj.text}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeIcon(i)}
                                        className="text-red-500 hover:text-red-700 p-0.5 rounded-full hover:bg-red-50 transition"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                            {(!stay?.amenityIcons || stay.amenityIcons.length === 0) && (
                                <div className="text-sm text-[#3D4331]/50 italic">No icons added yet. Card will use default static icons.</div>
                            )}
                        </div>
                    </div>
                )}`);

// 8. Global Theme Replacements
content = content.replace(/bg-gray-50/g, 'bg-[#F3EDE0]');
content = content.replace(/bg-white/g, 'bg-[#EBE1D0]');
content = content.replace(/text-gray-800/g, 'text-[#3D4331]');
content = content.replace(/text-gray-900/g, 'text-[#3D4331]');
content = content.replace(/text-gray-700/g, 'text-[#3D4331]/80');
content = content.replace(/text-gray-600/g, 'text-[#3D4331]/70');
content = content.replace(/text-gray-500/g, 'text-[#3D4331]/60');
content = content.replace(/border-gray-200/g, 'border-[#96A476]/20');
content = content.replace(/border-gray-300/g, 'border-[#96A476]/40');
content = content.replace(/bg-blue-600/g, 'bg-[#3D4331]');
content = content.replace(/hover:bg-blue-700/g, 'hover:bg-[#525942]');
content = content.replace(/text-blue-600/g, 'text-[#96A476]');
content = content.replace(/ring-blue-500/g, 'ring-[#96A476]');
content = content.replace(/border-blue-500/g, 'border-[#96A476]');
content = content.replace(/bg-blue-50/g, 'bg-[#96A476]/10');
content = content.replace(/bg-green-100/g, 'bg-[#96A476]/20');
content = content.replace(/text-green-800/g, 'text-[#3D4331]');
content = content.replace(/text-blue-700/g, 'text-[#96A476]');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated page.tsx UI and added amenityIcons tab.');
