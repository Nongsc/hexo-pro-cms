import { http } from "@/utils/http";

export const getDeployConfig = () => http.request("get", "/deploy/config");

export const saveDeployConfig = (data?: object) =>
  http.request("put", "/deploy/config", { data });

export const executeDeploy = () => http.request("post", "/deploy/execute");

export const getDeployStatus = () => http.request("get", "/deploy/status");

export const resetDeployStatus = () =>
  http.request("post", "/deploy/reset-status");
