import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import { pageContainer, contentWrapper, box } from "@/styles/constants";

export default function Home() {
  return (
    <div style={pageContainer}>
      <Navigation currentPage="home" />
      <div style={contentWrapper}>
        <h1>Översikt</h1>
        <p>
          Här kan trafikledaren för området få en överblick över alla nuvarande
          leveranser och den totala statusen för transportnätverket i Linköping.
        </p>
        <h2>Nuvarande leveranser i området</h2>
        <div style={box}>
          <p>Totala leveranser: 12</p>
          <p>Pågående leveranser: 7</p>
          <p>Genomförda idag: 5</p>
          <p>Bilar i drift: 4</p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
