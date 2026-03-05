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
    router.push("/login");
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
