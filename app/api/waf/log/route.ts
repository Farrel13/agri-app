import { NextResponse } from "next/server";
import { logWafEvent } from "@/lib/system-logger";
import type { LogSeverity } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      severity = "WARN",
      action = "WAF_THREAT_BLOCKED",
      message = "Ancaman keamanan diblokir oleh sistem WAF",
      endpoint,
      method,
      ipAddress,
      userAgent,
      metadata,
    } = body;

    const logged = await logWafEvent({
      severity: (severity as LogSeverity) || "WARN",
      action: String(action),
      message: String(message),
      endpoint: endpoint ? String(endpoint) : null,
      method: method ? String(method) : null,
      ipAddress: ipAddress ? String(ipAddress) : null,
      userAgent: userAgent ? String(userAgent) : null,
      metadata: typeof metadata === "object" ? metadata : { raw: metadata },
    });

    return NextResponse.json({ success: true, logId: logged?.id });
  } catch (err) {
    console.error("[WAF API Log Error]:", err);
    return NextResponse.json({ success: false, error: "Gagal mencatat log WAF" }, { status: 500 });
  }
}
