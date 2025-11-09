"use client";

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import Link from 'next/link';

type StayData = {
  id: string;
  stayId: string;
  title: string;
  slug: string;
  location: string;
  description: string;
  startDate: string;
  endDate: string;
  duration: number | null;
  priceUSDC: number;
  priceUSDT: number;
  slotsTotal: number;
  slotsAvailable: number;
  allowWaitlist: boolean;
  images: string[];
  amenities: string[];
  highlights: string[];
  rooms: any[];
};

type Booking = {
  bookingId: string;
  status: string;
};

export default function StayDetailsClient({ stay }: { stay: StayData }) {
  const { address, isConnected } = useAccount();
  const [existingBooking, setExistingBooking] = useState<Booking | null>(null);
  const [checkingBooking, setCheckingBooking] = useState(false);

  // Check if user already has a booking for this stay
  useEffect(() => {
    if (!address) {
      setExistingBooking(null);
      return;
    }

    async function checkBooking() {
      try {
        setCheckingBooking(true);
        const res = await fetch(`/api/user/bookings?wallet=${address}`);
        if (res.ok) {
          const bookings = await res.json();
          const booking = bookings.find((b: any) => b.stay && b.stay.id === stay.id);
          setExistingBooking(booking || null);
        }
      } catch (err) {
        console.error('Error checking booking:', err);
      } finally {
        setCheckingBooking(false);
      }
    }

    checkBooking();
  }, [address, stay.id]);

  return (
    <main style={styles.main}>
      {/* Hero Section with Real Images */}
      <section style={styles.hero}>
        {stay.images && stay.images.length > 0 ? (
          <div style={styles.imageGallery}>
            <div style={styles.mainImage}>
              <img 
                src={stay.images[0]} 
                alt={stay.title}
                style={styles.image}
              />
            </div>
            {stay.images.length > 1 && (
              <div style={styles.thumbnailGrid}>
                {stay.images.slice(1, 5).map((img, idx) => (
                  <div key={idx} style={styles.thumbnail}>
                    <img src={img} alt={`${stay.title} ${idx + 2}`} style={styles.image} />
                  </div>
                ))}
                {stay.images.length > 5 && (
                  <div style={styles.moreImages}>
                    +{stay.images.length - 5} more
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={styles.imagePlaceholder}>
            📸 No images yet
          </div>
        )}
        
        <div style={styles.heroContent}>
          <h1 style={styles.title}>{stay.title}</h1>
          <p style={styles.location}>📍 {stay.location}</p>
          <div style={styles.dateRange}>
            🗓️ {new Date(stay.startDate).toLocaleDateString()} - {new Date(stay.endDate).toLocaleDateString()}
          </div>
        </div>
      </section>

      {/* Key Information */}
      <section style={styles.infoSection}>
        <div style={styles.infoGrid}>
          <div style={styles.infoCard}>
            <div style={styles.infoIcon}>💰</div>
            <div style={styles.infoLabel}>Price</div>
            <div style={styles.infoValue}>${stay.priceUSDC} USDC</div>
          </div>
          <div style={styles.infoCard}>
            <div style={styles.infoIcon}>👥</div>
            <div style={styles.infoLabel}>Slots Available</div>
            <div style={styles.infoValue}>{stay.slotsAvailable} / {stay.slotsTotal}</div>
          </div>
          <div style={styles.infoCard}>
            <div style={styles.infoIcon}>⏰</div>
            <div style={styles.infoLabel}>Duration</div>
            <div style={styles.infoValue}>
              {stay.duration || Math.ceil((new Date(stay.endDate).getTime() - new Date(stay.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
            </div>
          </div>
        </div>
      </section>

      {/* Description (from DB) */}
      <section style={styles.detailsSection}>
        <h2 style={styles.sectionTitle}>About This Stay</h2>
        <p style={styles.description}>
          {stay.description || `Join us for an immersive builder experience at ${stay.location}.`}
        </p>

        {/* Amenities from Database */}
        {stay.amenities && stay.amenities.length > 0 && (
          <>
            <h3 style={styles.subsectionTitle}>What's Included</h3>
            <ul style={styles.amenitiesList}>
              {stay.amenities.map((amenity, idx) => (
                <li key={idx}>✓ {amenity}</li>
              ))}
            </ul>
          </>
        )}

        {/* Highlights from Database */}
        {stay.highlights && stay.highlights.length > 0 && (
          <>
            <h3 style={styles.subsectionTitle}>What to Expect</h3>
            <ul style={styles.amenitiesList}>
              {stay.highlights.map((highlight, idx) => (
                <li key={idx}>🎯 {highlight}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Room Options from Database */}
      {stay.rooms && stay.rooms.length > 0 && (
        <section style={styles.roomsSection}>
          <h2 style={styles.sectionTitle}>Room Options</h2>
          <div style={styles.roomGrid}>
            {stay.rooms.map((room: any, idx: number) => (
              <div key={room.id || idx} style={styles.roomCard}>
                {room.images && room.images.length > 0 ? (
                  <div style={styles.roomImageContainer}>
                    <img 
                      src={room.images[0]} 
                      alt={room.name}
                      style={styles.roomImage}
                    />
                  </div>
                ) : (
                  <div style={styles.roomImagePlaceholder}>🛏️</div>
                )}
                <h4 style={styles.roomName}>{room.name}</h4>
                <p style={styles.roomDescription}>{room.description}</p>
                <div style={styles.roomMeta}>
                  <span>👥 {room.capacity} people</span>
                </div>
                {room.amenities && room.amenities.length > 0 && (
                  <div style={styles.roomAmenities}>
                    {room.amenities.slice(0, 3).map((amenity: string, i: number) => (
                      <span key={i} style={styles.roomAmenityTag}>
                        {amenity}
                      </span>
                    ))}
                  </div>
                )}
                <p style={styles.roomPrice}>${room.price} USDC</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQ Section */}
      <section style={styles.faqSection}>
        <h2 style={styles.sectionTitle}>Frequently Asked Questions</h2>
        <div style={styles.faqItem}>
          <h4>What's the application process?</h4>
          <p>Submit your application → Wait for approval (24-48h) → Pay with crypto → You're in!</p>
        </div>
        <div style={styles.faqItem}>
          <h4>What payment methods do you accept?</h4>
          <p>We accept USDC and USDT on BSC network. You'll need a crypto wallet like MetaMask.</p>
        </div>
        <div style={styles.faqItem}>
          <h4>What's your cancellation policy?</h4>
          <p>Full refund if cancelled 14+ days before. 50% refund if 7-14 days before. No refund within 7 days.</p>
        </div>
      </section>

      {/* CTA Section - Smart Button Logic */}
      <section style={styles.ctaSection}>
        {checkingBooking ? (
          <p>Checking your application status...</p>
        ) : existingBooking ? (
          // User already applied
          <div style={styles.alreadyApplied}>
            <h2>✅ You've Already Applied!</h2>
            <p>
              Your application status: <strong>{existingBooking.status}</strong>
            </p>
            {existingBooking.status === 'PENDING' && (
              <Link href={`/booking/${existingBooking.bookingId}`} style={styles.paymentButton}>
                Complete Payment →
              </Link>
            )}
            {existingBooking.status === 'WAITLISTED' && (
              <p style={{ color: '#666', marginTop: '10px' }}>
                We'll notify you within 24-48 hours about your application status.
              </p>
            )}
            {existingBooking.status === 'CONFIRMED' && (
              <Link href="/dashboard" style={styles.dashboardButton}>
                View My Bookings →
              </Link>
            )}
          </div>
        ) : stay.allowWaitlist && stay.slotsAvailable > 0 ? (
          // Available to apply
          <>
            <h2 style={styles.ctaTitle}>Ready to Join?</h2>
            <p style={styles.ctaSubtitle}>
              {stay.slotsAvailable} slots remaining
            </p>
            <Link 
              href={`/stay/${stay.stayId}/apply`} 
              style={styles.applyButton}
            >
              Apply Now →
            </Link>
            <p style={styles.ctaNote}>
              💡 Applications are reviewed within 24-48 hours
            </p>
          </>
        ) : (
          // Sold out or applications closed
          <div style={styles.soldOut}>
            <h2>😔 Applications Closed</h2>
            <p>This stay is no longer accepting applications.</p>
          </div>
        )}
      </section>
    </main>
  );
}

const styles = {
  main: {
    fontFamily: 'Arial, sans-serif',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
  },
  hero: {
    marginBottom: '40px',
  },
  imageGallery: {
    marginBottom: '20px',
  },
  mainImage: {
    width: '100%',
    height: '500px',
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '10px',
  },
  thumbnailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '10px',
  },
  thumbnail: {
    height: '150px',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  moreImages: {
    height: '150px',
    borderRadius: '8px',
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    fontWeight: '600',
    color: '#666',
  },
  imagePlaceholder: {
    width: '100%',
    height: '400px',
    backgroundColor: '#e0e0e0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    color: '#666',
    borderRadius: '12px',
  },
  heroContent: {
    textAlign: 'center' as const,
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    marginBottom: '10px',
  },
  location: {
    fontSize: '1.2rem',
    color: '#666',
    marginBottom: '10px',
  },
  dateRange: {
    fontSize: '1rem',
    color: '#888',
  },
  infoSection: {
    margin: '40px 0',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
  },
  infoCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    textAlign: 'center' as const,
  },
  infoIcon: {
    fontSize: '2rem',
    marginBottom: '10px',
  },
  infoLabel: {
    fontSize: '0.9rem',
    color: '#666',
    marginBottom: '5px',
  },
  infoValue: {
    fontSize: '1.3rem',
    fontWeight: 'bold',
    color: '#333',
  },
  detailsSection: {
    margin: '40px 0',
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '10px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    fontSize: '2rem',
    fontWeight: 'bold',
    marginBottom: '20px',
  },
  subsectionTitle: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    marginTop: '30px',
    marginBottom: '15px',
  },
  description: {
    fontSize: '1.1rem',
    lineHeight: '1.6',
    color: '#555',
    marginBottom: '20px',
    whiteSpace: 'pre-line' as const,
  },
  amenitiesList: {
    listStyle: 'none',
    padding: 0,
    fontSize: '1.1rem',
    lineHeight: '2',
  },
  roomsSection: {
    margin: '40px 0',
  },
  roomGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
  },
  roomCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  roomImageContainer: {
    width: '100%',
    height: '200px',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '15px',
  },
  roomImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  roomImagePlaceholder: {
    width: '100%',
    height: '200px',
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '3rem',
    borderRadius: '8px',
    marginBottom: '15px',
  },
  roomName: {
    fontSize: '1.3rem',
    fontWeight: 'bold',
    marginBottom: '10px',
  },
  roomDescription: {
    fontSize: '0.95rem',
    color: '#666',
    marginBottom: '12px',
    lineHeight: '1.5',
  },
  roomMeta: {
    fontSize: '0.9rem',
    color: '#888',
    marginBottom: '10px',
  },
  roomAmenities: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
    marginBottom: '12px',
  },
  roomAmenityTag: {
    fontSize: '0.75rem',
    padding: '4px 8px',
    backgroundColor: '#f0f0f0',
    borderRadius: '4px',
    color: '#555',
  },
  roomPrice: {
    fontSize: '1.4rem',
    fontWeight: 'bold',
    color: '#0070f3',
    marginTop: '10px',
  },
  faqSection: {
    margin: '40px 0',
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '10px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  faqItem: {
    marginBottom: '25px',
    paddingBottom: '25px',
    borderBottom: '1px solid #eee',
  },
  ctaSection: {
    textAlign: 'center' as const,
    margin: '60px 0',
    padding: '40px',
    backgroundColor: '#f0f8ff',
    borderRadius: '12px',
  },
  ctaTitle: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    marginBottom: '10px',
  },
  ctaSubtitle: {
    fontSize: '1.2rem',
    color: '#666',
    marginBottom: '30px',
  },
  applyButton: {
    display: 'inline-block',
    padding: '16px 48px',
    fontSize: '1.2rem',
    fontWeight: '600',
    color: 'white',
    backgroundColor: '#0070f3',
    textDecoration: 'none',
    borderRadius: '8px',
    transition: 'background-color 0.2s',
  },
  paymentButton: {
    display: 'inline-block',
    marginTop: '20px',
    padding: '14px 32px',
    backgroundColor: '#10b981',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '8px',
    fontWeight: '600',
  },
  dashboardButton: {
    display: 'inline-block',
    marginTop: '20px',
    padding: '14px 32px',
    backgroundColor: '#6366f1',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '8px',
    fontWeight: '600',
  },
  ctaNote: {
    marginTop: '20px',
    fontSize: '0.95rem',
    color: '#666',
  },
  soldOut: {
    padding: '40px',
  },
  alreadyApplied: {
    padding: '40px',
    backgroundColor: 'white',
    borderRadius: '12px',
  },
} as const;
