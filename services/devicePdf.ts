import { NativeUploadFile } from "@/services/apiFiles";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/** Lets the member choose a PDF; null when cancelled. Size and type are checked by documentForm. */
export async function pickPdf(): Promise<NativeUploadFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true, multiple: false });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return { uri: asset.uri, name: asset.name || "quote.pdf", mimeType: asset.mimeType ?? "application/pdf", size: asset.size ?? 0 };
}

/**
 * Opens downloaded private PDF bytes in the system viewer/share sheet. The
 * temporary copy is deleted afterwards; it is never saved to a public location.
 */
export async function openPdf(data: ArrayBuffer, fileName: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Opening documents isn't available on this device.");
  const file = new File(Paths.cache, fileName);
  try {
    if (file.exists) file.delete();
    file.create();
    file.write(new Uint8Array(data));
    await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: fileName });
  } finally {
    try { if (file.exists) file.delete(); } catch { /* best effort */ }
  }
}
