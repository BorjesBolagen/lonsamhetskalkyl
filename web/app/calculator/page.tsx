import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import {
  pageContainer,
  contentWrapper,
  box,
  input,
  button,
  buttonDisabled,
} from "@/styles/constants";

export default function Calculator() {
  return (
    <div style={pageContainer}>
      <Navigation currentPage="calculator" />
      <div style={contentWrapper}>
        <h1>Kalkylator</h1>
        <p>
          Beräkna lönsamheten för en enskild leverans mellan två platser. Du kan
          enkelt lägga till olika kolli och få en detaljerad kostnadsanalys.
        </p>
        <div style={box}>
          <h3>Beräkna leverans</h3>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>
              Från:
            </label>
            <input
              type="text"
              placeholder="Startplats"
              style={{ ...input, width: "100%", maxWidth: "300px" }}
            />
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>
              Till:
            </label>
            <input
              type="text"
              placeholder="Målplats"
              style={{ ...input, width: "100%", maxWidth: "300px" }}
            />
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>
              Antal kolli:
            </label>
            <input
              type="text"
              placeholder="0"
              style={{ ...input, width: "100%", maxWidth: "300px" }}
            />
          </div>
          <button disabled style={buttonDisabled}>
            Beräkna
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
