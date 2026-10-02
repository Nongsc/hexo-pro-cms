import { http } from "@/utils/http";

export const getRecycleList = () => http.request("get", "/recycle");

export const getRecycleStats = () => http.request("get", "/recycle/stats");

export const restoreRecycle = (id: string) =>
  http.request("post", `/recycle/${id}/restore`);

export const deleteRecycle = (id: string) =>
  http.request("delete", `/recycle/${id}`);

export const emptyRecycle = () => http.request("post", "/recycle/empty");
