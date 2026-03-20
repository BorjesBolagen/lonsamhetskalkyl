import { ReactNode } from "react";

type CardProps = {
  title: string;
  children: ReactNode;
};

export default function LineCard({ title, children }: CardProps) {
  return (
    <div
      style={{
        width: "600px",
        border: "5px solid #1da06e",
        borderRadius: "12px",
        padding: "16px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
        background: "white",
      }}
    >
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  );
}