"use client";

import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import { pageContainer, contentWrapper, box } from "@/styles/constants";
import { useState } from "react";
import LineCard from "../../components/LineCard";
import Card from "../../components/Card";
import Bar from "../../components/Bar";


export default function Home() {
  // TODO: fix this class to be more accurate
  const STANDRD_FLM = 19.2;
  class Ekipage {
    private id: string;
    private line: string;
    private price: number;
    private capacity: number;
    private leveransstruktur: string;


    public constructor(id: string, line: string, price: number, capacity: number, leveransstruktur: string) {
      this.id = id;
      this.line = line;
      this.price = price;
      this.capacity = capacity;
      this.leveransstruktur = leveransstruktur;
    }

    public getId(): string {
      return this.id;
    }

    public getLine(): string {
      return this.line;
    }

    public getPrice(): number {
      return this.price;
    }
    
    public getCapacity(): number {
      return this.capacity;
    }

  }
  // useState for information tab
  const [clickedButton, setClickedButton] = useState<Ekipage | null>(null);
  // useState for manual price input
  const [manualValue, setManualValue] = useState(15000);
  const [value, setValue] = useState("");

  // functions 
  function convertCapacityToPixels(capacity: number) {
    return (capacity/STANDRD_FLM * 100)
  }

  function convertProfitToPixels(price: number) {
    if (price < manualValue) {
      return (price/manualValue * 100);
    } else {
      return 100;
    }
    
  }

  // list over lines 
  const linje1: Ekipage[] = [];
  const linje2: Ekipage[] = [];
  const linje3: Ekipage[] = [];

  // TODO: implement getting data from iLog
  const Ekipage1 = new Ekipage("L20", "Linköping -> Stockholm", 12000, 12.4, "null");
  const Ekipage2 = new Ekipage("L21", "Linköping -> Stockholm", 13000, 19.2, "null");
  const Ekipage3 = new Ekipage("L22", "Linköping -> Stockholm", 18500, 19.2, "null");
  const Ekipage4 = new Ekipage("L23", "Linköping -> Malmö", 22300, 6.1, "null");
  const Ekipage5 = new Ekipage("L24", "Linköping -> Malmö", 9800, 15.6, "null");
  const Ekipage6 = new Ekipage("L25", "Linköping -> Malmö", 14200, 5.3, "null");
  const Ekipage7 = new Ekipage("L26", "Linköping -> Jönköping", 7600, 10.9, "null");
  const Ekipage8 = new Ekipage("L27", "Linköping -> Jönköping", 5400, 8.2, "null");
  const Ekipage9 = new Ekipage("L28", "Linköping -> Jönköping", 19900, 5.4, "null");
  const Ekipage10 = new Ekipage("L29", "Linköping -> Jönköping", 11700, 15.8, "null");

  // adding data to lines
  linje1.push(Ekipage1);
  linje1.push(Ekipage2);
  linje1.push(Ekipage3);
  linje2.push(Ekipage4);
  linje2.push(Ekipage5);
  linje2.push(Ekipage6);
  linje3.push(Ekipage7);
  linje3.push(Ekipage8);
  linje3.push(Ekipage9);
  linje3.push(Ekipage10);

  // adding line array
  const lines: Array<Ekipage>[] = [];
  lines.push(linje1);
  lines.push(linje2);
  lines.push(linje3);


  return (
    <div style={pageContainer}>
      <Navigation currentPage="home" />
        <div>
          <br></br>
          {lines.map((line) => (
            <LineCard key={line[0].getId()} title={line[0].getLine()}>
              <div style={{ display: "flex", gap: "10px" }}>
                {line.map((ekipage) => (
                  <Card key={ekipage.getId()} title={ekipage.getId()} capacity={convertCapacityToPixels(ekipage.getCapacity())} price={convertProfitToPixels(ekipage.getPrice())}>
                    <button key={ekipage.getId()} onClick={() => setClickedButton(ekipage)}>
                      <p style={{background: "#5f6599"}}>Info</p>
                    </button>
                  </Card>
                ))}
              </div>
            </LineCard>
          ))}

          
          
          {clickedButton && (
            <>
              <p>
                You clicked: <strong>{clickedButton.getId()}</strong>
              </p>
              <p>
                Route: <strong>{clickedButton.getLine()}</strong>
                <br></br>
                Price: <strong>{clickedButton.getPrice()}</strong>
                <br></br>
                FLM: <strong>{clickedButton.getCapacity()}</strong>
                <br></br>
              </p>
            </>
          )}
          <p>Manellt värde:{manualValue}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setManualValue(Number(value));
            }}
          >
            <input onChange={(e) => setValue(e.target.value)} />
            <button type="submit">Submit</button>
          </form>
        </div>

      <Footer></Footer>
    </div>
  );
}