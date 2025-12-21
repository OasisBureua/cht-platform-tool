import { Link } from 'react-router-dom';
import { User, LayoutDashboard, GraduationCap, CreditCard } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="text-2xl font-bold text-primary-600">
                CHT Platform
              </Link>
            </div>
            
            {/* Navigation */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                to="/"
                className="inline-flex items-center px-1 pt-1 border-b-2 border-primary-500 text-sm font-medium text-gray-900"
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Link>
              <Link
                to="/programs"
                className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
              >
                <GraduationCap className="w-4 h-4 mr-2" />
                Programs
              </Link>
              <Link
                to="/payments"
                className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Payments
              </Link>
            </div>
          </div>
          
          {/* User menu */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <button className="p-2 rounded-full text-gray-400 hover:text-gray-500">
              <User className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
