import { http } from "@/utils/http";

// 系统配置（站点信息 / GitHub / COS / 部署）
export const getSystemConfig = () => http.request("get", "/settings/system");

export const saveSystemConfig = (data?: object) =>
  http.request("put", "/settings/system", { data });

export const getGithubConfig = () => http.request("get", "/settings/github");

export const saveGithubConfig = (data?: object) =>
  http.request("put", "/settings/github", { data });

export const getCosConfig = () => http.request("get", "/settings/cos");

export const saveCosConfig = (data?: object) =>
  http.request("put", "/settings/cos", { data });

export const getDeploySetting = () => http.request("get", "/settings/deploy");

export const saveDeploySetting = (data?: object) =>
  http.request("put", "/settings/deploy", { data });

export const getConfigStatus = () => http.request("get", "/settings/status");

// 用户资料
export const updateProfile = (data?: object) =>
  http.request("put", "/users/profile", { data });

export const uploadAvatar = (data: string) =>
  http.request("post", "/users/avatar", { data: { data } });
