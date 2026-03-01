import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import {
  pageContainer,
  contentWrapper,
  box,
  button,
  buttonDisabled,
} from "@/styles/constants";

export default function Simulator() {
  return (
    <div style={pageContainer}>
      <Navigation currentPage="simulator" />
      <div style={contentWrapper}>
        <h1>Simulator</h1>
        <p>
          Planera och optimera flera leveranser samtidigt. Simulera olika
          fordonssamansättningar och ruttkombinationer för att hitta den mest
          effektiva transporten över ditt område.
        </p>
        <div style={box}>
          <h3>Simuleringsverktyg</h3>
          <p>
            Här kan du planera flera leveranser och testa olika
            fordonsuppsättningar.
          </p>
          <button disabled style={{ ...buttonDisabled, marginRight: "10px" }}>
            Lägg till leverans
          </button>
          <button disabled style={buttonDisabled}>
            Simulera
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
