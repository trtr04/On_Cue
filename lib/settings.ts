export type UserSettings = {
  profile: {
    displayName: string;
    phoneMasked: string;
    trainingGoal: string;
  };
  device: {
    input: "system" | "headset" | "phone" | "bluetooth";
    bluetoothDevice: string;
    hardwareAutoConnect: boolean;
    noiseSuppression: boolean;
    autoTranscribe: boolean;
  };
  haptics: {
    sound: boolean;
    vibration: boolean;
    intensity: "soft" | "standard" | "strong";
  };
  notify: {
    enabled: boolean;
    reminderTime: string;
    frequency: "daily" | "weekday" | "weekly";
  };
  privacy: {
    storage: "local" | "cloud";
    keepAudio: boolean;
    analysisConsent: boolean;
  };
  export: {
    format: "json" | "txt" | "markdown";
    includeAudio: boolean;
  };
};

export type SettingsPatch = Partial<{
  [Section in keyof UserSettings]: Partial<UserSettings[Section]>;
}>;

export const DEFAULT_SETTINGS: UserSettings = {
  profile: {
    displayName: "Juni",
    phoneMasked: "138****0000",
    trainingGoal: "表达训练与冲突复盘",
  },
  device: {
    input: "system",
    bluetoothDevice: "未连接线下设备",
    hardwareAutoConnect: false,
    noiseSuppression: true,
    autoTranscribe: true,
  },
  haptics: {
    sound: true,
    vibration: true,
    intensity: "standard",
  },
  notify: {
    enabled: true,
    reminderTime: "21:30",
    frequency: "daily",
  },
  privacy: {
    storage: "local",
    keepAudio: true,
    analysisConsent: false,
  },
  export: {
    format: "markdown",
    includeAudio: false,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function oneOf<const T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function timeValue(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

export function mergeSettings(current: UserSettings, patch: unknown): UserSettings {
  const next = isRecord(patch) && isRecord(patch.settings) ? patch.settings : patch;
  const source = isRecord(next) ? next : {};
  const profile = isRecord(source.profile) ? source.profile : {};
  const device = isRecord(source.device) ? source.device : {};
  const haptics = isRecord(source.haptics) ? source.haptics : {};
  const notify = isRecord(source.notify) ? source.notify : {};
  const privacy = isRecord(source.privacy) ? source.privacy : {};
  const exportSettings = isRecord(source.export) ? source.export : {};

  return {
    profile: {
      displayName: stringValue(profile.displayName, current.profile.displayName),
      phoneMasked: stringValue(profile.phoneMasked, current.profile.phoneMasked),
      trainingGoal: stringValue(profile.trainingGoal, current.profile.trainingGoal),
    },
    device: {
      input: oneOf(device.input, ["system", "headset", "phone", "bluetooth"] as const, current.device.input),
      bluetoothDevice: stringValue(device.bluetoothDevice, current.device.bluetoothDevice),
      hardwareAutoConnect: booleanValue(device.hardwareAutoConnect, current.device.hardwareAutoConnect),
      noiseSuppression: booleanValue(device.noiseSuppression, current.device.noiseSuppression),
      autoTranscribe: booleanValue(device.autoTranscribe, current.device.autoTranscribe),
    },
    haptics: {
      sound: booleanValue(haptics.sound, current.haptics.sound),
      vibration: booleanValue(haptics.vibration, current.haptics.vibration),
      intensity: oneOf(haptics.intensity, ["soft", "standard", "strong"] as const, current.haptics.intensity),
    },
    notify: {
      enabled: booleanValue(notify.enabled, current.notify.enabled),
      reminderTime: timeValue(notify.reminderTime, current.notify.reminderTime),
      frequency: oneOf(notify.frequency, ["daily", "weekday", "weekly"] as const, current.notify.frequency),
    },
    privacy: {
      storage: oneOf(privacy.storage, ["local", "cloud"] as const, current.privacy.storage),
      keepAudio: booleanValue(privacy.keepAudio, current.privacy.keepAudio),
      analysisConsent: booleanValue(privacy.analysisConsent, current.privacy.analysisConsent),
    },
    export: {
      format: oneOf(exportSettings.format, ["json", "txt", "markdown"] as const, current.export.format),
      includeAudio: booleanValue(exportSettings.includeAudio, current.export.includeAudio),
    },
  };
}
