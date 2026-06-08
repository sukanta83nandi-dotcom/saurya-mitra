import { BillData } from "../types";

export async function analyzeBill(base64Image: string, mimeType: string): Promise<BillData> {
  try {
    const response = await fetch("/api/analyze-bill", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ base64Image, mimeType }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to analyze bill via backend");
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Failed to analyze bill via backend");
    }

    return {
      connectedLoad: result.data?.connectedLoad || 0,
      unitsConsumed: result.data?.unitsConsumed || 0,
      monthlyBill: result.data?.monthlyBill || 0,
      provider: result.data?.provider || "Unknown"
    };
  } catch (error: any) {
    console.error("Failed to analyze bill", error);
    throw new Error(error.message || "ইলেক্ট্রিসিটি বিল বিশ্লেষণ করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।");
  }
}

