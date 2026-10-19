// Set the notification handler at the top level
import type { Notification as ExpoNotification, NotificationResponse } from "expo-notifications";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";

// Minimal listener subscription type compatible with Expo's listener handle
type ListenerSubscription = { remove: () => void };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

import { useAuthStore } from "@/stores/authStore";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

export interface UsePushNotificationResult {
  expoPushToken: string | null;
  notification: ExpoNotification | null;
}


const usePushNotification = (): UsePushNotificationResult => {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<ExpoNotification | null>(null);
  const notificationListener = useRef<ListenerSubscription | null>(null);
  const responseListener = useRef<ListenerSubscription | null>(null);
  
  const setPushNotificationToken = useAuthStore((s) => s.setPushNotificationToken);

  useEffect(() => {
    // Do not register against the temporarily retained cloud project until configured.
    if (!process.env.EXPO_PUBLIC_BASE_URL) return;

    async function registerForPushNotificationsAsync(): Promise<string | null> {
      let token: string | null = null;
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#ffffff",
        });
      }
      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") {
          alert("Failed to get push token for push notification!");
          return null;
        }
        try {
          const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
          if (!projectId) {
            throw new Error("Project ID not found");
          }
          token = ( await Notifications.getExpoPushTokenAsync({ projectId })).data;

          if (token) {
            setPushNotificationToken(token);
            const saved = await SecureStore.getItemAsync("push_token");
            if (token !== saved) {
              console.log("💾 Saving new push token to SecureStore...");
              await SecureStore.setItemAsync("push_token", token);
            } else {
              console.log("✅ Token already stored, skipping save.");
            }
          }
        } catch (e) {
          console.warn("Failed to get Expo push token:", e);
          token = null;
        }
        setExpoPushToken(token);
      } else {
        console.log("Must use physical device for Push Notifications");
      }
      return token;
    }

    registerForPushNotificationsAsync();

    notificationListener.current = Notifications.addNotificationReceivedListener((notif: ExpoNotification) => {
      setNotification(notif);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((_response: NotificationResponse) => {
      // handle notification response if needed (navigate, analytics, etc.)
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
      notificationListener.current = null;
      responseListener.current = null;
    };
  }, []);

  return {
    expoPushToken,
    notification,
  };
};

export default usePushNotification;
