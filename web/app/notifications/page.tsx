"use client";

import { useState, useEffect } from "react";
import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import { getMessages, getAmountOfUnreadMessages, deleteMessage, getAmountOfPages } from "../../lib/api";

type Notification = {
  id: number;
  body: string;
  created_at: string;
  created_by: string | null;
};

export default function NotificationsPage() {
  const pageSize = 5;


  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);




  useEffect(() => {
    const loadTotalPages = async () => {
      try {
        const res = await getAmountOfPages(pageSize);
        setTotalPages(Number(res.data)); // FULT tydlgien
      } catch (error) {
        console.error(error);
      }
    };

    loadTotalPages();
  }, [pageSize]);

  useEffect(() => {
    const loadNotifications = async () => {
      setLoading(true);
      try {
        const res = await getMessages(currentPage, pageSize);
        setNotifications(res.messages);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [currentPage, pageSize]);

  const removeNotification = async (messageId: number) => {
    try {
      await deleteMessage(messageId);

      setNotifications(prev =>
        prev.filter(note => note.id !== messageId)
      );

      // Om sidan blir tom → gå tillbaka
      if (notifications.length === 1 && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (

    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <Navigation currentPage="notifications" />

      <main className="flex-grow flex justify-center p-6">
        <div className="bg-[var(--primary-element)] max-w-4xl w-full rounded-xl shadow-md p-8 space-y-6">

          <h1 className="text-3xl font-bold text-center mb-6 border-b-2 border-green-700 pb-2">
            🔔 Notifikationer
          </h1>

          {/* Lista */}
          {loading ? (
            <p className="text-center">Laddar...</p>
          ) : (
            <ul className="space-y-4">
              {notifications.map(note => (
                <li
                  key={note.id}
                  className="p-4 bg-[var(--notification-color)] rounded-lg flex justify-between items-center"
                >
                  <div>
                    <p>{note.body}</p>
                    <small className="opacity-70">
                      {new Date(note.created_at).toLocaleString()}
                    </small>
                  </div>

                  <button
                    onClick={() => removeNotification(note.id)}
                    className="text-sm px-3 py-1 rounded hover:bg-gray-600"
                  >
                    🗑️
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Pagination */}
          <div className="flex justify-center items-center gap-2 flex-wrap mt-6">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="px-3 py-1 rounded bg-gray-700 disabled:opacity-50"
            >
              ‹
            </button>

            {pages.map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 rounded ${page === currentPage
                  ? "bg-green-700 font-bold"
                  : "bg-gray-700 hover:bg-gray-600"
                  }`}
              >
                {page}
              </button>
            ))}

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-3 py-1 rounded bg-gray-700 disabled:opacity-50"
            >
              ›
            </button>
          </div>
        </div>
      </main>


      <Footer />
    </div>
  );
}