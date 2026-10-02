import { http } from "@/utils/http";

export const getPages = (params?: object) =>
  http.request("get", "/pages", { params });

export const getPage = (id: string) => http.request("get", `/pages/${id}`);

export const createPage = (data?: object) =>
  http.request("post", "/pages", { data });

export const updatePage = (id: string, data?: object) =>
  http.request("put", `/pages/${id}`, { data });

export const deletePage = (id: string) =>
  http.request("delete", `/pages/${id}`);

export const publishPage = (id: string) =>
  http.request("post", `/pages/${id}/publish`);

export const unpublishPage = (id: string) =>
  http.request("post", `/pages/${id}/unpublish`);

export const syncPages = () => http.request("post", "/pages/sync");
