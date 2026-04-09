"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  `relative h-full flex items-center px-4 py-4 font-bold transition-colors duration-200 ${
    isActive
      ? "after:content-[''] after:absolute after:left-0 after:bottom-0 after:w-full after:h-[2px] after:bg-[var(--text-primary)]"
      : "text-[var(--text-heading)] hover:bg-[var(--text-primary)]/10"
  }`;

  return (
    <nav className="bg-[var(--navbar)] text-[var(--text-primary)] shadow-sm">
      <div className="max-w-8xl mx-auto px-2 sm:px-2 lg:px-6">
        <div className="flex items-center justify-between h-14">
          {/* LEFT SIDE */}
          <div className="flex-1 flex items-center justify-start space-x-4">
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

          {/* RIGHT SIDE */}
          <div className="flex-1 flex items-center justify-end space-x-4">
            <Link
              href="/notifications"
              className={getLinkClasses(currentPage === "notifications")}
            >
              Notifikationer
            </Link>
            <Link
              href="/settings"
              className={getLinkClasses(currentPage === "settings")}
            >
              Mitt Konto
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-[#FFFFFF]/100 text-black font-bold cursor-pointer border-1 border-[#C0C0C0] rounded-md hover:bg-black/10 transition-colors duration-150 shadow-md"            >
              Logga ut
            </button>
          </div>

        </div>
      </div>
    </nav>
  );
}