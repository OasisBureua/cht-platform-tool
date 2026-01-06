import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import AppWelcomeBanner from '../app/AppWelcomeBanner';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* App transition banner */}
        <AppWelcomeBanner />

        <Outlet />
      </main>
    </div>
  );
}
