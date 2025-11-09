"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stay {
  id: string;
  stayId: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  isPublished: boolean;
  isFeatured: boolean;
  slotsAvailable: number;
  slotsTotal: number;
  priceUSDC: number;
}

export default function AdminStaysPage() {
  const [stays, setStays] = useState<Stay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStays();
  }, []);

  const fetchStays = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/stays");
      if (!response.ok) throw new Error("Failed to fetch stays");
      const data = await response.json();
      setStays(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const togglePublished = async (stayId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/stays/${stayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !currentStatus }),
      });

      if (!response.ok) throw new Error("Failed to update stay");
      
      // Refresh the list
      fetchStays();
    } catch (err) {
      alert("Error updating stay: " + (err as Error).message);
    }
  };

  const deleteStay = async (stayId: string, stayTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${stayTitle}"?`)) return;

    try {
      const response = await fetch(`/api/admin/stays/${stayId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete stay");
      }

      // Refresh the list
      fetchStays();
    } catch (err) {
      alert("Error deleting stay: " + (err as Error).message);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Manage Stays</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Manage Stays</h1>
        <p style={styles.error}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Manage Stays</h1>
        <Link href="/admin/stays/create" style={styles.createButton}>
          + Create New Stay
        </Link>
      </div>

      {stays.length === 0 ? (
        <div style={styles.emptyState}>
          <p>No stays found.</p>
          <Link href="/admin/stays/create" style={styles.createButton}>
            Create Your First Stay
          </Link>
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Stay ID</th>
                <th style={styles.th}>Title</th>
                <th style={styles.th}>Location</th>
                <th style={styles.th}>Dates</th>
                <th style={styles.th}>Slots</th>
                <th style={styles.th}>Price</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stays.map((stay) => (
                <tr key={stay.id} style={styles.tr}>
                  <td style={styles.td}>{stay.stayId}</td>
                  <td style={styles.td}>
                    <strong>{stay.title}</strong>
                    {stay.isFeatured && (
                      <span style={styles.badge}>Featured</span>
                    )}
                  </td>
                  <td style={styles.td}>{stay.location}</td>
                  <td style={styles.td}>
                    {new Date(stay.startDate).toLocaleDateString()} -{" "}
                    {new Date(stay.endDate).toLocaleDateString()}
                  </td>
                  <td style={styles.td}>
                    {stay.slotsAvailable} / {stay.slotsTotal}
                  </td>
                  <td style={styles.td}>${stay.priceUSDC}</td>
                  <td style={styles.td}>
                    <button
                      onClick={() => togglePublished(stay.id, stay.isPublished)}
                      style={{
                        ...styles.statusButton,
                        ...(stay.isPublished
                          ? styles.publishedButton
                          : styles.draftButton),
                      }}
                    >
                      {stay.isPublished ? "Published" : "Draft"}
                    </button>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <Link
                        href={`/admin/stays/${stay.id}`}
                        style={styles.editButton}
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => deleteStay(stay.id, stay.title)}
                        style={styles.deleteButton}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "1400px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "30px",
  },
  title: {
    fontSize: "2rem",
    fontWeight: "bold",
  },
  createButton: {
    padding: "12px 24px",
    backgroundColor: "#0070f3",
    color: "white",
    textDecoration: "none",
    borderRadius: "6px",
    fontWeight: "600",
    border: "none",
    cursor: "pointer",
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
    backgroundColor: "white",
    borderRadius: "8px",
  },
  tableContainer: {
    backgroundColor: "white",
    borderRadius: "8px",
    overflow: "auto",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "16px",
    borderBottom: "2px solid #eee",
    fontWeight: "600",
    color: "#333",
  },
  tr: {
    borderBottom: "1px solid #eee",
  },
  td: {
    padding: "16px",
    verticalAlign: "middle",
  },
  badge: {
    marginLeft: "8px",
    padding: "4px 8px",
    backgroundColor: "#ffd700",
    color: "#000",
    fontSize: "0.75rem",
    fontWeight: "600",
    borderRadius: "4px",
  },
  statusButton: {
    padding: "6px 12px",
    border: "none",
    borderRadius: "4px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "0.875rem",
  },
  publishedButton: {
    backgroundColor: "#10b981",
    color: "white",
  },
  draftButton: {
    backgroundColor: "#6b7280",
    color: "white",
  },
  actions: {
    display: "flex",
    gap: "8px",
  },
  editButton: {
    padding: "6px 12px",
    backgroundColor: "#3b82f6",
    color: "white",
    textDecoration: "none",
    borderRadius: "4px",
    fontSize: "0.875rem",
    fontWeight: "500",
  },
  deleteButton: {
    padding: "6px 12px",
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: "4px",
    fontSize: "0.875rem",
    fontWeight: "500",
    cursor: "pointer",
  },
  error: {
    color: "#ef4444",
    padding: "20px",
    backgroundColor: "#fee",
    borderRadius: "8px",
  },
} as const;