const fs = require('fs');

const filePath = 'app/admin/stays/[id]/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update Types
content = content.replace(
    /type Room = \{[\s\S]*?amenities: string\[\];\n\};/,
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

content = content.replace(
    /type Stay = \{[\s\S]*?enabledChains: number\[\];\s*\/\/ ✅ ADD THIS LINE\n\};/,
    `type Stay = {
    id: string;
    stayId: string;
    title: string;
    slug: string;
    location: string;
    description: string;
    startDate: string;
    endDate: string;
    duration: number;
    priceUSDC: number;
    priceUSDT: number;
    slotsTotal: number;
    slotsAvailable: number;
    isPublished: boolean;
    isFeatured: boolean;
    allowWaitlist: boolean;
    images: string[];
    amenities: string[];
    highlights: string[];
    rules: string[];
    address: {
        mapUrl?: string;
        fullAddress?: string;
        landmarks?: { name: string; distance: string; type: string }[];
    } | null;
    rooms: Room[];
    requiresReservation: boolean;
    reservationAmount: number;
    minNightsForReservation: number;
    enabledChains: number[];
};`
);

// 2. Update State
content = content.replace(
    /const \[activeTab, setActiveTab\] = useState<'basic' \| 'images' \| 'rooms' \| 'amenities' \| 'reservation'>\('basic'\);[\s\S]*?const \[editingRoom, setEditingRoom\] = useState<Room \| null>\(null\);/,
    `const [activeTab, setActiveTab] = useState<'basic' | 'images' | 'rooms' | 'amenities' | 'location' | 'rules' | 'reservation'>('basic');
    
    const [newImage, setNewImage] = useState('');
    const [newAmenity, setNewAmenity] = useState('');
    const [newHighlight, setNewHighlight] = useState('');
    const [newRule, setNewRule] = useState('');
    const [newLandmarkName, setNewLandmarkName] = useState('');
    const [newLandmarkDistance, setNewLandmarkDistance] = useState('');
    const [newLandmarkType, setNewLandmarkType] = useState('Airport');
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);`
);

// 3. Update fetchStay and onSubmit
content = content.replace(
    /data\.images = data\.images \|\| \[\];\s*data\.amenities = data\.amenities \|\| \[\];\s*data\.rooms = data\.rooms \|\| \[\];\s*data\.highlights = data\.highlights \|\| \[\];/,
    `data.images = data.images || [];
            data.amenities = data.amenities || [];
            data.rooms = data.rooms || [];
            data.highlights = data.highlights || [];
            data.rules = data.rules || [];
            data.address = data.address || { mapUrl: '', fullAddress: '', landmarks: [] };`
);

content = content.replace(
    /images: stay\?\.images \|\| \[\],\s*amenities: stay\?\.amenities \|\| \[\],\s*rooms: stay\?\.rooms \|\| \[\],\s*highlights: stay\?\.highlights \|\| \[\]/,
    `images: stay?.images || [],
                    amenities: stay?.amenities || [],
                    rooms: stay?.rooms || [],
                    highlights: stay?.highlights || [],
                    rules: stay?.rules || [],
                    address: stay?.address || null`
);

// 4. Update tab methods (Using precise Regex insertion point)
const newMethodsStr = `
    const addRule = () => {
        if (!newRule.trim() || !stay) return;
        const rules = stay.rules || [];
        setStay({ ...stay, rules: [...rules, newRule.trim()] });
        setNewRule('');
    };
    const removeRule = (index: number) => {
        if (!stay) return;
        const rules = stay.rules || [];
        const updated = rules.filter((_, i) => i !== index);
        setStay({ ...stay, rules: updated });
    };

    const updateAddressField = (field: string, value: string) => {
        if (!stay) return;
        const address = stay.address || {};
        setStay({ ...stay, address: { ...address, [field]: value } });
    };

    const addLandmark = () => {
        if (!newLandmarkName.trim() || !stay) return;
        const address = stay.address || {};
        const landmarks = address.landmarks || [];
        setStay({ 
            ...stay, 
            address: { 
                ...address, 
                landmarks: [...landmarks, { name: newLandmarkName.trim(), distance: newLandmarkDistance.trim(), type: newLandmarkType }] 
            } 
        });
        setNewLandmarkName('');
        setNewLandmarkDistance('');
    };
    const removeLandmark = (index: number) => {
        if (!stay) return;
        const address = stay.address || {};
        const landmarks = address.landmarks || [];
        const updated = landmarks.filter((_, i) => i !== index);
        setStay({ ...stay, address: { ...address, landmarks: updated } });
    };

    const addRoom = () => {`;

content = content.replace(/const addRoom = \(\) => \{/, newMethodsStr);


// 5. Update addRoom internals
content = content.replace(
    /const addRoom = \(\) => \{\n\s*setEditingRoom\(\{\n\s*name: '',\n\s*description: '',\n\s*capacity: 2,\n\s*priceUSDC: stay\?\.priceUSDC \|\| 100,\n\s*priceUSDT: stay\?\.priceUSDT \|\| 100,\s*\n\s*images: \[\],\n\s*amenities: \[\],\n\s*\}\);\n\s*\};/,
    `const addRoom = () => {
        setEditingRoom({
            name: '',
            description: '',
            capacity: 2,
            priceUSDC: stay?.priceUSDC || 100,
            priceUSDT: stay?.priceUSDT || 100, 
            images: [],
            amenities: [],
            beds: '1 King Bed',
            area: '200 sq ft',
            roomsLeft: 5,
        });
    };`
);

// 6. Update Tabs render
content = content.replace(
    /\(\['basic', 'images', 'rooms', 'amenities', 'reservation'\] as const\)\.map\(tab => \(/,
    `(['basic', 'images', 'rooms', 'amenities', 'location', 'rules', 'reservation'] as const).map(tab => (`
);

// 7. Add Location and Rules tab content
const newTabsContentStr = `
                {/* Location & Landmarks Tab */}
                {activeTab === 'location' && (
                    <div className="bg-white p-6 rounded-xl shadow-lg mb-6 space-y-5">
                        <h3 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-4">Location & Landmarks</h3>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Address</label>
                            <textarea 
                                value={stay.address?.fullAddress || ''} 
                                onChange={(e) => updateAddressField('fullAddress', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 font-sans" 
                                rows={3} 
                                placeholder="e.g., Plot 14, Chakala Road, Andheri East, Mumbai 400099" 
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Map Embed URL / Directions Link</label>
                            <input 
                                type="text"
                                value={stay.address?.mapUrl || ''} 
                                onChange={(e) => updateAddressField('mapUrl', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" 
                                placeholder="https://maps.google.com/..." 
                            />
                        </div>

                        <div className="mt-6 border-t pt-6">
                            <h4 className="text-lg font-bold text-gray-800 mb-4">Nearby Landmarks</h4>
                            <div className="flex gap-3 mb-4">
                                <input
                                    type="text"
                                    value={newLandmarkName}
                                    onChange={(e) => setNewLandmarkName(e.target.value)}
                                    placeholder="e.g., Mumbai Airport T2"
                                    className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                />
                                <input
                                    type="text"
                                    value={newLandmarkDistance}
                                    onChange={(e) => setNewLandmarkDistance(e.target.value)}
                                    placeholder="e.g., 3.2 km"
                                    className="w-32 p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                />
                                <select 
                                    value={newLandmarkType}
                                    onChange={(e) => setNewLandmarkType(e.target.value)}
                                    className="w-32 p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="Airport">Airport</option>
                                    <option value="Train">Train/Metro</option>
                                    <option value="Shopping">Shopping</option>
                                    <option value="Hospital">Hospital</option>
                                    <option value="Attraction">Attraction</option>
                                </select>
                                <button type="button" onClick={addLandmark} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150">
                                    <Plus size={20} />
                                </button>
                            </div>
                            
                            <div className="space-y-2">
                                {(stay.address?.landmarks || []).map((landmark, i) => (
                                    <div key={i} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg bg-gray-50">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold uppercase text-gray-500 bg-white px-2 py-1 rounded border">{landmark.type}</span>
                                            <span className="font-semibold text-gray-800">{landmark.name}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm text-gray-600">{landmark.distance}</span>
                                            <button type="button" onClick={() => removeLandmark(i)} className="text-red-500 hover:text-red-700">
                                                <X size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Rules & Extra Notes Tab */}
                {activeTab === 'rules' && (
                    <div className="bg-white p-6 rounded-xl shadow-lg mb-6 space-y-5">
                        <h3 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-4">Extra Notes & Rules</h3>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Stay Rules</label>
                            <div className="flex gap-3 mb-4">
                                <input
                                    type="text"
                                    value={newRule}
                                    onChange={(e) => setNewRule(e.target.value)}
                                    placeholder="e.g., Check-in 2:00 PM • Check-out 11:00 AM"
                                    className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRule())}
                                />
                                <button type="button" onClick={addRule} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150">
                                    <Plus size={20} />
                                </button>
                            </div>
                            <ul className="space-y-2">
                                {(stay.rules || []).map((rule, i) => (
                                    <li key={i} className="flex justify-between items-center p-2 border border-gray-200 rounded-lg bg-gray-50">
                                        <span className="text-sm text-gray-800">{rule}</span>
                                        <button type="button" onClick={() => removeRule(i)} className="text-red-500 hover:text-red-700 p-1">
                                            <X size={16} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
`;

content = content.replace(
    /\{\/\* ✅ NEW: Reservation Tab \*\/\}/,
    newTabsContentStr + '\n                {/* ✅ NEW: Reservation Tab */}'
);

// 8. Update RoomEditorModal state
content = content.replace(
    /const handleSave = \(\) => \{\n\s*const finalRoom: Room = \{\n\s*\.\.\.editedRoom,\n\s*priceUSDC: parseFloat\(parseFloat\(editedRoom\.priceUSDC\.toString\(\)\)\.toFixed\(2\)\) \|\| 0\.01,\n\s*priceUSDT: parseFloat\(parseFloat\(editedRoom\.priceUSDT\.toString\(\)\)\.toFixed\(2\)\) \|\| 0\.01,\n\s*capacity: parseInt\(editedRoom\.capacity\.toString\(\)\) \|\| 1,\n\s*\};/,
    `const handleSave = () => {
        const finalRoom: Room = {
            ...editedRoom,
            priceUSDC: parseFloat(parseFloat(editedRoom.priceUSDC.toString()).toFixed(2)) || 0.01,
            priceUSDT: parseFloat(parseFloat(editedRoom.priceUSDT.toString()).toFixed(2)) || 0.01,
            capacity: parseInt(editedRoom.capacity.toString()) || 1,
            roomsLeft: parseInt((editedRoom.roomsLeft || 0).toString()) || 0,
        };`
);

// 9. Add Beds, Area, RoomsLeft fields to RoomEditorModal UI
const extraFieldsStr = `
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Beds</label>
                        <input
                            type="text"
                            value={editedRoom.beds || ''}
                            onChange={(e) => setEditedRoom({ ...editedRoom, beds: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g. 1 King Bed"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                        <input
                            type="text"
                            value={editedRoom.area || ''}
                            onChange={(e) => setEditedRoom({ ...editedRoom, area: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g. 220 sq ft"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rooms Left</label>
                        <input
                            type="number"
                            value={editedRoom.roomsLeft || 0}
                            onChange={(e) => setEditedRoom({ ...editedRoom, roomsLeft: parseInt(e.target.value) || 0 })}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            min={0}
                        />
                    </div>
                </div>
`;

content = content.replace(
    /<div className="grid grid-cols-3 gap-4">/,
    extraFieldsStr + '\n                <div className="grid grid-cols-3 gap-4">'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated app/admin/stays/[id]/page.tsx');
