"use client";

import Link from 'next/link';
import { usePathname, redirect } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react'; // Import useSession and signOut
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Settings, 
  LogOut,
  Menu,
  X,
  Gift,
  Loader2, // A good icon for loading
} from 'lucide-react';
import { useState } from 'react';

// --- A simple loading component ---
function AdminLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      <p className="mt-4 text-lg text-gray-700">Verifying access...</p>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // --- 1. Get Session & Status ---
  const { data: session, status } = useSession();

  // --- 2. Handle Loading State ---
  // While 'status' is "loading", show a spinner
  if (status === "loading") {
    return <AdminLoading />;
  }

  // --- 3. Handle Unauthenticated State ---
  // If not logged in, redirect to sign-in page.
  // Middleware should catch this first, but this is a good fallback.
  if (status === "unauthenticated") {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`);
    return <AdminLoading />; // Show loading while redirecting
  }

  // --- 4. Handle Authenticated but NOT Admin ---
  // If the user is logged in but their role is not 'ADMIN', redirect them.
  if (session?.user?.userRole !== "ADMIN") {
    // Redirect to a 403 Forbidden page or the main dashboard
    redirect('/?error=forbidden'); // Redirect to home page with an error
    return <AdminLoading />; // Show loading while redirecting
  }
  
  // --- 5. User is an ADMIN: Render the layout ---
  // If status is "authenticated" AND userRole is "ADMIN", show the layout.
  const navigation = [
    { 
      name: 'Bookings', 
      href: '/admin/bookings', 
      icon: LayoutDashboard,
      description: 'Manage applications and payments'
    },
    { 
      name: 'Stays', 
      href: '/admin/stays', 
      icon: Calendar,
      description: 'Manage events and accommodations'
    },
    { 
      name: 'Referrals', 
      href: '/admin/referrals', 
      icon: Gift,
      description: 'Community referral codes'
    },
    { 
      name: 'Users', 
      href: '/admin/users', 
      icon: Users,
      description: 'View and manage users'
    },
    { 
      name: 'Settings', 
      href: '/admin/settings', 
      icon: Settings,
      description: 'System configuration'
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-gray-900 text-white
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
              <h2 className="text-xl font-bold">Admin Panel</h2>
              <p className="text-xs text-gray-400 mt-1">DeDen Management</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-start gap-3 px-4 py-3 rounded-lg
                    transition-all duration-200
                    ${isActive 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }
                  `}
                >
                  <Icon size={20} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs opacity-75 mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-800">
            {/* ✅ UPDATED: Added onClick to sign out */}
            <button 
              onClick={() => signOut({ callbackUrl: '/' })} // Sign out and redirect to home
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
            >
              <LogOut size={20} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 lg:hidden">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-600 hover:text-gray-900"
            >
              <Menu size={24} />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}