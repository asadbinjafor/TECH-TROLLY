import type { ExpoConfig, ConfigContext } from "expo/config";
export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (
    profile &&
    (!url ||
      (["preview", "production"].includes(profile) &&
        !url.startsWith("https://")))
  )
    throw new Error(
      "Set the public API URL in the EAS environment; preview and production require HTTPS.",
    );
  return {
    ...config,
    name: config.name || "Tech Trolley",
    slug: config.slug || "tech-trolley",
    extra: { ...config.extra, apiUrlConfigured: !!url },
  };
};
