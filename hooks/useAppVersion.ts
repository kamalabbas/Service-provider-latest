import { AppVersionData } from "@/interfaces/appVersionInterface";
import { BaseResponse } from "@/interfaces/baseResponse.interface";
import { getData } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

const useAppVersion = () => {
  const [appVersionData, setAppVersionData] = useState<BaseResponse<AppVersionData> | null>(null);
  const deviceOS = Platform.OS;
  // Retain the existing wire representation until the backend contract is reviewed.
  const deviceAppVersion = Constants.expoConfig
    ? parseInt(Constants.expoConfig.version?.replace(/\./g, "") as string)
    : null;

  useEffect(() => {
    if (!process.env.EXPO_PUBLIC_BASE_URL || useAuthStore.getState().accessToken) return;

    getData<BaseResponse<AppVersionData>>("/Auth/CheckAppVersion", {
      params: { platform: deviceOS, version: deviceAppVersion },
    }).then(setAppVersionData).catch(() => {
      // The update policy is unavailable; existing API error presentation still applies.
    });
  }, [deviceOS, deviceAppVersion]);

  return appVersionData;
};

export default useAppVersion;
