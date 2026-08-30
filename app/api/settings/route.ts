import { DEFAULT_SETTINGS, mergeSettings, type UserSettings } from "@/lib/settings";

function settingsResponse(settings: UserSettings, source: "default" | "request") {
  return Response.json({
    settings,
    updatedAt: new Date().toISOString(),
    source,
  });
}

async function readSettingsPatch(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function GET() {
  return settingsResponse(DEFAULT_SETTINGS, "default");
}

export async function PUT(request: Request) {
  const patch = await readSettingsPatch(request);
  if (!patch) {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  return settingsResponse(mergeSettings(DEFAULT_SETTINGS, patch), "request");
}

export async function PATCH(request: Request) {
  return PUT(request);
}

export async function DELETE() {
  return settingsResponse(DEFAULT_SETTINGS, "default");
}
