import { ReactNode } from "react";
import Bar from "../components/Bar"

type CardProps = {
  title: string;
  children: ReactNode;
  capacity: number;
  price: number;
};

export default function Card({ title, children, capacity, price }: CardProps) {

  return (
    <div
      style={{
        width: "120px",
        height: "170px",
        border: "3px solid #1f3d16",
        borderRadius: "12px",
        padding: "5px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
        background: "white",
      }}
    >
      <div style={{background: "green", textAlign: "center", borderRadius: "10px", marginBottom: "10px", fontFamily: "cursive"}}>{title}</div>

      <div style={{textAlign: "center"}}>FLM</div>
        <Bar progress={capacity}></Bar>
      <div style={{textAlign: "center"}}>Profit</div>
      <Bar progress={price}></Bar>
      <div>{children}</div>

    </div>
  );
}