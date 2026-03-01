import Navigation from "../../components/Navigation";
import Link from "next/link";
import Footer from "../../components/Footer";
import {
  pageContainer,
  contentWrapper,
  box,
  button,
  buttonDisabled,
  link,
} from "@/styles/constants";

export default function Account() {
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
          <p>Användarnamn: trafikledare_001</p>
          <p>E-post: trafikledare@linköping.se</p>
          <p>Område: Linköping</p>
          <p>Användartyp: Trafikledare</p>
          <button disabled style={{ ...buttonDisabled, marginTop: "10px" }}>
            Redigera profil
          </button>
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
