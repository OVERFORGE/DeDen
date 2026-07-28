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
  Loader2,
  History,
  QrCode,
} from 'lucide-react';
import { useState } from 'react';

// --- A simple loading component ---
function AdminLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f7eedb]">
      <div className="w-12 h-12 border-4 border-[#2c331f]/20 border-t-[#2c331f] rounded-full animate-spin mb-4"></div>
      <p className="mt-4 text-[10px] font-bold text-[#2c331f] uppercase tracking-widest">Verifying access...</p>
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
      name: 'Check-In',
      href: '/admin/check-in',
      icon: QrCode,
      description: 'Scan tickets at the door'
    },
    {
      name: 'Referrals',
      href: '/admin/referrals',
      icon: Gift,
      description: 'Community referral codes'
    },
    {
      name: 'Activity',
      href: '/admin/activity',
      icon: History,
      description: 'Full audit log'
    },
    { 
      name: 'Past Events', 
      href: '/admin/past-events', 
      icon: History,
      description: 'Manage completed events and experiences'
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
    <div className="min-h-screen bg-[#f7eedb] flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-[#2c331f]/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-72 bg-[#2c331f] text-[#f7eedb] border-r-2 border-[#2c331f]
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b-2 border-[#2c331f] bg-[#9db47d]">
            <div>
              <h2 className="text-2xl font-black text-[#2c331f] font-display tracking-tight">Admin Panel</h2>
              <p className="text-[10px] font-bold text-[#2c331f] uppercase tracking-widest mt-1">DeDen Management</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-[#2c331f] hover:scale-110 transition-transform"
            >
              <X size={24} strokeWidth={3} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-5 space-y-3 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-start gap-3 px-4 py-3 rounded-xl border-2
                    transition-all duration-200 
                    ${isActive 
                      ? 'bg-[#f7eedb] text-[#2c331f] border-[#2c331f] shadow-[3px_3px_0px_0px_#9db47d]' 
                      : 'border-transparent text-[#f7eedb]/70 hover:bg-[#9db47d] hover:text-[#2c331f] hover:border-[#2c331f] hover:shadow-[3px_3px_0px_0px_#2c331f]'
                    }
                  `}
                >
                  <Icon size={20} strokeWidth={isActive ? 3 : 2} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm tracking-wide">{item.name}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${isActive ? 'text-[#5a6b3a]' : 'opacity-70'}`}>
                      {item.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-5 border-t-2 border-[#2c331f] bg-[#2c331f]">
            <button 
              onClick={() => signOut({ callbackUrl: '/' })} 
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#e8c37b] text-[#2c331f] rounded-xl border-2 border-[#2c331f] shadow-[3px_3px_0px_0px_#9db47d] hover:shadow-[0px_0px_0px_0px_#9db47d] hover:translate-y-1 hover:translate-x-1 transition-all font-bold uppercase tracking-widest text-xs"
            >
              <LogOut size={16} strokeWidth={3} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-[#f7eedb] border-b-2 border-[#2c331f] px-6 py-4 lg:hidden">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black text-[#2c331f] font-display tracking-tight">Admin Panel</h1>
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-[#2c331f] hover:scale-110 transition-transform"
            >
              <Menu size={28} strokeWidth={2.5} />
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