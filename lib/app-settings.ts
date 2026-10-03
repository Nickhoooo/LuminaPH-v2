export type AppSettings = {
  theme: "light" | "dark" | "system";
  reading_size: "normal" | "large";
  reduce_motion: boolean;
  quiz_notifications: boolean;
  group_notifications: boolean;
  admin_notifications: boolean;
};

export const defaultAppSettings: AppSettings = {
  theme: "system",
  reading_size: "normal",
  reduce_motion: false,
  quiz_notifications: true,
  group_notifications: true,
  admin_notifications: true,
};
