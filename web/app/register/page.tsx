"use client";
import Link from "next/link";
import Footer from "../../components/Footer";
import { useRouter } from "next/navigation";
import {
  pageContainerNoNav,
  centeredContentContainer,
  form,
  input,
  button,
  link,
} from "@/styles/constants";

export default function Register() {
  const router = useRouter();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/home");
  };

  return (
    <div style={pageContainerNoNav}>
      <div style={centeredContentContainer}>
        <h1>Registrera</h1>
        <form onSubmit={handleRegister} style={form}>
          <div>
            <input type="text" placeholder="Användarnamn" style={input} />
          </div>
          <div>
            <input type="password" placeholder="Lösenord" style={input} />
          </div>
          <button type="submit" style={button}>
            Registrera
          </button>
        </form>
        <Link href="/login" style={link}>
          Tillbaka
        </Link>
      </div>
      <Footer />
    </div>
  );
}
