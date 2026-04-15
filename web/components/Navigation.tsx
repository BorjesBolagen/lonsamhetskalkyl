"use client";
import Link from "next/link";
import GuardedLink from "./GuardedLink";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

interface NavigationProps {
  currentPage?: string;
  hasUnsavedChanges?: boolean;
}

export default function Navigation({ currentPage, hasUnsavedChanges = false }: NavigationProps) {
  const router = useRouter();

  const confirmNavigation = () => {
    if (!hasUnsavedChanges) return true;

    return confirm(
      "Du har osparade ändringar. Vill du verkligen lämna sidan?"
    );
  };


  const handleLogout = async () => {
    if (hasUnsavedChanges) {
      const ok = confirm(
        "Du har osparade ändringar. Vill du verkligen logga ut?"
      );
      if (!ok) return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      console.log("User signed out successfully");
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const getLinkClasses = (isActive: boolean) =>
    `relative h-full flex items-center px-4 py-4 font-bold transition-colors duration-200 ${isActive
      ? "after:content-[''] after:absolute after:left-0 after:bottom-0 after:w-full after:h-[2px] after:bg-[var(--text-primary)]"
      : "text-[var(--text-heading)] hover:bg-[var(--text-primary)]/10"
    }`;

  return (
    <nav className="bg-[var(--navbar)] text-[var(--text-primary)] shadow-sm">
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

            <GuardedLink
              href="/admin"
              className={getLinkClasses(currentPage === "admin")}
              hasUnsavedChanges={hasUnsavedChanges}
            >
              Admin
            </GuardedLink>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex-1 flex items-center justify-end space-x-4">
            <GuardedLink
              href="/notifications"
              className={getLinkClasses(currentPage === "notifications")}
              hasUnsavedChanges={hasUnsavedChanges}
            >
              Notifikationer
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
              className="px-4 py-2 bg-[var(--text-primary)]/1000 text-[var(--text-primary)] font-bold cursor-pointer border-1 border-[#C0C0C0] rounded-md hover:bg-[var(--text-primary)]/10 transition-colors duration-150 shadow-md"            >
              Logga ut
            </button>
          </div>

        </div>
      </div>
    </nav>
  );
}