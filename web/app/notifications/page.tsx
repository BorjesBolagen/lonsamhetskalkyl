"use client";

import { useEffect, useState } from "react";
import Navigation from "../../components/Navigation";
import Footer from "../../components/Footer";

import {
  Tables,
} from "@/lib/supabaseServerSchema";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function NotificationsPage() {
  const sup = getSupabaseBrowserClient();


  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch notifications
  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await sup.auth.getUser();

    if (!user) return;

    // Fetch notifications the user has NOT read
    const { data, error } = await sup
      .from("notifications")
      .select(
        `
        id,
        title,
        body,
        created_at,
        notification_reads!left(user_id)
      `
      )
      .or(`notification_reads.user_id.is.null,notification_reads.user_id.neq.${user.id}`)
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Filter out notifications already read by this user
      const unread = data.filter(
        (n: any) =>
          !n.notification_reads?.some((r: any) => r.user_id === user.id)
      );

      setNotifications(unread);
    }

    setLoading(false);
  };

  // Mark notification as read
  const removeNotification = async (notificationId: string) => {
    const {
      data: { user },
    } = await sup.auth.getUser();

    if (!user) return;

    await sup.from("notification_reads").insert({
      notification_id: notificationId,
      user_id: user.id,
    });

    setNotifications((prev) =>
      prev.filter((n) => n.id !== notificationId)
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <Navigation currentPage="notifications" />

      <main className="flex-grow flex justify-center p-6">
        <div className="bg-[var(--primary-element)] max-w-4xl w-full rounded-xl shadow-md p-8 space-y-6">

          <h1 className="text-3xl font-bold text-center text-[var(--text-primary)] mb-6 border-b-2 border-green-700 pb-2 flex items-center justify-center space-x-2">
            <span>🔔</span>
            <span>Notifikationer</span>
          </h1>

          {loading ? (
            <p className="text-center text-gray-400">Laddar notifikationer...</p>
          ) : notifications.length === 0 ? (
            <p className="text-center text-gray-400">Inga nya notifikationer 🎉</p>
          ) : (
            <ul className="space-y-4 text-[var(--text-primary)]">
              {notifications.map((note) => (
                <li
                  key={note.id}
                  className="p-4 bg-[var(--notification-color)] rounded-lg shadow-sm flex justify-between items-start gap-4"
                >
                  <div>
                    <p className="font-semibold">{note.title}</p>
                    <p className="text-sm opacity-90">{note.body}</p>
                  </div>

                  <button
                    onClick={() => removeNotification(note.id)}
                    className="text-sm px-3 py-1 rounded hover:bg-gray-600"
                    title="Markera som läst"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}