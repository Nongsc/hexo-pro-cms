import { http } from "@/utils/http";

export type UserResult = {
  success: boolean;
  data: {
    /** 头像 */
    avatar: string;
    /** 用户名 */
    username: string;
    /** 当前登录用户的角色 */
    roles: Array<string>;
    /** 按钮级别权限 */
    permissions: Array<string>;
    /** `token` */
    accessToken: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间 */
    expires: Date;
  };
};

export type RefreshTokenResult = {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    expires: Date;
    avatar: string;
    username: string;
    roles: Array<string>;
    permissions: Array<string>;
  };
};

/** 将后端 `{ code, data: { token, username, avatar } }` 映射为前端期望的登录结果 */
function mapAuth(res: any): UserResult {
  const d = res?.data || {};
  return {
    success: !!d?.token,
    data: {
      avatar: d.avatar || "",
      username: d.username || "",
      roles: ["admin"],
      permissions: ["*:*:*"],
      accessToken: d.token,
      refreshToken: d.token,
      expires: new Date(Date.now() + 7 * 24 * 3600 * 1000)
    }
  };
}

/** 登录 */
export const getLogin = (data?: object) => {
  return http.request<any>("post", "/auth/login", { data }).then(mapAuth);
};

/** 刷新`token` */
export const refreshTokenApi = (data?: object) => {
  return http
    .request<any>("post", "/auth/refresh-token", { data })
    .then(mapAuth);
};

/** 检查是否首次使用 */
export const getCheckFirstUse = () => {
  return http.request<any>("get", "/auth/check-first-use");
};

/** 首次使用注册 */
export const registerApi = (data?: object) => {
  return http.request<any>("post", "/auth/register", { data }).then(mapAuth);
};

/** 跳过设置（创建临时用户） */
export const skipSetupApi = () => {
  return http.request<any>("post", "/auth/skip-setup").then(mapAuth);
};

/** 获取密码重置的安全问题 */
export const getSecurityQuestionApi = (username: string) => {
  return http.request<any>("get", "/auth/security-question", {
    params: { username }
  });
};

/** 通过安全问题重置密码 */
export const resetPasswordApi = (data?: object) => {
  return http.request<any>("post", "/auth/reset-password", { data });
};

/** 获取当前登录用户信息 */
export const getUserInfoApi = () => {
  return http.request<any>("get", "/auth/me");
};
