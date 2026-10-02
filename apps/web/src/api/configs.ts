import { http } from "@/utils/http";

export const getConfigFiles = () => http.request("get", "/configs/files");

export const getConfigFile = (path: string) =>
  http.request("get", "/configs/file", { params: { path } });

export const saveConfigFile = (path: string, content: string, note?: string) =>
  http.request("put", "/configs/file", { data: { path, content, note } });

export const getConfigSnapshots = (scope: string) =>
  http.request("get", "/configs/snapshots", { params: { scope } });

export const rollbackConfig = (id: string) =>
  http.request("post", "/configs/rollback", { data: { id } });
