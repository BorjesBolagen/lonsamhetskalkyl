"use client";

import { useState } from "react";
import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";

export default function ProfitCalculatorPage() {
  const [notifications, setNotifications] = useState([
    "Nytt meddelande från Admin",
    "Påminnelse: Uppdatera din profil",
    "Systemmeddelande: Underhåll planerat",
  ]);

  //Funktion för att ta bort en notis
  const removeNotification = (index: number) => {
    const updated = notifications.filter((_, i) => i !== index);
    setNotifications(updated);
  };
  return (
    <div className="min-h-screen flex flex-col bg-[#C6E2D8]">
      <Navigation currentPage="Notifikationer" />

      {/* Main content */}
      <main className="flex-grow flex flex-col lg:flex-row justify-center p-6 gap-8">
        {/* Info left*/}
      <div className="bg-[#E3F1EC] max-w-md w-full rounded-xl shadow-md p-6 space-y-4 self-start">
        <p className="text-gray-900">
          Här kan du se dina notifikationer och meddelanden.
        </p>
      </div>
        {/* Notifications right */}
        <div className="bg-white max-w-4xl w-full rounded-xl shadow-md p-8 space-y-6">
          {/* Title */}
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-6 border-b-2 border-green-700 pb-2 flex items-center justify-center space-x-2">
            <span>🔔</span>
            <span>Notifikationer</span>
          </h1>

          <ul className="space-y-4">
            {notifications.map((note, index) => (
               <li
                key={index}
                className="p-4 bg-green-50 rounded-lg shadow-sm flex justify-between items-center"
              >
              <span>{note}</span>
              {/* Remove button */}
              <button
                onClick={() => removeNotification(index)}
                className="text-sm text-white px-3 py-1 rounded hover:bg-gray-600"
              >
                🗑️
              </button>
            </li>
            ))}
          </ul>
          {/* Add other content here, like the form or boxes */}
        </div>
      </main>

      <Footer />
    </div>
  );
}