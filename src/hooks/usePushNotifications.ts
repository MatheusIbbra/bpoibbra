import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && !!VAPID_PUBLIC_KEY;
    setIsSupported(supported);

    if (supported && user) {
      checkSubscription();
    }
  }, [user]);

  const checkSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager?.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {
      setIsSubscribed(false);
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!user || !isSupported) return false;
    setIsLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const { error } = await (supabase as any).from("push_subscriptions").upsert(
        {
          user_id: user.id,
          subscription_json: subscription.toJSON(),
        },
        { onConflict: "user_id" }
      );

      if (error) throw error;

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("[Push] Subscribe error:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!user) return false;
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager?.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      await (supabase as any).from("push_subscriptions").delete().eq("user_id", user.id);

      setIsSubscribed(false);
      return true;
    } catch (err) {
      console.error("[Push] Unsubscribe error:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return { isSupported, isSubscribed, isLoading, subscribe, unsubscribe };
}
