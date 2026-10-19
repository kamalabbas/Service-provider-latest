import { BaseResponse } from "@/interfaces/baseResponse.interface";
import { postData } from "@/services/api";
import { useMutation } from "@tanstack/react-query";

export interface RegisterNotificationResponse {
    expoPushToken: string;
}

export interface RegisterNotificationRequest {
    expoPushToken: string;
    userId: number | undefined;
}

export interface SendNotificationResponse {
    success: boolean;
}

export interface SendNotificationRequest {
    title: string;
    body: string;
    data?: Record<string, any>;
    to: string; 
}

export function useNotification() {
    const registerNotification = useMutation<BaseResponse<null>, unknown, RegisterNotificationRequest>({
        mutationFn: async (payload: RegisterNotificationRequest) => {
            return await postData<RegisterNotificationRequest, BaseResponse<null>>("/PushNotification/Register", payload);
        },
        onSuccess: () => {
            console.log("Notification registered successfully");
        }
    })

    const sendNotification = useMutation<BaseResponse<SendNotificationResponse>, unknown, SendNotificationRequest>({
        mutationFn: async (payload: SendNotificationRequest) => {
            return await postData<SendNotificationRequest, BaseResponse<SendNotificationResponse>>("/PushNotification/Send", payload);
        },
        onSuccess: () => {
            console.log("Notification sent successfully");
        }
    })

    return {
        registerNotification,
        sendNotification
    }
}