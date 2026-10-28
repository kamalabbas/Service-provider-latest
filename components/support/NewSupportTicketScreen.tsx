import { FormInput } from "@/components/form/FormInput";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { useCreateSupportTicket } from "@/hooks/useSupport";
import { mapApiValidation } from "@/services/apiError";
import { SUPPORT_MESSAGE_MAX, SUPPORT_TITLE_MAX } from "@/services/supportService";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { canCreateSupportTickets } from "@/utility/access";
import { SUPPORT_TICKET_FIELDS, SupportTicketFormValues, supportTicketSchema } from "@/utility/supportRules";
import { yupResolver } from "@hookform/resolvers/yup";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { useSupportRoutes } from "./supportRoutes";

// Guide 15: start a conversation with a title and a first plain-text message.
export default function NewSupportTicketScreen() {
  const router = useRouter();
  const routes = useSupportRoutes();
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.showToast);
  const create = useCreateSupportTicket();
  const { control, handleSubmit, setError, formState: { errors } } = useForm<SupportTicketFormValues>({
    resolver: yupResolver(supportTicketSchema),
    defaultValues: { title: "", initialMessage: "" },
  });

  if (!canCreateSupportTickets(user)) {
    return <Screen hasHeader><Notice tone="warning" message="You don't have permission to start a support conversation." /></Screen>;
  }

  const onSubmit = (values: SupportTicketFormValues) => {
    if (create.isPending) return;
    create.mutate(values, {
      onSuccess: (response) => {
        showToast("Your message was sent to support.", "success");
        if (response.data) router.replace({ pathname: routes.ticket, params: { id: String(response.data.id) } });
        else router.back();
      },
      onError: (error) => {
        const { fieldErrors } = mapApiValidation(error, SUPPORT_TICKET_FIELDS);
        SUPPORT_TICKET_FIELDS.forEach((field) => { if (fieldErrors[field]) setError(field, { message: fieldErrors[field] }); });
      },
    });
  };

  return (
    <Screen hasHeader title="New conversation" subtitle="Plain text only. Don't include passwords or verification codes.">
      <Controller
        control={control}
        name="title"
        render={({ field: { onChange, onBlur, value } }) => (
          <FormInput label="Title" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.title?.message}
            maxLength={SUPPORT_TITLE_MAX} placeholder="e.g. I can't update my business address" />
        )}
      />
      <Controller
        control={control}
        name="initialMessage"
        render={({ field: { onChange, onBlur, value } }) => (
          <FormInput label="Message" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.initialMessage?.message}
            multiline maxLength={SUPPORT_MESSAGE_MAX} placeholder="What do you need help with?" />
        )}
      />
      <PrimaryButton
        title={create.isPending ? "Sending..." : "Send"}
        leftIcon="send-outline"
        onPress={handleSubmit(onSubmit)}
        loading={create.isPending}
        disabled={create.isPending}
      />
    </Screen>
  );
}
