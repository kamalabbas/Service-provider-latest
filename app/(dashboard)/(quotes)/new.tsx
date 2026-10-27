import { DateTimeInput } from "@/components/form/DateTimeInput";
import { FormInput } from "@/components/form/FormInput";
import { Loader } from "@/components/ui/loader";
import { Notice } from "@/components/ui/Notice";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Screen } from "@/components/ui/Screen";
import { Spacing } from "@/constants/Theme";
import { useInspection } from "@/hooks/useInspections";
import { useCreateQuote } from "@/hooks/useQuotes";
import { Inspection } from "@/interfaces/inspection.interface";
import { mapApiValidation } from "@/services/apiError";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { QUOTE_FIELDS, QuoteFormValues, canIssueQuoteFor, defaultQuoteExpiry, quoteSchema, toCreateQuoteRequest } from "@/utility/quoteRules";
import { yupResolver } from "@hookform/resolvers/yup";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet } from "react-native";

// Guide 09: the provider issues a quote for a completed or rated inspection.
export default function NewQuoteScreen() {
  const { inspectionId } = useLocalSearchParams<{ inspectionId: string }>();
  const id = Number.isSafeInteger(Number(inspectionId)) && Number(inspectionId) > 0 ? Number(inspectionId) : null;
  const user = useAuthStore((state) => state.user);
  const inspection = useInspection(id);

  if (inspection.isLoading) return <Screen hasHeader><Loader visible overlay={false} message="Loading…" /></Screen>;
  if (!inspection.data) return <Screen hasHeader><Notice tone="warning" message="This inspection is unavailable." /></Screen>;
  if (!canIssueQuoteFor(inspection.data, user)) {
    return <Screen hasHeader><Notice tone="warning" message="Quotes can be sent only for your completed inspections." /></Screen>;
  }
  return <QuoteForm inspection={inspection.data} />;
}

function QuoteForm({ inspection }: { inspection: Inspection }) {
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);
  const create = useCreateQuote();
  const { control, handleSubmit, setError, formState: { errors } } = useForm<QuoteFormValues>({
    resolver: yupResolver(quoteSchema()),
    defaultValues: { totalAmount: "", note: "", expiresAt: defaultQuoteExpiry() },
  });

  const onSubmit = (values: QuoteFormValues) => {
    if (create.isPending) return;
    create.mutate(toCreateQuoteRequest(inspection.id, values), {
      onSuccess: (response) => {
        showToast(response.data ? `Quote ${response.data.quoteNumber} sent.` : "Quote sent.", "success");
        if (response.data) router.replace({ pathname: "/(dashboard)/(quotes)/[id]", params: { id: String(response.data.id) } });
        else router.back();
      },
      onError: (error) => {
        const { fieldErrors } = mapApiValidation(error, QUOTE_FIELDS);
        QUOTE_FIELDS.forEach((field) => {
          if (fieldErrors[field]) setError(field, { message: fieldErrors[field] });
        });
      },
    });
  };

  return (
    <Screen hasHeader title="New quote" subtitle={`${inspection.serviceTitle} for ${inspection.requesterName}`}>
      <Notice message="One pending quote per inspection. The quote number is issued when you send it. There's no payment step." style={styles.notice} />
      <Controller
        control={control}
        name="totalAmount"
        render={({ field: { onChange, onBlur, value } }) => (
          <FormInput label="Total (AUD)" value={value} onChangeText={onChange} onBlur={onBlur} keyboardType="decimal-pad" placeholder="0.00"
            leftIcon="cash-outline" error={errors.totalAmount?.message} />
        )}
      />
      <Controller
        control={control}
        name="expiresAt"
        render={({ field: { onChange, value } }) => (
          <DateTimeInput label="Valid until" value={value} onChange={onChange} minimumDate={new Date()} error={errors.expiresAt?.message} />
        )}
      />
      <Controller
        control={control}
        name="note"
        render={({ field: { onChange, onBlur, value } }) => (
          <FormInput label="Note (optional)" value={value} onChangeText={onChange} onBlur={onBlur} multiline maxLength={2000} error={errors.note?.message} />
        )}
      />
      <PrimaryButton
        title={create.isPending ? "Sending..." : "Send quote"}
        leftIcon="send-outline"
        onPress={handleSubmit(onSubmit)}
        loading={create.isPending}
        disabled={create.isPending}
      />
      <Notice message="You can attach a PDF after sending." style={styles.after} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: Spacing.lg },
  after: { marginTop: Spacing.lg },
});
