"use client"
import { useEffect, useState } from "react";
import Navigation from "../../components/Navigation";
import Link from "next/link";
import Footer from "../../components/Footer";
import { getCurrentlySignedInUser } from "@/lib/api";
import {
  pageContainer,
  contentWrapper,
  box,
  button,
  buttonDisabled,
  link,
} from "@/styles/constants";
import type { User } from "@/lib/databaseTypes";

export default function Account() {

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {

      // Get currently logged in user
      const signedInUser = await getCurrentlySignedInUser();

      if (!signedInUser.status || !signedInUser.data) {
        console.log("Couldn't get currently signed in user:", signedInUser.message);
      } else {
        setUser(signedInUser.data);
      }

      setLoading(false);
    }

    fetchUser();
  }, []);

  if (loading) {
    return (
      <div style={pageContainer}>
        <Navigation currentPage="account" />
        <div style={contentWrapper}>
          <h1>Mitt konto</h1>
          <p>Laddar användarinformation...</p>
        </div>
        <Footer />
      </div>
    );
  }



  return (
    <div style={pageContainer}>
      <Navigation currentPage="account" />
      <div style={contentWrapper}>
        <h1>Mitt konto</h1>
        <p>
          Här kan du se och uppdatera din kontoinformation och personliga
          inställningar för trafikledarsystemet.
        </p>
        <div style={box}>
          <h3>Kontoinformation</h3>
          <p>E-post: {user?.email ?? "—"}</p>
          <p>Tröskelvärde: {user?.threshold ?? "—"}</p>
          <p>Användartyp: {user?.role ?? "—"}</p>
          <p>Filter: {JSON.stringify(user?.filters) ?? "—"}</p>
          <button disabled style={{ ...buttonDisabled, marginTop: "10px" }}>
            Redigera profil
          </button>
        </div>
        <div style={{ marginTop: "30px", textAlign: "center" }}>
          <Link href="/home" style={{ ...link, marginTop: 0, cursor: "pointer" }}>
            Hem
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
