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

const getLinkStyle = (isActive: boolean) => ({
  ...button,
  ...(isActive ? { backgroundColor: "black", color: "white" } : {}),
});

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

  return (
    <nav style={navContainer}>
      <div style={navFlex}>
        {/* Vänster hörn - Inställningar och Område */}
        <div style={navGroup}>
          <Link
            href="/settings"
            style={getLinkStyle(currentPage === "settings")}
          >
            Inställningar
          </Link>
          <span style={{ color: "black" }}>Område: Linköping</span>
        </div>

        {/* Mitten - Huvudnavigation */}
        <div style={navCenter}>
          <Link href="/home" style={getLinkStyle(currentPage === "home")}>
            Översikt
          </Link>
          <Link
            href="/simulator"
            style={getLinkStyle(currentPage === "simulator")}
          >
            Simulator
          </Link>
          <Link href="/admin" style={getLinkStyle(currentPage === "admin")}>
            Admin
          </Link>
        </div>

        {/* Höger hörn - Konto och Logga ut */}
        <div style={navRight}>
          <Link href="/account" style={getLinkStyle(currentPage === "account")}>
            Konto
          </Link>
          <button onClick={handleLogout} style={button}>
            Logga ut
          </button>
        </div>
      </div>
    </nav>
  );
}
