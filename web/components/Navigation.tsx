"use client";
import GuardedLink from "./GuardedLink";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { useEffect, useState } from "react";
import { getCurrentlySignedInUser } from "@/lib/api";
import { getAmountOfUnreadMessages } from "@/lib/api";

interface NavigationProps {
  currentPage?: string;
  hasUnsavedChanges?: boolean;
}

export default function Navigation({
  currentPage,
  hasUnsavedChanges = false,
}: NavigationProps) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  // Hämta antal olästa vid mount, nollställ när man är på notis-sidan
  useEffect(() => {
    if (currentPage === "notifications") {
      setUnreadCount(0);
      return;
    }

    // Hämta direkt + sedan var 30:e sekund
    const fetchUnread = () =>
      getAmountOfUnreadMessages()
        .then((res) => setUnreadCount(Number(res.data)))
        .catch(console.error);

    fetchUnread();
    const timer = setInterval(fetchUnread, 20_000);
    return () => clearInterval(timer);
  }, [currentPage]);


  const [userRole, setUserRole] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem("userRole");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (userRole) return;

    const fetchUserRole = async () => {
      try {
        const response = await getCurrentlySignedInUser();
        if (response.status && response.data) {
          setUserRole(response.data.role);
          if (response.data.role) {
            try {
              window.localStorage.setItem("userRole", response.data.role);
            } catch {
              // ignore storage errors
            }
          }
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      }
    };

    fetchUserRole();
  }, [userRole]);

  const handleLogout = async () => {
    if (hasUnsavedChanges) {
      const ok = confirm(
        "Du har osparade ändringar. Vill du verkligen logga ut?",
      );
      if (!ok) return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      try {
        window.localStorage.removeItem("userRole");
      } catch {
        // ignore storage errors
      }
      console.log("User signed out successfully");
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const getLinkClasses = (isActive: boolean) =>
    `relative h-full flex items-center px-4 py-4 font-bold transition-colors duration-500
   after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] after:w-full
   after:bg-[var(--text-primary)] after:origin-left after:transition-transform after:duration-300
   ${isActive ? "after:scale-x-100" : "after:scale-x-0"}
   ${!isActive ? "text-[var(--text-heading)] hover:bg-[var(--text-primary)]/10" : ""}`;

  return (
    <nav className="sticky top-0 z-[60] bg-[var(--navbar)] text-[var(--text-primary)] shadow-sm">
      <div className="max-w-8xl mx-auto px-2 sm:px-2 lg:px-6">
        <div className="flex items-center justify-between h-14">
          {/* LEFT SIDE */}
          <div className="flex-1 flex items-center justify-start space-x-4">
            <GuardedLink
              href="/home"
              className={getLinkClasses(currentPage === "home")}
              hasUnsavedChanges={hasUnsavedChanges}
            >
              Översikt
            </GuardedLink>

            <GuardedLink
              href="/simulator"
              className={getLinkClasses(currentPage === "simulator")}
              hasUnsavedChanges={hasUnsavedChanges}
            >
              Simulator
            </GuardedLink>

            {userRole === "admin" && (
              <GuardedLink
                href="/admin"
                className={getLinkClasses(currentPage === "admin")}
                hasUnsavedChanges={hasUnsavedChanges}
              >
                Admin
              </GuardedLink>
            )}
          </div>

          {/* RIGHT SIDE */}
          <div className="flex-1 flex items-center justify-end space-x-4">
            {/* Notifikationer med badge */}
            <GuardedLink
              href="/notifications"
              className={`${getLinkClasses(currentPage === "notifications")} gap-2`}
              hasUnsavedChanges={hasUnsavedChanges}
            >
              Notifikationer
              {unreadCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center leading-none">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </GuardedLink>

            <GuardedLink
              href="/settings"
              className={getLinkClasses(currentPage === "settings")}
              hasUnsavedChanges={hasUnsavedChanges}
            >
              Mitt Konto
            </GuardedLink>

            <button
              onClick={handleLogout}
              data-testid="logout-button"
              className="px-4 py-2 bg-[var(--text-primary)]/1000 text-[var(--text-primary)] font-bold cursor-pointer border-1 border-[#C0C0C0] rounded-md hover:bg-[var(--text-primary)]/10 transition-colors duration-150 shadow-md"
            >
              Logga ut
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
