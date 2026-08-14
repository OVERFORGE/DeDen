// File: app/admin/stays/[id]/page.tsx
// ✅ FIXED: Added reservation system controls for admin

"use client";
import { StayChainConfig } from '@/components/admin/StayChainConfig';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Plus, X, Trash2, Edit, Check, DollarSign, Users, Calendar } from 'lucide-react';

/** Full ISO timestamp -> the yyyy-MM-dd that <input type="date"> requires. */
function toDateInput(value?: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

type Room = {
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
    address: any;
    rooms: Room[];
    requiresReservation: boolean;
    reservationAmount: number;
    minNightsForReservation: number;
    enabledChains: number[];  // ✅ ADD THIS LINE
    guestListEnabled: boolean;
    loyaltyDiscountEnabled: boolean;
    requiresApproval: boolean;
};

export default function EditStayPage() {
    const params = useParams();
    const stayId = params.id as string | undefined; 
    const router = useRouter();
    
    const [stay, setStay] = useState<Stay | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'basic' | 'images' | 'rooms' | 'amenities' | 'icons' | 'location' | 'rules' | 'reservation'>('basic');
    
    const [newImage, setNewImage] = useState('');
    const [newAmenity, setNewAmenity] = useState('');
    const [newHighlight, setNewHighlight] = useState('');
    const [newRule, setNewRule] = useState('');
    const [newIconName, setNewIconName] = useState('Home');
    const [newIconText, setNewIconText] = useState('');
    const [newLandmarkName, setNewLandmarkName] = useState('');
    const [newLandmarkDistance, setNewLandmarkDistance] = useState('');
    const [newLandmarkType, setNewLandmarkType] = useState('Airport');
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);

    const { register, handleSubmit, reset, watch, setValue, formState } = useForm();

    // Snapshot of the stay as loaded, so we can tell which of the
    // state-managed array/JSON editors were actually touched.
    const originalStayRef = useRef<any>(null);

    // ✅ NEW: Watch reservation fields
    const requiresReservation = watch('requiresReservation');
    const allowFlexibleDates = watch('allowFlexibleDates');

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
            data.rules = data.rules || [];
            data.amenityIcons = data.amenityIcons || [];
            data.address = data.address || { mapUrl: '', fullAddress: '', landmarks: [] };
            data.rules = data.rules || [];
            data.address = data.address || { mapUrl: '', fullAddress: '', landmarks: [] };
            
            setStay(data);
            originalStayRef.current = JSON.parse(JSON.stringify(data));

            // <input type="date"> only accepts yyyy-MM-dd; the API returns full
            // ISO timestamps, which React rejects with a format warning and
            // leaves the field blank.
            reset({
                ...data,
                startDate: toDateInput(data.startDate),
                endDate: toDateInput(data.endDate),
                coreStartDate: toDateInput(data.coreStartDate),
                coreEndDate: toDateInput(data.coreEndDate),
            });
        } catch (err) {
            alert('Error loading stay: ' + (err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: any) => {
        setSaving(true);
        try {
            // Only send what actually changed.
            //
            // Sending the whole stay back made Prisma build one update stage
            // per field, and Stay has 58 — over MongoDB Atlas's hard 50-stage
            // aggregation-pipeline limit, so every save failed with a 500
            // ("Pipeline length greater than 50 not supported"). A normal edit
            // touches a handful of fields, which stays far under the cap.
            const dirty = formState.dirtyFields as Record<string, unknown>;
            const changed: Record<string, any> = {};
            for (const key of Object.keys(dirty)) {
                if (data[key] !== undefined) changed[key] = data[key];
            }

            // The array/JSON editors below are managed in `stay` state rather
            // than by react-hook-form, so they never show up as dirty. Include
            // them only when they actually differ from what we loaded.
            const current = stay as any;
            for (const key of ['images', 'amenities', 'rooms', 'highlights', 'rules', 'amenityIcons']) {
                if (JSON.stringify(current?.[key] ?? []) !== JSON.stringify(originalStayRef.current?.[key] ?? [])) {
                    changed[key] = current?.[key] ?? [];
                }
            }
            if (JSON.stringify(stay?.address ?? null) !== JSON.stringify(originalStayRef.current?.address ?? null)) {
                changed.address = stay?.address ?? null;
            }

            if (Object.keys(changed).length === 0) {
                alert('No changes to save.');
                setSaving(false);
                return;
            }

            const res = await fetch(`/api/admin/stays/${stayId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(changed),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || body.details || `Failed to update stay (${res.status})`);
            }

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
        const updated = landmarks.filter((_: any, i: number) => i !== index);
        setStay({ ...stay, address: { ...address, landmarks: updated } });
    };



    const addRoom = () => {
        setEditingRoom({
            name: '',
            description: '',
            capacity: 2,
            priceUSDC: stay?.priceUSDC || 100,
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
                <h1 className="text-3xl font-bold text-[#3D4331]">Edit Stay: {stay.title}</h1>
                <button 
                    onClick={() => router.push('/admin/stays')} 
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition duration-150"
                >
                    ← Back to Stays
                </button>
            </div>

            {stay.duration && (
                <div className="bg-blue-100 border-2 border-blue-300 rounded-xl p-4 mb-8 flex items-center gap-4">
                    <Calendar className="text-[#96A476]" size={32} />
                    <div>
                        <h3 className="text-xl font-bold text-blue-900">
                            {stay.duration} Night{stay.duration !== 1 ? 's' : ''}
                        </h3>
                        <p className="text-sm text-[#96A476]">
                            All prices below are <strong>per night</strong>. Total booking cost = price × {stay.duration} nights.
                        </p>
                    </div>
                </div>
            )}

            {/* ✅ UPDATED: Added 'reservation' tab */}
            <div className="flex gap-2 mb-8 border-b-2 border-[#96A476]/20">
                {(['basic', 'images', 'rooms', 'amenities', 'location', 'rules', 'reservation'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 text-lg font-medium border-b-4 transition duration-150 
                            ${activeTab === tab 
                                ? 'border-blue-600 text-[#96A476] font-semibold' 
                                : 'border-transparent text-[#3D4331]/60 hover:text-[#3D4331]/80 hover:border-[#96A476]/40'
                            }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
                {/* Basic Info Tab */}
                {activeTab === 'basic' && (
                    <div className="bg-[#EBE1D0] p-6 rounded-xl shadow-lg mb-6 space-y-5">
                        <h3 className="text-2xl font-bold text-[#3D4331] border-b pb-3 mb-4">Basic Information</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-3">
                                <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">Title</label>
                                <input {...register('title')} className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">Slug</label>
                                <input {...register('slug')} className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">Location</label>
                                <input {...register('location')} className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">Total Slots</label>
                                <input type="number" {...register('slotsTotal')} className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]" />
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">Description</label>
                            <textarea {...register('description')} rows={5} className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476] font-sans" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">Start Date</label>
                                <input type="date" {...register('startDate')} className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">End Date</label>
                                <input type="date" {...register('endDate')} className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">
                                    Default Price USDC <span className="text-[#96A476] font-semibold">(per night)</span>
                                </label>
                                <input type="number" step="0.01" {...register('priceUSDC')} className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">
                                    Default Price USDT <span className="text-[#96A476] font-semibold">(per night)</span>
                                </label>
                                <input type="number" step="0.01" {...register('priceUSDT')} className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]" />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-6 pt-4 border-t border-[#96A476]/20">
                            <label className="flex items-center gap-2 text-[#3D4331]/80 text-sm font-medium">
                                <input type="checkbox" {...register('isPublished')} className="h-4 w-4 text-[#96A476] border-[#96A476]/40 rounded" />
                                Published
                            </label>
                            <label className="flex items-center gap-2 text-[#3D4331]/80 text-sm font-medium">
                                <input type="checkbox" {...register('isFeatured')} className="h-4 w-4 text-[#96A476] border-[#96A476]/40 rounded" />
                                Featured
                            </label>
                            <label className="flex items-center gap-2 text-[#3D4331]/80 text-sm font-medium">
                                <input type="checkbox" {...register('allowWaitlist')} className="h-4 w-4 text-[#96A476] border-[#96A476]/40 rounded" />
                                Allow Applications
                            </label>
                            <label className="flex items-center gap-2 text-[#3D4331]/80 text-sm font-medium">
                                <input type="checkbox" {...register('requiresApproval')} className="h-4 w-4 text-[#96A476] border-[#96A476]/40 rounded" />
                                Require approval before payment
                            </label>
                            <label className="flex items-center gap-2 text-[#3D4331]/80 text-sm font-medium">
                                <input type="checkbox" {...register('guestListEnabled')} className="h-4 w-4 text-[#96A476] border-[#96A476]/40 rounded" />
                                Show "Who's Coming" to guests
                            </label>
                            <label className="flex items-center gap-2 text-[#3D4331]/80 text-sm font-medium">
                                <input type="checkbox" {...register('loyaltyDiscountEnabled')} className="h-4 w-4 text-[#96A476] border-[#96A476]/40 rounded" />
                                Allow loyalty discount
                            </label>
                            <label className="flex items-center gap-2 text-[#3D4331]/80 text-sm font-medium">
                                <input type="checkbox" {...register('allowFlexibleDates')} className="h-4 w-4 text-[#96A476] border-[#96A476]/40 rounded" />
                                Let guests choose their own dates
                            </label>
                        </div>
                        <p className="text-xs text-[#3D4331]/60 -mt-2">
                            When on, confirmed/reserved guests can see the names and X handles of other
                            guests who've opted in — each guest chooses individually whether to appear.
                        </p>
                        <p className="text-xs text-[#3D4331]/60 -mt-2">
                            Turn off "Allow loyalty discount" to exclude this stay from the flat 20% returning-guest
                            discount — e.g. for a sponsored or already-discounted event.
                        </p>
                        <p className="text-xs text-[#3D4331]/60 -mt-2">
                            "Let guests choose their own dates" turns the apply form's fixed date block into a
                            calendar. Guests pick any check-in/check-out inside the stay window above and are priced
                            per night for the range they choose. Leave it off for conference-style events where
                            everyone books the whole window.
                        </p>
                        <p className="text-xs text-[#3D4331]/60 -mt-2">
                            "Require approval before payment" holds new applications as Waitlisted instead of taking
                            guests straight to the payment page. Review and approve from Admin → Bookings — approving
                            sends the guest an email with their payment link. Leave off for instant, self-serve booking.
                        </p>

                        {allowFlexibleDates && (
                            <div className="mt-2 p-4 rounded-xl bg-[#F3EDE0] border border-[#96A476]/40">
                                <p className="text-sm font-semibold text-[#3D4331] mb-1">
                                    Required nights <span className="font-normal opacity-60">— optional</span>
                                </p>
                                <p className="text-xs text-[#3D4331]/60 mb-3">
                                    Nights every guest must book (e.g. the actual conference days). Guests can still
                                    arrive earlier or leave later, but their dates must cover this range. Leave both
                                    blank to allow any dates inside the stay window.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-[#3D4331]/70 mb-1">
                                            Required from
                                        </label>
                                        <input
                                            type="date"
                                            {...register('coreStartDate')}
                                            className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-[#3D4331]/70 mb-1">
                                            Required until
                                        </label>
                                        <input
                                            type="date"
                                            {...register('coreEndDate')}
                                            className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Images Tab */}
                {activeTab === 'images' && (
                    <div className="bg-[#EBE1D0] p-6 rounded-xl shadow-lg mb-6 space-y-5">
                        <h3 className="text-2xl font-bold text-[#3D4331] border-b pb-3 mb-4">Stay Images</h3>
                        
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={newImage}
                                onChange={(e) => setNewImage(e.target.value)}
                                placeholder="Enter image URL"
                                className="flex-grow p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                            />
                            <button type="button" onClick={addImage} className="px-4 py-2 bg-[#3D4331] text-white rounded-lg hover:bg-[#525942] transition duration-150">
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
                    <div className="bg-[#EBE1D0] p-6 rounded-xl shadow-lg mb-6 space-y-5">
                        <div className="flex justify-between items-center border-b pb-3 mb-4">
                            <h3 className="text-2xl font-bold text-[#3D4331]">
                                Room Types <span className="text-sm text-[#96A476] font-normal">(Prices are per night)</span>
                            </h3>
                            <button type="button" onClick={addRoom} className="px-4 py-2 bg-[#3D4331] text-white rounded-lg hover:bg-[#525942] transition duration-150 flex items-center gap-2">
                                <Plus size={20} />
                                Add Room Type
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            {stay.rooms.map((room) => (
                                <div key={room.id} className="border border-[#96A476]/20 rounded-lg p-4 hover:shadow-md transition">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-grow">
                                            <h4 className="text-lg font-semibold text-[#3D4331]">{room.name}</h4>
                                            <p className="text-sm text-[#3D4331]/70 mt-1">{room.description}</p>
                                            <div className="flex gap-4 mt-3 text-sm">
                                                <span className="flex items-center gap-1 text-[#3D4331]/80">
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
                                                <p className="text-xs text-[#3D4331]/60 mt-2">
                                                    Total for {stay.duration} nights: <strong>${(room.priceUSDC * stay.duration).toFixed(2)} USDC</strong> / <strong>${(room.priceUSDT * stay.duration).toFixed(2)} USDT</strong>
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setEditingRoom(room)}
                                                className="p-2 text-[#96A476] hover:bg-[#96A476]/10 rounded-lg transition"
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
                    <div className="bg-[#EBE1D0] p-6 rounded-xl shadow-lg mb-6 space-y-5">
                        <h3 className="text-2xl font-bold text-[#3D4331] border-b pb-3 mb-4">Amenities & Highlights</h3>
                        
                        <div>
                            <label className="block text-sm font-medium text-[#3D4331]/80 mb-2">Stay Amenities</label>
                            <div className="flex gap-3 mb-4">
                                <input
                                    type="text"
                                    value={newAmenity}
                                    onChange={(e) => setNewAmenity(e.target.value)}
                                    placeholder="e.g., WiFi, Pool, Gym"
                                    className="flex-grow p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                                />
                                <button type="button" onClick={addAmenity} className="px-4 py-2 bg-[#3D4331] text-white rounded-lg hover:bg-[#525942] transition duration-150">
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
                            <label className="block text-sm font-medium text-[#3D4331]/80 mb-2">Highlights</label>
                            <div className="flex gap-3 mb-4">
                                <input
                                    type="text"
                                    value={newHighlight}
                                    onChange={(e) => setNewHighlight(e.target.value)}
                                    placeholder="e.g., Beach Access, Mountain View"
                                    className="flex-grow p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                                />
                                <button type="button" onClick={addHighlight} className="px-4 py-2 bg-[#3D4331] text-white rounded-lg hover:bg-[#525942] transition duration-150">
                                    <Plus size={20} />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(stay.highlights || []).map((highlight, i) => (
                                    <div key={i} className="px-3 py-1 bg-[#96A476]/20 text-[#3D4331] rounded-full text-sm flex items-center gap-2">
                                        {highlight}
                                        <button type="button" onClick={() => removeHighlight(i)} className="text-[#3D4331] hover:text-green-900">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                
                {/* Location & Landmarks Tab */}
                {activeTab === 'location' && (
                    <div className="bg-[#EBE1D0] p-6 rounded-xl shadow-lg mb-6 space-y-5">
                        <h3 className="text-2xl font-bold text-[#3D4331] border-b pb-3 mb-4">Location & Landmarks</h3>
                        
                        <div>
                            <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">Full Address</label>
                            <textarea 
                                value={stay.address?.fullAddress || ''} 
                                onChange={(e) => updateAddressField('fullAddress', e.target.value)}
                                className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476] font-sans" 
                                rows={3} 
                                placeholder="e.g., Plot 14, Chakala Road, Andheri East, Mumbai 400099" 
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">Map Embed URL / Directions Link</label>
                            <input 
                                type="text"
                                value={stay.address?.mapUrl || ''} 
                                onChange={(e) => updateAddressField('mapUrl', e.target.value)}
                                className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]" 
                                placeholder="https://maps.google.com/..." 
                            />
                        </div>

                        <div className="mt-6 border-t pt-6">
                            <h4 className="text-lg font-bold text-[#3D4331] mb-4">Nearby Landmarks</h4>
                            <div className="flex gap-3 mb-4">
                                <input
                                    type="text"
                                    value={newLandmarkName}
                                    onChange={(e) => setNewLandmarkName(e.target.value)}
                                    placeholder="e.g., Mumbai Airport T2"
                                    className="flex-grow p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                                />
                                <input
                                    type="text"
                                    value={newLandmarkDistance}
                                    onChange={(e) => setNewLandmarkDistance(e.target.value)}
                                    placeholder="e.g., 3.2 km"
                                    className="w-32 p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                                />
                                <select 
                                    value={newLandmarkType}
                                    onChange={(e) => setNewLandmarkType(e.target.value)}
                                    className="w-32 p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                                >
                                    <option value="Airport">Airport</option>
                                    <option value="Train">Train/Metro</option>
                                    <option value="Shopping">Shopping</option>
                                    <option value="Hospital">Hospital</option>
                                    <option value="Attraction">Attraction</option>
                                </select>
                                <button type="button" onClick={addLandmark} className="px-4 py-2 bg-[#3D4331] text-white rounded-lg hover:bg-[#525942] transition duration-150">
                                    <Plus size={20} />
                                </button>
                            </div>
                            
                            <div className="space-y-2">
                                {(stay.address?.landmarks || []).map((landmark: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center p-3 border border-[#96A476]/20 rounded-lg bg-[#F3EDE0]">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold uppercase text-[#3D4331]/60 bg-[#EBE1D0] px-2 py-1 rounded border">{landmark.type}</span>
                                            <span className="font-semibold text-[#3D4331]">{landmark.name}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm text-[#3D4331]/70">{landmark.distance}</span>
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
                    <div className="bg-[#EBE1D0] p-6 rounded-xl shadow-lg mb-6 space-y-5">
                        <h3 className="text-2xl font-bold text-[#3D4331] border-b pb-3 mb-4">Extra Notes & Rules</h3>
                        
                        <div>
                            <label className="block text-sm font-medium text-[#3D4331]/80 mb-2">Stay Rules</label>
                            <div className="flex gap-3 mb-4">
                                <input
                                    type="text"
                                    value={newRule}
                                    onChange={(e) => setNewRule(e.target.value)}
                                    placeholder="e.g., Check-in 2:00 PM • Check-out 11:00 AM"
                                    className="flex-grow p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRule())}
                                />
                                <button type="button" onClick={addRule} className="px-4 py-2 bg-[#3D4331] text-white rounded-lg hover:bg-[#525942] transition duration-150">
                                    <Plus size={20} />
                                </button>
                            </div>
                            <ul className="space-y-2">
                                {(stay.rules || []).map((rule, i) => (
                                    <li key={i} className="flex justify-between items-center p-2 border border-[#96A476]/20 rounded-lg bg-[#F3EDE0]">
                                        <span className="text-sm text-[#3D4331]">{rule}</span>
                                        <button type="button" onClick={() => removeRule(i)} className="text-red-500 hover:text-red-700 p-1">
                                            <X size={16} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                
                {/* Location & Landmarks Tab */}
                {activeTab === 'location' && (
                    <div className="bg-[#EBE1D0] p-6 rounded-xl shadow-lg mb-6 space-y-5">
                        <h3 className="text-2xl font-bold text-[#3D4331] border-b pb-3 mb-4">Location & Landmarks</h3>
                        
                        <div>
                            <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">Full Address</label>
                            <textarea 
                                value={stay.address?.fullAddress || ''} 
                                onChange={(e) => updateAddressField('fullAddress', e.target.value)}
                                className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476] font-sans" 
                                rows={3} 
                                placeholder="e.g., Plot 14, Chakala Road, Andheri East, Mumbai 400099" 
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">Map Embed URL / Directions Link</label>
                            <input 
                                type="text"
                                value={stay.address?.mapUrl || ''} 
                                onChange={(e) => updateAddressField('mapUrl', e.target.value)}
                                className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]" 
                                placeholder="https://maps.google.com/..." 
                            />
                        </div>

                        <div className="mt-6 border-t pt-6">
                            <h4 className="text-lg font-bold text-[#3D4331] mb-4">Nearby Landmarks</h4>
                            <div className="flex gap-3 mb-4">
                                <input
                                    type="text"
                                    value={newLandmarkName}
                                    onChange={(e) => setNewLandmarkName(e.target.value)}
                                    placeholder="e.g., Mumbai Airport T2"
                                    className="flex-grow p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                                />
                                <input
                                    type="text"
                                    value={newLandmarkDistance}
                                    onChange={(e) => setNewLandmarkDistance(e.target.value)}
                                    placeholder="e.g., 3.2 km"
                                    className="w-32 p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                                />
                                <select 
                                    value={newLandmarkType}
                                    onChange={(e) => setNewLandmarkType(e.target.value)}
                                    className="w-32 p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                                >
                                    <option value="Airport">Airport</option>
                                    <option value="Train">Train/Metro</option>
                                    <option value="Shopping">Shopping</option>
                                    <option value="Hospital">Hospital</option>
                                    <option value="Attraction">Attraction</option>
                                </select>
                                <button type="button" onClick={addLandmark} className="px-4 py-2 bg-[#3D4331] text-white rounded-lg hover:bg-[#525942] transition duration-150">
                                    <Plus size={20} />
                                </button>
                            </div>
                            
                            <div className="space-y-2">
                                {(stay.address?.landmarks || []).map((landmark: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center p-3 border border-[#96A476]/20 rounded-lg bg-[#F3EDE0]">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-bold uppercase text-[#3D4331]/60 bg-[#EBE1D0] px-2 py-1 rounded border">{landmark.type}</span>
                                            <span className="font-semibold text-[#3D4331]">{landmark.name}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm text-[#3D4331]/70">{landmark.distance}</span>
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
                    <div className="bg-[#EBE1D0] p-6 rounded-xl shadow-lg mb-6 space-y-5">
                        <h3 className="text-2xl font-bold text-[#3D4331] border-b pb-3 mb-4">Extra Notes & Rules</h3>
                        
                        <div>
                            <label className="block text-sm font-medium text-[#3D4331]/80 mb-2">Stay Rules</label>
                            <div className="flex gap-3 mb-4">
                                <input
                                    type="text"
                                    value={newRule}
                                    onChange={(e) => setNewRule(e.target.value)}
                                    placeholder="e.g., Check-in 2:00 PM • Check-out 11:00 AM"
                                    className="flex-grow p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRule())}
                                />
                                <button type="button" onClick={addRule} className="px-4 py-2 bg-[#3D4331] text-white rounded-lg hover:bg-[#525942] transition duration-150">
                                    <Plus size={20} />
                                </button>
                            </div>
                            <ul className="space-y-2">
                                {(stay.rules || []).map((rule, i) => (
                                    <li key={i} className="flex justify-between items-center p-2 border border-[#96A476]/20 rounded-lg bg-[#F3EDE0]">
                                        <span className="text-sm text-[#3D4331]">{rule}</span>
                                        <button type="button" onClick={() => removeRule(i)} className="text-red-500 hover:text-red-700 p-1">
                                            <X size={16} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* ✅ NEW: Reservation Tab */}
                {activeTab === 'reservation' && (
                    <div className="bg-[#EBE1D0] p-6 rounded-xl shadow-lg mb-6 space-y-6">
                        <div className="border-b pb-3 mb-4">
                            <h3 className="text-2xl font-bold text-[#3D4331]">Reservation System Settings</h3>
                            <p className="text-sm text-[#3D4331]/70 mt-2">
                                Control how payment works for multi-night bookings
                            </p>
                        </div>

                        {/* Enable/Disable Toggle */}
                        <div className="bg-[#96A476]/10 border-2 border-blue-200 rounded-xl p-6">
                            <label className="flex items-start gap-4 cursor-pointer">
                                <input
                                    type="checkbox"
                                    {...register('requiresReservation')}
                                    className="mt-1 h-5 w-5 text-[#96A476] border-[#96A476]/40 rounded"
                                />
                                <div className="flex-1">
                                    <div className="font-bold text-lg text-[#3D4331]">
                                        Enable Two-Step Payment System
                                    </div>
                                    <p className="text-sm text-[#3D4331]/70 mt-1">
                                        When enabled, bookings above the minimum nights threshold will require an upfront reservation payment, with the remaining amount due on check-in day.
                                    </p>
                                    <div className="mt-3 bg-[#EBE1D0] border border-blue-300 rounded-lg p-3">
                                        <div className="text-xs text-[#3D4331]/80">
                                            <strong>How it works:</strong>
                                            <ol className="list-decimal ml-4 mt-2 space-y-1">
                                                <li>Guest applies for stay</li>
                                                <li>Admin approves application</li>
                                                <li>Guest pays reservation amount to secure spot</li>
                                                <li>Remaining amount is due on check-in day</li>
                                            </ol>
                                        </div>
                                    </div>
                                </div>
                            </label>
                        </div>

                        {/* Settings (shown when enabled) */}
                        {requiresReservation && (
                            <div className="space-y-6 animate-fadeIn">
                                {/* Minimum Nights Threshold */}
                                <div>
                                    <label className="block text-sm font-bold text-[#3D4331]/80 mb-2">
                                        Minimum Nights for Reservation System
                                    </label>
                                    <p className="text-xs text-[#3D4331]/70 mb-3">
                                        Bookings with this many nights or more will require a reservation payment. Shorter stays pay in full.
                                    </p>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            {...register('minNightsForReservation', { valueAsNumber: true })}
                                            min="2"
                                            max="30"
                                            className="w-full p-3 border-2 border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476] text-lg font-semibold"
                                        />
                                        <span className="absolute right-3 top-3 text-[#3D4331]/60">nights</span>
                                    </div>
                                    <p className="text-xs text-[#3D4331]/60 mt-2">
                                        💡 Example: Set to 3 means bookings of 3+ nights require reservation
                                    </p>
                                </div>

                              {/* Reservation Amount */}
<div>
    <label className="block text-sm font-bold text-[#3D4331]/80 mb-2">
        Reservation Amount (USD)
    </label>
    <p className="text-xs text-[#3D4331]/70 mb-3">
        The upfront amount guests must pay to secure their booking. They'll pay the rest on check-in day.
    </p>
    <div className="relative">
        <span className="absolute left-3 top-3 text-[#3D4331]/60 text-lg font-bold">$</span>
        <input
            type="number"
            {...register('reservationAmount', { valueAsNumber: true })}
            min="0"
            max="100000"
            // ✅ FIXED: Changed from "5" to "0.001" to allow decimals
            step="0.001" 
            className="w-full pl-8 p-3 border-2 border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476] text-lg font-semibold"
        />
    </div>
    <p className="text-xs text-[#3D4331]/60 mt-2">
        💡 Common amounts: $0.01, $30, $50
    </p>
</div>

                                {/* Preview Example */}
                                <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                                    <h4 className="font-bold text-purple-900 mb-3">
                                        📋 Example Booking Flow
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-start gap-2">
                                            <span className="text-purple-600 font-bold">Guest:</span>
                                            <span className="text-purple-900">
                                                Books {stay.duration} nights at ${stay.priceUSDC}/night = ${(stay.duration * stay.priceUSDC).toFixed(2)} total
                                            </span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-purple-600 font-bold">Step 1:</span>
                                            <span className="text-purple-900">
                                                Pays ${watch('reservationAmount') || 30} reservation (now)
                                            </span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-purple-600 font-bold">Step 2:</span>
                                            <span className="text-purple-900">
                                                Pays ${((stay.duration * stay.priceUSDC) - (watch('reservationAmount') || 30)).toFixed(2)} remaining (check-in day)
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Disabled State Info */}
                        {!requiresReservation && (
                            <div className="bg-[#F3EDE0] border border-[#96A476]/20 rounded-lg p-4 text-center">
                                <p className="text-[#3D4331]/70">
                                    <strong>Current Mode:</strong> Full payment required upfront
                                </p>
                                <p className="text-sm text-[#3D4331]/60 mt-1">
                                    Enable reservation system above to split payments
                                </p>
                            </div>
                        )}
                    </div>
                )}
 
                <div className="mt-8 flex justify-end">
                    <button type="submit" disabled={saving} className={`px-8 py-3 text-xl font-semibold rounded-lg transition duration-200 shadow-xl 
                        ${saving 
                            ? 'bg-gray-400 text-[#3D4331]/80 cursor-not-allowed' 
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
  <StayChainConfig
                    stayId={stay.id}
                    currentEnabledChains={stay.enabledChains || []}
                    onUpdate={fetchStay}
                />
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

// Room Editor Modal (unchanged, keeping your existing code)
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
            <div className="bg-[#EBE1D0] p-6 rounded-xl shadow-2xl max-w-2xl w-full my-8 space-y-6">
                <h3 className="text-2xl font-bold border-b pb-3">Edit Room: {editedRoom.name || 'New Room'}</h3>
                
                <div>
                    <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">Room Name</label>
                    <input
                        value={editedRoom.name}
                        onChange={(e) => setEditedRoom({ ...editedRoom, name: e.target.value })}
                        className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                        placeholder="e.g., Shared Bedroom"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">Description</label>
                    <textarea
                        value={editedRoom.description}
                        onChange={(e) => setEditedRoom({ ...editedRoom, description: e.target.value })}
                        className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476] font-sans"
                        rows={3}
                        placeholder="Describe the room..."
                    />
                </div>

                
                
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">Beds</label>
                        <input
                            type="text"
                            value={editedRoom.beds || ''}
                            onChange={(e) => setEditedRoom({ ...editedRoom, beds: e.target.value })}
                            className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                            placeholder="e.g. 1 King Bed"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">Area</label>
                        <input
                            type="text"
                            value={editedRoom.area || ''}
                            onChange={(e) => setEditedRoom({ ...editedRoom, area: e.target.value })}
                            className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                            placeholder="e.g. 220 sq ft"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">Rooms Left</label>
                        <input
                            type="number"
                            value={editedRoom.roomsLeft || 0}
                            onChange={(e) => setEditedRoom({ ...editedRoom, roomsLeft: parseInt(e.target.value) || 0 })}
                            className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                            min={0}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">Beds</label>
                        <input
                            type="text"
                            value={editedRoom.beds || ''}
                            onChange={(e) => setEditedRoom({ ...editedRoom, beds: e.target.value })}
                            className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                            placeholder="e.g. 1 King Bed"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">Area</label>
                        <input
                            type="text"
                            value={editedRoom.area || ''}
                            onChange={(e) => setEditedRoom({ ...editedRoom, area: e.target.value })}
                            className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                            placeholder="e.g. 220 sq ft"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">Rooms Left</label>
                        <input
                            type="number"
                            value={editedRoom.roomsLeft || 0}
                            onChange={(e) => setEditedRoom({ ...editedRoom, roomsLeft: parseInt(e.target.value) || 0 })}
                            className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                            min={0}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">Capacity</label>
                        <input
                            type="number"
                            value={editedRoom.capacity}
                            onChange={(e) => setEditedRoom({ ...editedRoom, capacity: parseInt(e.target.value) })}
                            className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                            min={1}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">
                            Price USDC <span className="text-[#96A476] font-semibold">/night</span>
                        </label>
                        <input
                            type="number"
                            value={editedRoom.priceUSDC}
                            onChange={(e) => setEditedRoom({ ...editedRoom, priceUSDC: parseFloat(e.target.value) })}
                            className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                            step="0.01"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#3D4331]/80 mb-1">
                            Price USDT <span className="text-[#96A476] font-semibold">/night</span>
                        </label>
                        <input
                            type="number"
                            value={editedRoom.priceUSDT}
                            onChange={(e) => setEditedRoom({ ...editedRoom, priceUSDT: parseFloat(e.target.value) })}
                            className="w-full p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                            step="0.01"
                        />
                    </div>
                </div>

                {stayDuration && (
                    <div className="bg-[#96A476]/10 border-2 border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-900">
                            <strong>Total for {stayDuration} nights:</strong> ${(editedRoom.priceUSDC * stayDuration).toFixed(2)} USDC / ${(editedRoom.priceUSDT * stayDuration).toFixed(2)} USDT
                        </p>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-[#3D4331]/80 mb-2">Room Images</label>
                    <div className="flex gap-3 mb-4">
                        <input
                            type="text"
                            value={newRoomImage}
                            onChange={(e) => setNewRoomImage(e.target.value)}
                            placeholder="Enter image URL"
                            className="flex-grow p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                        />
                        <button type="button" onClick={addRoomImage} className="px-4 py-2 bg-[#3D4331] text-white rounded-lg hover:bg-[#525942] transition duration-150 flex items-center">
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

                <div>
                    <label className="block text-sm font-medium text-[#3D4331]/80 mb-2">Room Amenities</label>
                    <div className="flex gap-3 mb-4">
                        <input
                            type="text"
                            value={newRoomAmenity}
                            onChange={(e) => setNewRoomAmenity(e.target.value)}
                            placeholder="e.g., Private bathroom, Work desk"
                            className="flex-grow p-2 border border-[#96A476]/40 rounded-lg focus:ring-[#96A476] focus:border-[#96A476]"
                        />
                        <button type="button" onClick={addRoomAmenity} className="px-4 py-2 bg-[#3D4331] text-white rounded-lg hover:bg-[#525942] transition duration-150 flex items-center">
                            Add
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {(editedRoom.amenities || []).map((amenity, i) => (
                            <div key={i} className="px-3 py-1 bg-[#96A476]/20 text-[#3D4331] rounded-full text-xs font-medium flex items-center gap-1">
                                {amenity}
                                <button
                                    type="button"
                                    onClick={() => removeRoomAmenity(i)}
                                    className="text-[#3D4331] hover:text-green-900 transition"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#96A476]/20">
                    <button onClick={onCancel} type="button" className="px-4 py-2 bg-[#F3EDE0]0 text-white rounded-lg hover:bg-gray-600 transition duration-150">
                        Cancel
                    </button>
                    <button onClick={handleSave} type="button" className="px-4 py-2 bg-[#3D4331] text-white rounded-lg hover:bg-[#525942] transition duration-150">
                        Save Room
                    </button>
                </div>
            </div>
        </div>
    );
}