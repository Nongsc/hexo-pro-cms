import { http } from "@/utils/http";

export const getInstalledThemes = () => http.request("get", "/theme/installed");

export const getCurrentTheme = () => http.request("get", "/theme/current");

export const switchTheme = (name: string) =>
  http.request("post", "/theme/switch", { data: { name } });

export const installTheme = (data: {
  url: string;
  branch?: string;
  name?: string;
}) => http.request("post", "/theme/install", { data });

export const installNpmTheme = (data: {
  package: string;
  name: string;
  plugins?: string;
}) => http.request("post", "/theme/install-npm", { data });

export const getInstallStatus = (jobId: string) =>
  http.request("get", `/theme/install/status/${jobId}`);

export const uninstallTheme = (name: string) =>
  http.request("delete", `/theme/${name}`);

export const getThemeConfig = (name: string) =>
  http.request("get", "/theme/config", { params: { name } });

export const saveThemeConfig = (name: string, content: string) =>
  http.request("put", "/theme/config", { data: { name, content } });
