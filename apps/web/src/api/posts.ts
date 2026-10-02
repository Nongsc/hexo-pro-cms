import { http } from "@/utils/http";

export const getPosts = (params?: object) =>
  http.request("get", "/posts", { params });

export const getPost = (id: string) => http.request("get", `/posts/${id}`);

export const createPost = (data?: object) =>
  http.request("post", "/posts", { data });

export const updatePost = (id: string, data?: object) =>
  http.request("put", `/posts/${id}`, { data });

export const deletePost = (id: string) =>
  http.request("delete", `/posts/${id}`);

export const publishPost = (id: string) =>
  http.request("post", `/posts/${id}/publish`);

export const unpublishPost = (id: string) =>
  http.request("post", `/posts/${id}/unpublish`);

export const checkPostTitle = (params?: object) =>
  http.request("get", "/posts/check-title", { params });

export const getPostCategories = () => http.request("get", "/posts/categories");

export const getPostTags = () => http.request("get", "/posts/tags");

export const getCategoryPosts = (name: string, params?: object) =>
  http.request("get", `/posts/categories/${name}/posts`, { params });

export const searchPosts = (q: string) =>
  http.request("post", "/posts/search", { data: { q } });

export const syncPosts = () => http.request("post", "/posts/sync");
