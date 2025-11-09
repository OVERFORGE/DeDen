// File: app/admin/stays/[id]/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';

type Stay = {
  id: string;
  stayId: string;
  title: string;
  slug: string;
  location: string;
  description: string;
  startDate: string;
  endDate: string;
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
  rooms: Room[];
};

type Room = {
  id?: string;
  name: string;
  description: string;
  capacity: number;
  price: number;
  images: string[];
  amenities: string[];
};

export default function EditStayPage() {
  const params = useParams();
  const router = useRouter();
  const stayId = params.id as string;

  const [stay, setStay] = useState<Stay | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'images' | 'rooms' | 'amenities'>('basic');
  
  // Image & Room management state
  const [newImage, setNewImage] = useState('');
  const [newAmenity, setNewAmenity] = useState('');
  const [newHighlight, setNewHighlight] = useState('');
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    fetchStay();
  }, [stayId]);

  const fetchStay = async () => {
    try {
      const res = await fetch(`/api/admin/stays/${stayId}`);
      if (!res.ok) throw new Error('Failed to fetch stay');
      const data = await res.json();
      
      // Initialize arrays if they don't exist
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

  // Image management
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

  // Amenity management
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

  // Highlight management (What to Expect)
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

  // Room management
  const addRoom = () => {
    setEditingRoom({
      name: '',
      description: '',
      capacity: 2,
      price: stay?.priceUSDC || 300,
      images: [],
      amenities: [],
    });
  };

  const saveRoom = (room: Room) => {
    if (!stay) return;
    
    if (room.id) {
      // Update existing room
      const updated = stay.rooms.map(r => r.id === room.id ? room : r);
      setStay({ ...stay, rooms: updated });
    } else {
      // Add new room
      const newRoom = { ...room, id: Date.now().toString() };
      setStay({ ...stay, rooms: [...stay.rooms, newRoom] });
    }
    
    setEditingRoom(null);
  };

  const deleteRoom = (roomId: string) => {
    if (!stay || !confirm('Delete this room?')) return;
    const updated = stay.rooms.filter(r => r.id !== roomId);
    setStay({ ...stay, rooms: updated });
  };

  if (loading) return <div style={styles.container}>Loading...</div>;
  if (!stay) return <div style={styles.container}>Stay not found</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Edit Stay: {stay.title}</h1>
        <button onClick={() => router.push('/admin/stays')} style={styles.backButton}>
          ← Back to Stays
        </button>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {(['basic', 'images', 'rooms', 'amenities'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.activeTab : {}),
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Basic Information</h3>
            
            <div style={styles.field}>
              <label style={styles.label}>Title</label>
              <input {...register('title')} style={styles.input} />
            </div>

            <div style={styles.fieldRow}>
              <div style={styles.field}>
                <label style={styles.label}>Slug</label>
                <input {...register('slug')} style={styles.input} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Location</label>
                <input {...register('location')} style={styles.input} />
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Description</label>
              <textarea {...register('description')} rows={5} style={styles.textarea} />
            </div>

            <div style={styles.fieldRow}>
              <div style={styles.field}>
                <label style={styles.label}>Start Date</label>
                <input type="date" {...register('startDate')} style={styles.input} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>End Date</label>
                <input type="date" {...register('endDate')} style={styles.input} />
              </div>
            </div>

            <div style={styles.fieldRow}>
              <div style={styles.field}>
                <label style={styles.label}>Price USDC</label>
                <input type="number" {...register('priceUSDC')} style={styles.input} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Price USDT</label>
                <input type="number" {...register('priceUSDT')} style={styles.input} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Total Slots</label>
                <input type="number" {...register('slotsTotal')} style={styles.input} />
              </div>
            </div>

            <div style={styles.checkboxGroup}>
              <label style={styles.checkboxLabel}>
                <input type="checkbox" {...register('isPublished')} />
                Published
              </label>
              <label style={styles.checkboxLabel}>
                <input type="checkbox" {...register('isFeatured')} />
                Featured
              </label>
              <label style={styles.checkboxLabel}>
                <input type="checkbox" {...register('allowWaitlist')} />
                Allow Applications
              </label>
            </div>
          </div>
        )}

        {/* Images Tab */}
        {activeTab === 'images' && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Villa Images</h3>
            
            <div style={styles.addImageSection}>
              <input
                type="text"
                value={newImage}
                onChange={(e) => setNewImage(e.target.value)}
                placeholder="Enter image URL (e.g., https://example.com/image.jpg)"
                style={styles.input}
              />
              <button type="button" onClick={addImage} style={styles.addButton}>
                Add Image
              </button>
            </div>

            <div style={styles.imageGrid}>
              {stay.images.map((img, i) => (
                <div key={i} style={styles.imageCard}>
                  <div style={styles.imagePreview}>
                    <img src={img} alt={`Villa ${i + 1}`} style={styles.image} />
                  </div>
                  <div style={styles.imageUrl}>{img}</div>
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    style={styles.removeButton}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {stay.images.length === 0 && (
              <div style={styles.emptyState}>
                No images yet. Add some villa photos!
              </div>
            )}
          </div>
        )}

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>Room Types</h3>
              <button type="button" onClick={addRoom} style={styles.addButton}>
                + Add Room
              </button>
            </div>

            <div style={styles.roomsList}>
              {stay.rooms.map(room => (
                <div key={room.id} style={styles.roomCard}>
                  <h4>{room.name}</h4>
                  <p>{room.description}</p>
                  <div style={styles.roomMeta}>
                    <span>👥 {room.capacity} people</span>
                    <span>${room.price} USDC</span>
                  </div>
                  <div style={styles.roomActions}>
                    <button
                      type="button"
                      onClick={() => setEditingRoom(room)}
                      style={styles.editButton}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => room.id && deleteRoom(room.id)}
                      style={styles.deleteButton}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {stay.rooms.length === 0 && (
              <div style={styles.emptyState}>
                No rooms yet. Add room types for your stay!
              </div>
            )}
          </div>
        )}

        {/* Amenities Tab */}
        {activeTab === 'amenities' && (
          <div style={styles.section}>
            {/* What's Included Section */}
            <h3 style={styles.sectionTitle}>What's Included</h3>
            <p style={{ color: '#666', marginBottom: '20px' }}>Add amenities and services included in the stay</p>
            
            <div style={styles.addImageSection}>
              <input
                type="text"
                value={newAmenity}
                onChange={(e) => setNewAmenity(e.target.value)}
                placeholder="e.g., High-speed WiFi, Swimming Pool, Daily Meals"
                style={styles.input}
              />
              <button type="button" onClick={addAmenity} style={styles.addButton}>
                Add Amenity
              </button>
            </div>

            <div style={styles.amenitiesList}>
              {stay.amenities.map((amenity, i) => (
                <div key={i} style={styles.amenityTag}>
                  {amenity}
                  <button
                    type="button"
                    onClick={() => removeAmenity(i)}
                    style={styles.removeTagButton}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {stay.amenities.length === 0 && (
              <div style={styles.emptyState}>
                No amenities yet. Add what's included!
              </div>
            )}

            {/* What to Expect Section */}
            <h3 style={{ ...styles.sectionTitle, marginTop: '60px' }}>What to Expect</h3>
            <p style={{ color: '#666', marginBottom: '20px' }}>Add highlights of the experience and what guests can expect</p>
            
            <div style={styles.addImageSection}>
              <input
                type="text"
                value={newHighlight}
                onChange={(e) => setNewHighlight(e.target.value)}
                placeholder="e.g., Meet 20-30 builders, Daily co-working sessions"
                style={styles.input}
              />
              <button type="button" onClick={addHighlight} style={styles.addButton}>
                Add Highlight
              </button>
            </div>

            <div style={styles.amenitiesList}>
              {(stay.highlights || []).map((highlight, i) => (
                <div key={i} style={styles.amenityTag}>
                  {highlight}
                  <button
                    type="button"
                    onClick={() => removeHighlight(i)}
                    style={styles.removeTagButton}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {(!stay.highlights || stay.highlights.length === 0) && (
              <div style={styles.emptyState}>
                No highlights yet. Add what guests can expect!
              </div>
            )}
          </div>
        )}

        {/* Save Button */}
        <div style={styles.footer}>
          <button type="submit" disabled={saving} style={styles.saveButton}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Room Editor Modal */}
      {editingRoom && (
        <RoomEditorModal
          room={editingRoom}
          onSave={saveRoom}
          onCancel={() => setEditingRoom(null)}
        />
      )}
    </div>
  );
}

// Room Editor Modal Component
function RoomEditorModal({
  room,
  onSave,
  onCancel,
}: {
  room: Room;
  onSave: (room: Room) => void;
  onCancel: () => void;
}) {
  const [editedRoom, setEditedRoom] = useState(room);
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

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal}>
        <h3>Edit Room</h3>
        
        <div style={styles.field}>
          <label style={styles.label}>Room Name</label>
          <input
            value={editedRoom.name}
            onChange={(e) => setEditedRoom({ ...editedRoom, name: e.target.value })}
            style={styles.input}
            placeholder="e.g., Shared Bedroom"
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Description</label>
          <textarea
            value={editedRoom.description}
            onChange={(e) => setEditedRoom({ ...editedRoom, description: e.target.value })}
            style={styles.textarea}
            rows={3}
            placeholder="Describe the room..."
          />
        </div>

        <div style={styles.fieldRow}>
          <div style={styles.field}>
            <label style={styles.label}>Capacity</label>
            <input
              type="number"
              value={editedRoom.capacity}
              onChange={(e) => setEditedRoom({ ...editedRoom, capacity: parseInt(e.target.value) })}
              style={styles.input}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Price (USDC)</label>
            <input
              type="number"
              value={editedRoom.price}
              onChange={(e) => setEditedRoom({ ...editedRoom, price: parseFloat(e.target.value) })}
              style={styles.input}
            />
          </div>
        </div>

        {/* Room Images */}
        <div style={styles.field}>
          <label style={styles.label}>Room Images</label>
          <div style={styles.addImageSection}>
            <input
              type="text"
              value={newRoomImage}
              onChange={(e) => setNewRoomImage(e.target.value)}
              placeholder="Enter image URL"
              style={styles.input}
            />
            <button type="button" onClick={addRoomImage} style={styles.addButton}>
              Add
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
            {(editedRoom.images || []).map((img, i) => (
              <div key={i} style={{ position: 'relative', width: '80px', height: '80px' }}>
                <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                <button
                  type="button"
                  onClick={() => removeRoomImage(i)}
                  style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Room Amenities */}
        <div style={styles.field}>
          <label style={styles.label}>Room Amenities</label>
          <div style={styles.addImageSection}>
            <input
              type="text"
              value={newRoomAmenity}
              onChange={(e) => setNewRoomAmenity(e.target.value)}
              placeholder="e.g., Private bathroom, Work desk"
              style={styles.input}
            />
            <button type="button" onClick={addRoomAmenity} style={styles.addButton}>
              Add
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
            {(editedRoom.amenities || []).map((amenity, i) => (
              <div key={i} style={styles.amenityTag}>
                {amenity}
                <button
                  type="button"
                  onClick={() => removeRoomAmenity(i)}
                  style={styles.removeTagButton}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={modalStyles.actions}>
          <button onClick={onCancel} style={modalStyles.cancelButton}>
            Cancel
          </button>
          <button onClick={() => onSave(editedRoom)} style={modalStyles.saveButton}>
            Save Room
          </button>
        </div>
      </div>
    </div>
  );
}

// Styles
const styles = {
  container: { maxWidth: '1200px', margin: '0 auto', padding: '20px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
  title: { fontSize: '2rem', fontWeight: 'bold' },
  backButton: { padding: '10px 20px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  tabs: { display: 'flex', gap: '8px', marginBottom: '30px', borderBottom: '2px solid #e5e7eb' },
  tab: { padding: '12px 24px', backgroundColor: 'transparent', border: 'none', borderBottom: '3px solid transparent', cursor: 'pointer', fontSize: '1rem', fontWeight: '500', color: '#666' },
  activeTab: { color: '#0070f3', borderBottomColor: '#0070f3', fontWeight: '600' },
  section: { backgroundColor: 'white', padding: '30px', borderRadius: '8px', marginBottom: '20px' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  sectionTitle: { fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px' },
  field: { marginBottom: '20px', flex: '1' },
  fieldRow: { display: 'flex', gap: '20px' },
  label: { display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' },
  input: { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '1rem' },
  textarea: { width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '1rem', fontFamily: 'inherit' },
  checkboxGroup: { display: 'flex', gap: '20px', marginTop: '20px' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' },
  addImageSection: { display: 'flex', gap: '10px', marginBottom: '30px' },
  addButton: { padding: '10px 20px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  imageGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' },
  imageCard: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '15px', backgroundColor: '#f9fafb' },
  imagePreview: { width: '100%', height: '150px', backgroundColor: '#e5e7eb', borderRadius: '6px', overflow: 'hidden', marginBottom: '10px' },
  image: { width: '100%', height: '100%', objectFit: 'cover' as const },
  imageUrl: { fontSize: '0.8rem', color: '#6b7280', marginBottom: '10px', wordBreak: 'break-all' as const },
  removeButton: { padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' },
  roomsList: { display: 'grid', gap: '20px' },
  roomCard: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', backgroundColor: '#f9fafb' },
  roomMeta: { display: 'flex', gap: '20px', margin: '15px 0', color: '#6b7280' },
  roomActions: { display: 'flex', gap: '10px' },
  editButton: { padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  deleteButton: { padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  amenitiesList: { display: 'flex', flexWrap: 'wrap' as const, gap: '10px' },
  amenityTag: { padding: '8px 16px', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' },
  removeTagButton: { backgroundColor: 'transparent', border: 'none', color: '#1e40af', fontSize: '1.2rem', cursor: 'pointer', padding: '0 4px' },
  emptyState: { textAlign: 'center' as const, padding: '60px 20px', color: '#9ca3af', fontSize: '1.1rem' },
  footer: { marginTop: '30px', display: 'flex', justifyContent: 'flex-end' },
  saveButton: { padding: '12px 32px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontSize: '1.1rem', fontWeight: '600', cursor: 'pointer' },
};

const modalStyles = {
  overlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, overflowY: 'auto' as const, padding: '20px' },
  modal: { backgroundColor: 'white', padding: '30px', borderRadius: '12px', maxWidth: '700px', width: '90%', maxHeight: '90vh', overflow: 'auto' },
  actions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '30px' },
  cancelButton: { padding: '10px 20px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  saveButton: { padding: '10px 20px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
};