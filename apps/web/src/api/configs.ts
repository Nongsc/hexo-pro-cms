import { http } from "@/utils/http";

export const getConfigFiles = () => http.request("get", "/configs/files");

export const getConfigFile = (path: string) =>
  http.request("get", "/configs/file", { params: { path } });

export const saveConfigDraft = (path: string, content: string) =>
  http.request("post", "/configs/file/draft", { data: { path, content } });

export const publishConfig = (path: string) =>
  http.request("post", "/configs/file/publish", { data: { path } });

export const discardConfigDraft = (path: string) =>
  http.request("delete", "/configs/file/draft", { params: { path } });

export const getConfigSnapshots = (scope: string) =>
  http.request("get", "/configs/snapshots", { params: { scope } });

export const rollbackConfig = (id: string) =>
  http.request("post", "/configs/rollback", { data: { id } });
