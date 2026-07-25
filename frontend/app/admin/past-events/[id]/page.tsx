"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Plus, Trash2, Image as ImageIcon } from "lucide-react";
import React from "react";

interface Testimonial {
  name: string;
  text: string;
  avatarUrl?: string;
}

export default function EditPastEventPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [stayId, setStayId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stayTitle, setStayTitle] = useState("");
  
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [newImage, setNewImage] = useState("");
  const [newTestimonial, setNewTestimonial] = useState<Testimonial>({ name: "", text: "" });

  useEffect(() => {
    // Resolve params using React.use() or just .then()
    params.then((resolvedParams) => {
      setStayId(resolvedParams.id);
      fetchStayDetails(resolvedParams.id);
    });
  }, [params]);

  const fetchStayDetails = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/stays/${id}`);
      if (!response.ok) throw new Error("Failed to fetch stay details");
      const data = await response.json();
      
      setStayTitle(data.title);
      setGalleryImages(data.galleryImages || []);
      setTestimonials(data.testimonials || []);
    } catch (err) {
      alert("Error loading stay: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/stays/${stayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ galleryImages, testimonials }),
      });

      if (!response.ok) throw new Error("Failed to update past event details");
      alert("Details saved successfully!");
      router.push("/admin/past-events");
    } catch (err) {
      alert("Error saving: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const addImage = () => {
    if (!newImage.trim()) return;
    setGalleryImages([...galleryImages, newImage.trim()]);
    setNewImage("");
  };

  const removeImage = (index: number) => {
    setGalleryImages(galleryImages.filter((_, i) => i !== index));
  };

  const addTestimonial = () => {
    if (!newTestimonial.name.trim() || !newTestimonial.text.trim()) return;
    setTestimonials([...testimonials, newTestimonial]);
    setNewTestimonial({ name: "", text: "" });
  };

  const removeTestimonial = (index: number) => {
    setTestimonials(testimonials.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7eedb] p-6 lg:p-10 flex items-center justify-center">
        <div className="text-center p-16 bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f]">
          <div className="w-12 h-12 border-4 border-[#f7eedb] border-t-[#2c331f] rounded-full animate-spin mx-auto mb-5"></div>
          <p className="font-bold text-[#2c331f] uppercase tracking-widest text-[10px]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7eedb] p-6 lg:p-10">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link 
              href="/admin/past-events" 
              className="inline-flex items-center gap-2 text-[#5a6b3a] font-bold uppercase tracking-widest text-xs mb-4 hover:text-[#2c331f] transition-colors"
            >
              <ArrowLeft size={16} /> Back to Past Events
            </Link>
            <h1 className="text-4xl md:text-5xl font-black text-[#2c331f] font-display tracking-tight">
              Edit Event: {stayTitle}
            </h1>
          </div>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 py-3 px-6 bg-[#2c331f] text-[#f7eedb] rounded-xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-1 hover:translate-x-1 transition-all font-black uppercase tracking-widest text-xs disabled:opacity-70 disabled:pointer-events-none"
          >
            {saving ? <div className="w-4 h-4 border-2 border-[#f7eedb] border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
            {saving ? "Saving..." : "Save Details"}
          </button>
        </div>

        {/* Gallery Section */}
        <div className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] p-8 mb-8">
          <h2 className="text-2xl font-black mb-6 text-[#2c331f] font-display flex items-center gap-2">
            <ImageIcon size={24} /> Event Gallery
          </h2>
          
          <div className="flex gap-4 mb-6">
            <input 
              type="text" 
              placeholder="Image URL (e.g., /images/event1.jpg)" 
              value={newImage}
              onChange={(e) => setNewImage(e.target.value)}
              className="flex-1 bg-gray-50 border-2 border-[#2c331f] rounded-xl px-4 py-3 text-sm font-bold text-[#2c331f] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9db47d]"
            />
            <button
              onClick={addImage}
              className="flex items-center gap-2 py-3 px-6 bg-[#e8c37b] text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[2px_2px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-[2px] hover:translate-x-[2px] transition-all font-bold uppercase tracking-widest text-xs"
            >
              <Plus size={16} /> Add
            </button>
          </div>

          {galleryImages.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {galleryImages.map((img, i) => (
                <div key={i} className="relative group rounded-lg border-2 border-[#2c331f] overflow-hidden aspect-video bg-gray-100 flex items-center justify-center">
                  <img src={img} alt={`Gallery ${i}`} className="object-cover w-full h-full" />
                  <button 
                    onClick={() => removeImage(i)}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-md border-2 border-[#2c331f] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 border-2 border-dashed border-gray-300 rounded-xl text-center">
              <p className="text-gray-500 font-bold text-sm">No images added yet.</p>
            </div>
          )}
        </div>

        {/* Testimonials Section */}
        <div className="bg-white rounded-2xl border-2 border-[#2c331f] shadow-[4px_4px_0px_0px_#2c331f] p-8">
          <h2 className="text-2xl font-black mb-6 text-[#2c331f] font-display">
            Testimonials
          </h2>

          <div className="flex flex-col gap-4 mb-8 bg-[#f7eedb] p-6 rounded-xl border-2 border-[#2c331f]">
            <h3 className="font-bold text-[#2c331f] uppercase tracking-widest text-xs mb-2">Add New Testimonial</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                type="text" 
                placeholder="Attendee Name" 
                value={newTestimonial.name}
                onChange={(e) => setNewTestimonial({...newTestimonial, name: e.target.value})}
                className="bg-white border-2 border-[#2c331f] rounded-xl px-4 py-3 text-sm font-bold text-[#2c331f] focus:outline-none focus:ring-2 focus:ring-[#9db47d]"
              />
              <input 
                type="text" 
                placeholder="Avatar URL (Optional)" 
                value={newTestimonial.avatarUrl || ''}
                onChange={(e) => setNewTestimonial({...newTestimonial, avatarUrl: e.target.value})}
                className="bg-white border-2 border-[#2c331f] rounded-xl px-4 py-3 text-sm font-bold text-[#2c331f] focus:outline-none focus:ring-2 focus:ring-[#9db47d]"
              />
            </div>
            <textarea 
              placeholder="Testimonial text..." 
              value={newTestimonial.text}
              onChange={(e) => setNewTestimonial({...newTestimonial, text: e.target.value})}
              rows={3}
              className="bg-white border-2 border-[#2c331f] rounded-xl px-4 py-3 text-sm font-bold text-[#2c331f] focus:outline-none focus:ring-2 focus:ring-[#9db47d]"
            />
            <div className="flex justify-end">
              <button
                onClick={addTestimonial}
                className="flex items-center gap-2 py-3 px-6 bg-[#9db47d] text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[2px_2px_0px_0px_#2c331f] hover:shadow-[0px_0px_0px_0px_#2c331f] hover:translate-y-[2px] hover:translate-x-[2px] transition-all font-bold uppercase tracking-widest text-xs"
              >
                <Plus size={16} /> Add Testimonial
              </button>
            </div>
          </div>

          {testimonials.length > 0 ? (
            <div className="flex flex-col gap-4">
              {testimonials.map((test, i) => (
                <div key={i} className="flex justify-between items-start border-2 border-[#2c331f] p-4 rounded-xl relative">
                  <div>
                    <h4 className="font-black text-[#2c331f]">{test.name}</h4>
                    <p className="text-sm text-gray-700 mt-1 font-medium">{test.text}</p>
                    {test.avatarUrl && <p className="text-xs text-gray-400 mt-2">Avatar: {test.avatarUrl}</p>}
                  </div>
                  <button 
                    onClick={() => removeTestimonial(i)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 border-2 border-dashed border-gray-300 rounded-xl text-center">
              <p className="text-gray-500 font-bold text-sm">No testimonials added yet.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
