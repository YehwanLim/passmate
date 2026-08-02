import { UI_LABELS } from "@/constants/labels";

export function getAnalyzeErrorMessage(errorData: unknown): string {
  if (!errorData || typeof errorData !== "object") {
    return UI_LABELS.ANALYSIS_FAILED;
  }

  const { message, error } = errorData as {
    message?: unknown;
    error?: unknown;
  };

  const rawMessage = [message, error]
    .filter((value): value is string => typeof value === "string")
    .join(" ");

  if (/Google API Error 503|UNAVAILABLE|high demand|과부하/i.test(rawMessage)) {
    return UI_LABELS.MODEL_OVERLOADED_ERROR;
  }

  if (typeof message === "string" && message.trim()) {
    return message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return UI_LABELS.ANALYSIS_FAILED;
}
