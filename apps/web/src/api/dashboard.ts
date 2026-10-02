import { http } from "@/utils/http";

export const getDashboardStats = () => http.request("get", "/dashboard/stats");

export const getDashboardCategories = () =>
  http.request("get", "/dashboard/categories");

export const getDashboardTags = () => http.request("get", "/dashboard/tags");

export const getRecentPosts = (limit?: number) =>
  http.request("get", "/dashboard/recent", { params: { limit } });

export const getSystemInfo = () => http.request("get", "/dashboard/system");

export const getMonthlyStats = () => http.request("get", "/dashboard/monthly");

export const getTodos = () => http.request("get", "/dashboard/todos");

export const addTodo = (content: string) =>
  http.request("post", "/dashboard/todos", { data: { content } });

export const toggleTodo = (id: string) =>
  http.request("post", `/dashboard/todos/${id}/toggle`);

export const deleteTodo = (id: string) =>
  http.request("delete", `/dashboard/todos/${id}`);
