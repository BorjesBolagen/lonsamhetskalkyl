"use client";

import { useState, useEffect, useCallback } from "react";
import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";
import { getMessages, deleteMessage, getAmountOfPages, getCurrentlySignedInUser } from "../../lib/api";

type Notification = {
  id: number;
  body: string;
  created_at: string;
  created_by: string | null;
};

const PAGE_SIZE = 6;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Kolla om inloggad användare är admin
  useEffect(() => {
    getCurrentlySignedInUser()
      .then((res) => setIsAdmin(res.data?.role === "admin"))
      .catch(console.error);
  }, []);

  const loadTotalPages = useCallback(async (): Promise<number> => {
    const res = await getAmountOfPages(PAGE_SIZE);
    const total = Math.max(1, Number(res.data));
    setTotalPages(total);
    return total;
  }, []);

  const loadNotifications = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const res = await getMessages(page, PAGE_SIZE);
      setNotifications(res.messages);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTotalPages(); }, [loadTotalPages]);
  useEffect(() => { loadNotifications(currentPage); }, [currentPage, loadNotifications]);

  const removeNotification = async (id: number) => {
    try {
      await deleteMessage(id);
      const newTotal = await loadTotalPages();
      const targetPage = currentPage > newTotal ? Math.max(1, newTotal) : currentPage;
      if (targetPage !== currentPage) {
        setCurrentPage(targetPage);
      } else {
        await loadNotifications(targetPage);
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setConfirmId(null);
    }
  };

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <Navigation currentPage="notifications" />

      <main className="flex-grow flex justify-center p-6">
        <div className="bg-[var(--primary-element)] max-w-4xl w-full rounded-xl shadow-md p-8 flex flex-col">

          {/* Header */}
          <h1 className="flex-shrink-0 text-3xl text-[var(--text-heading)] font-bold text-center mb-6 border-b-2 pb-2">
            Notifikationer
          </h1>

          {/* List */}
          <div className="flex-1">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <div key={i} className="h-[68px] rounded-lg bg-gray-200 animate-pulse" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-center text-[var(--text-primary)] py-16 text-sm">
                Inga notifikationer att visa.
              </p>
            ) : (
              <ul className="space-y-2">
                {notifications.map((note) => (
                  <li
                    key={note.id}
                    className="group flex items-center justify-between gap-4 px-5 py-4 rounded-lg
                      bg-[var(--secondary-element)]
                      border border-transparent
                      hover:border-[var(--button-submit-hover)]"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[var(--text-heading)] leading-snug">
                          {note.body}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          {new Date(note.created_at).toLocaleString("sv-SE", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {note.created_by && (
                            <span className="ml-2 text-[var(--text-secondary)]">
                              · {note.created_by}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Endast synlig för admins */}
                    {isAdmin && (
                      <button
                        onClick={() => setConfirmId(note.id)}
                        title="Ta bort"
                        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-md
                          text-gray-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20
                          opacity-0 group-hover:opacity-100"
                      >
                        <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                          <path
                            d="M1 3.5h12M5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M5.5 6.5v4M8.5 6.5v4M2.5 3.5l.8 8a.5.5 0 00.5.5h6.4a.5.5 0 00.5-.5l.8-8"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Pagination */}
          <div className="mt-auto flex justify-center items-center gap-1 pt-6">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="w-8 h-8 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100
                dark:hover:text-gray-200 dark:hover:bg-gray-800
                disabled:opacity-30 disabled:pointer-events-none"
            >
              ‹
            </button>
            {pages.map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-md text-sm font-medium
                  ${page === currentPage
                    ? "bg-green-700 text-white"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
                  }`}
              >
                {page}
              </button>
            ))}
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="w-8 h-8 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100
                dark:hover:text-gray-200 dark:hover:bg-gray-800
                disabled:opacity-30 disabled:pointer-events-none"
            >
              ›
            </button>
          </div>

        </div>
      </main>

      <Footer />

      {/* Delete confirmation modal — bara admins kan nå hit */}
      {isAdmin && confirmId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConfirmId(null)}
        >
          <div
            className="bg-[var(--primary-element)] rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Ta bort meddelande?
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Detta tar bort meddelandet för alla på systemet.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmId(null)}
                className="px-4 py-2 text-sm rounded-lg text-white
                  bg-[var(--button-reset)] hover:bg-[var(--button-reset-hover)]"
              >
                Avbryt
              </button>
              <button
                onClick={() => removeNotification(confirmId)}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Ta bort
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
