import { DEFAULT_SETTINGS, mergeSettings, type UserSettings } from "@/lib/settings";

let settingsStore: UserSettings = DEFAULT_SETTINGS;
let updatedAt = new Date().toISOString();

function settingsResponse(source: "default" | "memory" = "memory") {
  return Response.json({
    settings: settingsStore,
    updatedAt,
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
  return settingsResponse(settingsStore === DEFAULT_SETTINGS ? "default" : "memory");
}

export async function PUT(request: Request) {
  const patch = await readSettingsPatch(request);
  if (!patch) {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  settingsStore = mergeSettings(settingsStore, patch);
  updatedAt = new Date().toISOString();
  return settingsResponse();
}

export async function PATCH(request: Request) {
  return PUT(request);
}

export async function DELETE() {
  settingsStore = DEFAULT_SETTINGS;
  updatedAt = new Date().toISOString();
  return settingsResponse("default");
}
