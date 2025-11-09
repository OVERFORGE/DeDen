import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={styles.layout}>
      <nav style={styles.sidebar}>
        <h2 style={styles.sidebarTitle}>Admin Panel</h2>
        <ul style={styles.navList}>
          <li>
            <Link href="/admin/bookings" style={styles.navLink}>
              Bookings
            </Link>
          </li>
          <li>
            <Link href="/admin/stays" style={styles.navLink}>
              Stays
            </Link>
          </li>
          {/* Add more links here (e.g., Users, Settings) */}
        </ul>
      </nav>
      <main style={styles.mainContent}>{children}</main>
    </div>
  );
}

const styles = {
  layout: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: 'Arial, sans-serif',
  },
  sidebar: {
    width: '240px',
    backgroundColor: '#111',
    color: 'white',
    padding: '20px',
  },
  sidebarTitle: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    marginBottom: '20px',
  },
  navList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  navLink: {
    display: 'block',
    padding: '10px 15px',
    color: '#ccc',
    textDecoration: 'none',
    borderRadius: '5px',
    marginBottom: '5px',
    transition: 'background-color 0.2s, color 0.2s',
  },
  mainContent: {
    flex: 1,
    padding: '40px',
    backgroundColor: '#f9f9f9',
  },
} as const;