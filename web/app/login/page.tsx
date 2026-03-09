"use client";
import { useRouter } from "next/navigation";
import Footer from "../../components/Footer";
import { useState } from "react";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
//import { useFormState } from "react-dom";
import {
  pageContainerNoNav,
  centeredContentContainer,
  form,
  input,
  button,
} from "@/styles/constants";

export default function Login() {
  const router = useRouter();
  const [name, setName] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (name == "admin") {
      router.push("/home");
    }
    //router.push("/home");
  };

  return (
    <div style={pageContainerNoNav}>
      <div style={centeredContentContainer}>
        <h1>Login</h1>
        <form onSubmit={handleLogin} style={form}>
          <div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              placeholder="Användarnamn"
              style={input}
            />
          </div>
          <div>
            <input type="password" placeholder="Lösenord" style={input} />
          </div>
          <button type="submit" style={button}>
            Logga in
          </button>
        </form>
      </div>
      <Footer />
    </div>
  );
}
