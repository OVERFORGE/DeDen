// File: app/admin/stays/[id]/page.tsx
// ✅ UPDATED: Now shows nights/duration prominently and prices are labeled "per night"

"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Plus, X, Trash2, Edit, Check, DollarSign, Users, Calendar } from 'lucide-react';

// Room type with PER NIGHT pricing
type Room = {
    id?: string;
    name: string;
    description: string;
    capacity: number;
    priceUSDC: number; // PER NIGHT
    priceUSDT: number; // PER NIGHT
    images: string[];
    amenities: string[];
};

type Stay = {
    id: string;
    stayId: string;
    title: string;
    slug: string;
    location: string;
    description: string;
    startDate: string;
    endDate: string;
    duration: number; // Number of nights
    priceUSDC: number; // PER NIGHT
    priceUSDT: number; // PER NIGHT
    slotsTotal: number;
    slotsAvailable: number;
    isPublished: boolean;
    isFeatured: boolean;
    allowWaitlist: boolean;
    images: string[];
    amenities: string[];
    highlights: string[];
    rooms: Room[];
};

export default function EditStayPage() {
    const params = useParams();
    const stayId = params.id as string | undefined; 
    const router = useRouter();
    
    const [stay, setStay] = useState<Stay | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'basic' | 'images' | 'rooms' | 'amenities'>('basic');
    
    const [newImage, setNewImage] = useState('');
    const [newAmenity, setNewAmenity] = useState('');
    const [newHighlight, setNewHighlight] = useState('');
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);

    const { register, handleSubmit, reset } = useForm();

    useEffect(() => {
        if (stayId && typeof stayId === 'string' && stayId.length > 0) {
            fetchStay();
        } else {
            setLoading(false);
        }
    }, [stayId]);

    const fetchStay = async () => {
        try {
            const res = await fetch(`/api/admin/stays/${stayId}`);
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `Failed to fetch stay (Status: ${res.status})`);
            }
            const data = await res.json();
            
            data.images = data.images || [];
            data.amenities = data.amenities || [];
            data.rooms = data.rooms || [];
            data.highlights = data.highlights || [];
            
            setStay(data);
            reset(data);
        } catch (err) {
            alert('Error loading stay: ' + (err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: any) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/stays/${stayId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...data,
                    images: stay?.images || [],
                    amenities: stay?.amenities || [],
                    rooms: stay?.rooms || [],
                    highlights: stay?.highlights || [],
                }),
            });

            if (!res.ok) throw new Error('Failed to update stay');
            
            alert('Stay updated successfully!');
            router.push('/admin/stays');
        } catch (err) {
            alert('Error updating stay: ' + (err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const addImage = () => {
        if (!newImage.trim() || !stay) return;
        setStay({ ...stay, images: [...stay.images, newImage.trim()] });
        setNewImage('');
    };
    const removeImage = (index: number) => {
        if (!stay) return;
        const updated = stay.images.filter((_, i) => i !== index);
        setStay({ ...stay, images: updated });
    };
    const addAmenity = () => {
        if (!newAmenity.trim() || !stay) return;
        setStay({ ...stay, amenities: [...stay.amenities, newAmenity.trim()] });
        setNewAmenity('');
    };
    const removeAmenity = (index: number) => {
        if (!stay) return;
        const updated = stay.amenities.filter((_, i) => i !== index);
        setStay({ ...stay, amenities: updated });
    };
    const addHighlight = () => {
        if (!newHighlight.trim() || !stay) return;
        const highlights = stay.highlights || [];
        setStay({ ...stay, highlights: [...highlights, newHighlight.trim()] });
        setNewHighlight('');
    };
    const removeHighlight = (index: number) => {
        if (!stay) return;
        const highlights = stay.highlights || [];
        const updated = highlights.filter((_, i) => i !== index);
        setStay({ ...stay, highlights: updated });
    };

    const addRoom = () => {
        setEditingRoom({
            name: '',
            description: '',
            capacity: 2,
            priceUSDC: stay?.priceUSDC || 100, // Default per-night price
            priceUSDT: stay?.priceUSDT || 100, 
            images: [],
            amenities: [],
        });
    };

    const saveRoom = (room: Room) => {
        if (!stay) return;
        
        if (room.id) {
            const updated = stay.rooms.map(r => r.id === room.id ? room : r);
            setStay({ ...stay, rooms: updated });
        } else {
            const newRoom = { ...room, id: Date.now().toString() };
            setStay({ ...stay, rooms: [...stay.rooms, newRoom] });
        }
        
        setEditingRoom(null);
    };

    const deleteRoom = (roomId: string) => {
        if (!stay || !confirm('Are you sure you want to delete this room type?')) return;
        const updated = stay.rooms.filter(r => r.id !== roomId);
        setStay({ ...stay, rooms: updated });
    };

    if (!stayId || loading) return <div className="max-w-7xl mx-auto p-6 text-xl">Loading...</div>;
    if (!stay) return <div className="max-w-7xl mx-auto p-6 text-xl text-red-600">Stay not found</div>;

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Edit Stay: {stay.title}</h1>
                <button 
                    onClick={() => router.push('/admin/stays')} 
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition duration-150"
                >
                    ← Back to Stays
                </button>
            </div>

            {/* ✅ NEW: Nights Info Banner */}
            {stay.duration && (
                <div className="bg-blue-100 border-2 border-blue-300 rounded-xl p-4 mb-8 flex items-center gap-4">
                    <Calendar className="text-blue-700" size={32} />
                    <div>
                        <h3 className="text-xl font-bold text-blue-900">
                            {stay.duration} Night{stay.duration !== 1 ? 's' : ''}
                        </h3>
                        <p className="text-sm text-blue-700">
                            All prices below are <strong>per night</strong>. Total booking cost = price × {stay.duration} nights.
                        </p>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-8 border-b-2 border-gray-200">
                {(['basic', 'images', 'rooms', 'amenities'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 text-lg font-medium border-b-4 transition duration-150 
                            ${activeTab === tab 
                                ? 'border-blue-600 text-blue-700 font-semibold' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
                {/* Basic Info Tab */}
                {activeTab === 'basic' && (
                    <div className="bg-white p-6 rounded-xl shadow-lg mb-6 space-y-5">
                        <h3 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-4">Basic Information</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                <input {...register('title')} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                                <input {...register('slug')} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                <input {...register('location')} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Total Slots</label>
                                <input type="number" {...register('slotsTotal')} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea {...register('description')} rows={5} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 font-sans" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                <input type="date" {...register('startDate')} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                                <input type="date" {...register('endDate')} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                        </div>

                        {/* ✅ UPDATED: Clearly labeled PER NIGHT */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Default Price USDC <span className="text-blue-600 font-semibold">(per night)</span>
                                </label>
                                <input type="number" step="0.01" {...register('priceUSDC')} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Default Price USDT <span className="text-blue-600 font-semibold">(per night)</span>
                                </label>
                                <input type="number" step="0.01" {...register('priceUSDT')} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-6 pt-4 border-t border-gray-200">
                            <label className="flex items-center gap-2 text-gray-700 text-sm font-medium">
                                <input type="checkbox" {...register('isPublished')} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                                Published
                            </label>
                            <label className="flex items-center gap-2 text-gray-700 text-sm font-medium">
                                <input type="checkbox" {...register('isFeatured')} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                                Featured
                            </label>
                            <label className="flex items-center gap-2 text-gray-700 text-sm font-medium">
                                <input type="checkbox" {...register('allowWaitlist')} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                                Allow Applications
                            </label>
                        </div>
                    </div>
                )}

                {/* Images Tab */}
                {activeTab === 'images' && (
                    <div className="bg-white p-6 rounded-xl shadow-lg mb-6 space-y-5">
                        <h3 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-4">Stay Images</h3>
                        
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={newImage}
                                onChange={(e) => setNewImage(e.target.value)}
                                placeholder="Enter image URL"
                                className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            />
                            <button type="button" onClick={addImage} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150">
                                <Plus size={20} />
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                            {stay.images.map((img, i) => (
                                <div key={i} className="relative group">
                                    <img src={img} alt="" className="w-full h-32 object-cover rounded-lg" />
                                    <button
                                        type="button"
                                        onClick={() => removeImage(i)}
                                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Rooms Tab */}
                {activeTab === 'rooms' && (
                    <div className="bg-white p-6 rounded-xl shadow-lg mb-6 space-y-5">
                        <div className="flex justify-between items-center border-b pb-3 mb-4">
                            <h3 className="text-2xl font-bold text-gray-800">
                                Room Types <span className="text-sm text-blue-600 font-normal">(Prices are per night)</span>
                            </h3>
                            <button type="button" onClick={addRoom} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150 flex items-center gap-2">
                                <Plus size={20} />
                                Add Room Type
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            {stay.rooms.map((room) => (
                                <div key={room.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-grow">
                                            <h4 className="text-lg font-semibold text-gray-900">{room.name}</h4>
                                            <p className="text-sm text-gray-600 mt-1">{room.description}</p>
                                            <div className="flex gap-4 mt-3 text-sm">
                                                <span className="flex items-center gap-1 text-gray-700">
                                                    <Users size={16} />
                                                    Capacity: {room.capacity}
                                                </span>
                                                <span className="flex items-center gap-1 text-green-700 font-semibold">
                                                    <DollarSign size={16} />
                                                    ${room.priceUSDC}/night USDC
                                                </span>
                                                <span className="flex items-center gap-1 text-purple-700 font-semibold">
                                                    <DollarSign size={16} />
                                                    ${room.priceUSDT}/night USDT
                                                </span>
                                            </div>
                                            {stay.duration && (
                                                <p className="text-xs text-gray-500 mt-2">
                                                    Total for {stay.duration} nights: <strong>${(room.priceUSDC * stay.duration).toFixed(2)} USDC</strong> / <strong>${(room.priceUSDT * stay.duration).toFixed(2)} USDT</strong>
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setEditingRoom(room)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => room.id && deleteRoom(room.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Amenities Tab */}
                {activeTab === 'amenities' && (
                    <div className="bg-white p-6 rounded-xl shadow-lg mb-6 space-y-5">
                        <h3 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-4">Amenities & Highlights</h3>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Stay Amenities</label>
                            <div className="flex gap-3 mb-4">
                                <input
                                    type="text"
                                    value={newAmenity}
                                    onChange={(e) => setNewAmenity(e.target.value)}
                                    placeholder="e.g., WiFi, Pool, Gym"
                                    className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                />
                                <button type="button" onClick={addAmenity} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150">
                                    <Plus size={20} />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {stay.amenities.map((amenity, i) => (
                                    <div key={i} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                                        {amenity}
                                        <button type="button" onClick={() => removeAmenity(i)} className="text-blue-800 hover:text-blue-900">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Highlights</label>
                            <div className="flex gap-3 mb-4">
                                <input
                                    type="text"
                                    value={newHighlight}
                                    onChange={(e) => setNewHighlight(e.target.value)}
                                    placeholder="e.g., Beach Access, Mountain View"
                                    className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                />
                                <button type="button" onClick={addHighlight} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150">
                                    <Plus size={20} />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(stay.highlights || []).map((highlight, i) => (
                                    <div key={i} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center gap-2">
                                        {highlight}
                                        <button type="button" onClick={() => removeHighlight(i)} className="text-green-800 hover:text-green-900">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-8 flex justify-end">
                    <button type="submit" disabled={saving} className={`px-8 py-3 text-xl font-semibold rounded-lg transition duration-200 shadow-xl 
                        ${saving 
                            ? 'bg-gray-400 text-gray-700 cursor-not-allowed' 
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>

            {editingRoom && (
                <RoomEditorModal
                    room={editingRoom}
                    onSave={saveRoom}
                    onCancel={() => setEditingRoom(null)}
                    stayDuration={stay.duration}
                />
            )}
        </div>
    );
}

// Room Editor Modal with nights calculation
function RoomEditorModal({
    room,
    onSave,
    onCancel,
    stayDuration,
}: {
    room: Room;
    onSave: (room: Room) => void;
    onCancel: () => void;
    stayDuration?: number;
}) {
    const [editedRoom, setEditedRoom] = useState<Room>({
        ...room,
        priceUSDC: room.priceUSDC || (room as any).price || 0,
        priceUSDT: room.priceUSDT || (room as any).price || 0,
    });
    const [newRoomImage, setNewRoomImage] = useState('');
    const [newRoomAmenity, setNewRoomAmenity] = useState('');

    const addRoomImage = () => {
        if (!newRoomImage.trim()) return;
        setEditedRoom({
            ...editedRoom,
            images: [...(editedRoom.images || []), newRoomImage.trim()]
        });
        setNewRoomImage('');
    };

    const removeRoomImage = (index: number) => {
        setEditedRoom({
            ...editedRoom,
            images: (editedRoom.images || []).filter((_, i) => i !== index)
        });
    };

    const addRoomAmenity = () => {
        if (!newRoomAmenity.trim()) return;
        setEditedRoom({
            ...editedRoom,
            amenities: [...(editedRoom.amenities || []), newRoomAmenity.trim()]
        });
        setNewRoomAmenity('');
    };

    const removeRoomAmenity = (index: number) => {
        setEditedRoom({
            ...editedRoom,
            amenities: (editedRoom.amenities || []).filter((_, i) => i !== index)
        });
    };

    const handleSave = () => {
        const finalRoom: Room = {
            ...editedRoom,
            priceUSDC: parseFloat(parseFloat(editedRoom.priceUSDC.toString()).toFixed(2)) || 0.01,
            priceUSDT: parseFloat(parseFloat(editedRoom.priceUSDT.toString()).toFixed(2)) || 0.01,
            capacity: parseInt(editedRoom.capacity.toString()) || 1,
        };
        
        if (!finalRoom.name || finalRoom.name.length < 3) {
            alert("Room Name is required.");
            return;
        }

        onSave(finalRoom);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white p-6 rounded-xl shadow-2xl max-w-2xl w-full my-8 space-y-6">
                <h3 className="text-2xl font-bold border-b pb-3">Edit Room: {editedRoom.name || 'New Room'}</h3>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Room Name</label>
                    <input
                        value={editedRoom.name}
                        onChange={(e) => setEditedRoom({ ...editedRoom, name: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Shared Bedroom"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                        value={editedRoom.description}
                        onChange={(e) => setEditedRoom({ ...editedRoom, description: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 font-sans"
                        rows={3}
                        placeholder="Describe the room..."
                    />
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                        <input
                            type="number"
                            value={editedRoom.capacity}
                            onChange={(e) => setEditedRoom({ ...editedRoom, capacity: parseInt(e.target.value) })}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            min={1}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Price USDC <span className="text-blue-600 font-semibold">/night</span>
                        </label>
                        <input
                            type="number"
                            value={editedRoom.priceUSDC}
                            onChange={(e) => setEditedRoom({ ...editedRoom, priceUSDC: parseFloat(e.target.value) })}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            step="0.01"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Price USDT <span className="text-blue-600 font-semibold">/night</span>
                        </label>
                        <input
                            type="number"
                            value={editedRoom.priceUSDT}
                            onChange={(e) => setEditedRoom({ ...editedRoom, priceUSDT: parseFloat(e.target.value) })}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            step="0.01"
                        />
                    </div>
                </div>

                {/* ✅ NEW: Show total calculation */}
                {stayDuration && (
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-900">
                            <strong>Total for {stayDuration} nights:</strong> ${(editedRoom.priceUSDC * stayDuration).toFixed(2)} USDC / ${(editedRoom.priceUSDT * stayDuration).toFixed(2)} USDT
                        </p>
                    </div>
                )}

                {/* Room Images */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Room Images</label>
                    <div className="flex gap-3 mb-4">
                        <input
                            type="text"
                            value={newRoomImage}
                            onChange={(e) => setNewRoomImage(e.target.value)}
                            placeholder="Enter image URL"
                            className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button type="button" onClick={addRoomImage} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150 flex items-center">
                            Add
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {(editedRoom.images || []).map((img, i) => (
                            <div key={i} className="relative w-20 h-20 group">
                                <img src={img} alt="" className="w-full h-full object-cover rounded-md" />
                                <button
                                    type="button"
                                    onClick={() => removeRoomImage(i)}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Room Amenities */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Room Amenities</label>
                    <div className="flex gap-3 mb-4">
                        <input
                            type="text"
                            value={newRoomAmenity}
                            onChange={(e) => setNewRoomAmenity(e.target.value)}
                            placeholder="e.g., Private bathroom, Work desk"
                            className="flex-grow p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button type="button" onClick={addRoomAmenity} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150 flex items-center">
                            Add
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {(editedRoom.amenities || []).map((amenity, i) => (
                            <div key={i} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center gap-1">
                                {amenity}
                                <button
                                    type="button"
                                    onClick={() => removeRoomAmenity(i)}
                                    className="text-green-800 hover:text-green-900 transition"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button onClick={onCancel} type="button" className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition duration-150">
                        Cancel
                    </button>
                    <button onClick={handleSave} type="button" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150">
                        Save Room
                    </button>
                </div>
            </div>
        </div>
    );
}