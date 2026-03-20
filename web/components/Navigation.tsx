"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  navContainer,
  navFlex,
  navGroup,
  navCenter,
  navRight,
  button,
} from "@/styles/constants";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";


interface NavigationProps {
  currentPage?: string;
}

export default function Navigation({ currentPage }: NavigationProps) {
  const router = useRouter();

  const handleLogout = () => {

    try {
      const supabase = getSupabaseBrowserClient();
      supabase.auth.signOut();
      console.log("User signed out successfully");
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }

    
  };

  const getLinkClasses = (isActive: boolean) =>
    `px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
      isActive ? "bg-black text-white" : "text-white hover:bg-black/20"
    }`;

  return (
    <nav className="bg-[#307C44]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left corner */}
          <div className="flex items-center space-x-4">
            <Link
              href="/settings"
              className={getLinkClasses(currentPage === "settings")}
            >
              Inställningar
            </Link>
            <span className="text-white font-medium">Område: Linköping</span>
          </div>

          {/* Center navigation */}
          <div className="flex space-x-4">
            <Link
              href="/home"
              className={getLinkClasses(currentPage === "home")}
            >
              Översikt
            </Link>
            <Link
              href="/simulator"
              className={getLinkClasses(currentPage === "simulator")}
            >
              Simulator
            </Link>
            <Link
              href="/admin"
              className={getLinkClasses(currentPage === "admin")}
            >
              Admin
            </Link>
          </div>
          {/* Right corner */}
          <div className="flex items-center space-x-4">
            <Link
              href="/notifications"
              className={getLinkClasses(currentPage === "notifications")}
            >
              Notifikationer
            </Link>
          <div className="flex items-center space-x-4">
            <Link
              href="/account"
              className={getLinkClasses(currentPage === "account")}
            >
              Konto
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-white text-green-700 font-medium rounded-lg hover:bg-gray-100 transition-colors duration-200"
            >
              Logga ut
            </button>
          </div>
        </div>
      </div>
      </div>
    </nav>
  );
}