import { http } from "@/utils/http";

export const getImages = (params?: object) =>
  http.request("get", "/images", { params });

export const getImageConfig = () => http.request("get", "/images/config");

export const saveImageConfig = (data?: object) =>
  http.request("put", "/images/config", { data });

export const getImageFolders = () => http.request("get", "/images/folders");

export const uploadImage = (data?: object) =>
  http.request("post", "/images/upload", { data });

export const presignImage = (data?: object) =>
  http.request("post", "/images/presign", { data });

export const confirmImage = (data?: object) =>
  http.request("post", "/images/confirm", { data });

export const deleteImage = (id: string) =>
  http.request("delete", `/images/${id}`);

export const deleteImagesBatch = (ids: string[]) =>
  http.request("post", "/images/delete/batch", { data: { ids } });

export const renameImage = (id: string, filename: string) =>
  http.request("post", `/images/${id}/rename`, { data: { filename } });

export const moveImages = (ids: string[], folder: string) =>
  http.request("post", "/images/move", { data: { ids, folder } });

export const getUnusedImages = () => http.request("get", "/images/unused");

export const cleanupUnusedImages = () =>
  http.request("post", "/images/unused/cleanup");
