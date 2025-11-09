import { redirect } from 'next/navigation';

// This component will not be rendered.
// It tells Next.js to immediately send the user to a different page.
export default function AdminRootPage() {
  // When a user visits /admin, redirect them to /admin/bookings
  redirect('/admin/bookings');
}