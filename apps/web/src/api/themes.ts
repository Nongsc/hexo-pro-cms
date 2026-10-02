import { http } from "@/utils/http";

export const getInstalledThemes = () => http.request("get", "/theme/installed");

export const getCurrentTheme = () => http.request("get", "/theme/current");

export const switchTheme = (name: string) =>
  http.request("post", "/theme/switch", { data: { name } });

export const installTheme = (data: {
  url: string;
  branch?: string;
  name?: string;
  plugins?: string;
}) => http.request("post", "/theme/install", { data });

export const installNpmTheme = (data: {
  package: string;
  name: string;
  plugins?: string;
}) => http.request("post", "/theme/install-npm", { data });

export const getPlugins = () => http.request("get", "/theme/plugins");

export const addPlugins = (plugins: string) =>
  http.request("post", "/theme/plugins", { data: { plugins } });

export const removePlugin = (name: string) =>
  http.request("delete", `/theme/plugins/${name}`);

export const getInstallStatus = (jobId: string) =>
  http.request("get", `/theme/install/status/${jobId}`);

export const uninstallTheme = (name: string) =>
  http.request("delete", `/theme/${name}`);

export const getThemeConfig = (name: string) =>
  http.request("get", "/theme/config", { params: { name } });

export const saveThemeConfigDraft = (name: string, content: string) =>
  http.request("post", "/theme/config/draft", { data: { name, content } });

export const publishThemeConfig = (name: string) =>
  http.request("post", "/theme/config/publish", { data: { name } });

export const discardThemeConfigDraft = (name: string) =>
  http.request("delete", "/theme/config/draft", { params: { name } });
