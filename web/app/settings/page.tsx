import Navigation from "../../components/Navigation";
import Link from "next/link";
import Footer from "../../components/Footer";
import { pageContainer, contentWrapper, box, link } from "@/styles/constants";

export default function Settings() {
  return (
    <div style={pageContainer}>
      <Navigation currentPage="settings" />
      <div style={contentWrapper}>
        <h1>Inställningar</h1>
        <p>
          Här kan du anpassa systemets inställningar för ditt område och
          trafikledningspreferenser.
        </p>
        <div style={box}>
          <h3>Systeminställningar</h3>
          <div style={{ marginBottom: "15px" }}>
            <p>Meddela vid nya leveranser: Aktiverad</p>
          </div>
          <div style={{ marginBottom: "15px" }}>
            <p>Meddela vid uppdaterad status: Aktiverad</p>
          </div>
          <div style={{ marginBottom: "15px" }}>
            <p>Språk: Svenska</p>
          </div>
        </div>
        <div style={{ marginTop: "30px", textAlign: "center" }}>
          <Link
            href="/home"
            style={{ ...link, marginTop: 0, cursor: "pointer" }}
          >
            Hem
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
