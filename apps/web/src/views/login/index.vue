<script setup lang="ts">
import Motion from "./utils/motion";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";
import { loginRules } from "./utils/rule";
import { ref, reactive, onMounted, toRaw } from "vue";
import { useNav } from "@/layout/hooks/useNav";
import { useLayout } from "@/layout/hooks/useLayout";
import { useUserStoreHook } from "@/store/modules/user";
import { initRouter, getTopMenu } from "@/router/utils";
import { bg, avatar, illustration } from "./utils/static";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import {
  getLogin,
  getCheckFirstUse,
  registerApi,
  skipSetupApi,
  getSecurityQuestionApi,
  resetPasswordApi
} from "@/api/user";
import { setToken } from "@/utils/auth";

import dayIcon from "@/assets/svg/day.svg?component";
import darkIcon from "@/assets/svg/dark.svg?component";
import Lock from "~icons/ri/lock-fill";
import User from "~icons/ri/user-3-fill";

defineOptions({ name: "Login" });

const router = useRouter();
const loading = ref(false);
const disabled = ref(false);
const mode = ref<"login" | "register" | "reset">("login");
const securityQuestion = ref("");

const { initStorage } = useLayout();
initStorage();
const { dataTheme, overallStyle, dataThemeChange } = useDataThemeChange();
dataThemeChange(overallStyle.value);
const { title } = useNav();

const ruleForm = reactive({
  username: "",
  password: "",
  confirmPassword: "",
  securityQuestion: "",
  securityAnswer: "",
  newPassword: ""
});

async function afterAuth(res: any) {
  if (res?.success && res?.data?.accessToken) {
    setToken(res.data);
    await initRouter();
    disabled.value = true;
    router
      .push(getTopMenu(true).path)
      .then(() => message("登录成功", { type: "success" }))
      .finally(() => (disabled.value = false));
    return true;
  }
  return false;
}

async function onLogin() {
  if (!ruleForm.username || !ruleForm.password) {
    message("请输入账号和密码", { type: "warning" });
    return;
  }
  loading.value = true;
  try {
    const res = await getLogin({
      username: ruleForm.username,
      password: ruleForm.password
    });
    await afterAuth(res);
  } finally {
    loading.value = false;
  }
}

async function onRegister() {
  if (!ruleForm.username || !ruleForm.password) {
    message("请输入账号和密码", { type: "warning" });
    return;
  }
  if (ruleForm.password !== ruleForm.confirmPassword) {
    message("两次输入的密码不一致", { type: "warning" });
    return;
  }
  loading.value = true;
  try {
    const res = await registerApi({
      username: ruleForm.username,
      password: ruleForm.password,
      confirmPassword: ruleForm.confirmPassword,
      securityQuestion: ruleForm.securityQuestion || undefined,
      securityAnswer: ruleForm.securityAnswer || undefined
    });
    await afterAuth(res);
  } finally {
    loading.value = false;
  }
}

async function onSkipSetup() {
  loading.value = true;
  try {
    const res = await skipSetupApi();
    await afterAuth(res);
  } finally {
    loading.value = false;
  }
}

async function onLoadQuestion() {
  if (!ruleForm.username) {
    message("请输入账号", { type: "warning" });
    return;
  }
  const res: any = await getSecurityQuestionApi(ruleForm.username);
  securityQuestion.value = res.data?.question || "";
}

async function onReset() {
  if (!ruleForm.username || !ruleForm.securityAnswer || !ruleForm.newPassword) {
    message("请填写完整信息", { type: "warning" });
    return;
  }
  loading.value = true;
  try {
    await resetPasswordApi({
      username: ruleForm.username,
      securityAnswer: ruleForm.securityAnswer,
      newPassword: ruleForm.newPassword
    });
    message("密码已重置，请登录", { type: "success" });
    mode.value = "login";
    ruleForm.password = "";
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  try {
    const res: any = await getCheckFirstUse();
    if (res.data?.isFirstUse) mode.value = "register";
  } catch {
    /* 忽略首次检查失败 */
  }
});
</script>

<template>
  <div class="select-none">
    <img :src="bg" class="wave" />
    <div class="flex-c absolute right-5 top-3">
      <el-switch
        v-model="dataTheme"
        inline-prompt
        :active-icon="dayIcon"
        :inactive-icon="darkIcon"
        @change="dataThemeChange"
      />
    </div>
    <div class="login-container">
      <div class="img">
        <component :is="toRaw(illustration)" />
      </div>
      <div class="login-box">
        <div class="login-form">
          <avatar class="avatar" />
          <Motion>
            <h2 class="outline-hidden">{{ title }}</h2>
          </Motion>

          <!-- 登录 -->
          <el-form v-if="mode === 'login'" :model="ruleForm" :rules="loginRules" size="large">
            <Motion :delay="100">
              <el-form-item prop="username">
                <el-input
                  v-model="ruleForm.username"
                  clearable
                  placeholder="账号"
                  :prefix-icon="useRenderIcon(User)"
                />
              </el-form-item>
            </Motion>
            <Motion :delay="150">
              <el-form-item prop="password">
                <el-input
                  v-model="ruleForm.password"
                  clearable
                  show-password
                  placeholder="密码"
                  :prefix-icon="useRenderIcon(Lock)"
                  @keyup.enter="onLogin"
                />
              </el-form-item>
            </Motion>
            <Motion :delay="250">
              <el-button
                class="w-full mt-4!"
                type="primary"
                :loading="loading"
                @click="onLogin"
              >
                登录
              </el-button>
            </Motion>
            <Motion :delay="300">
              <div class="flex justify-between mt-3">
                <el-button link type="primary" @click="mode = 'reset'">
                  忘记密码
                </el-button>
                <el-button
                  v-if="false"
                  link
                  type="primary"
                  @click="mode = 'register'"
                >
                  注册
                </el-button>
              </div>
            </Motion>
          </el-form>

          <!-- 首次使用注册 -->
          <el-form v-else-if="mode === 'register'" :model="ruleForm" size="large">
            <Motion :delay="100">
              <el-form-item>
                <el-input
                  v-model="ruleForm.username"
                  clearable
                  placeholder="设置账号"
                  :prefix-icon="useRenderIcon(User)"
                />
              </el-form-item>
            </Motion>
            <Motion :delay="150">
              <el-form-item>
                <el-input
                  v-model="ruleForm.password"
                  show-password
                  placeholder="设置密码"
                  :prefix-icon="useRenderIcon(Lock)"
                />
              </el-form-item>
            </Motion>
            <Motion :delay="200">
              <el-form-item>
                <el-input
                  v-model="ruleForm.confirmPassword"
                  show-password
                  placeholder="确认密码"
                  :prefix-icon="useRenderIcon(Lock)"
                />
              </el-form-item>
            </Motion>
            <Motion :delay="250">
              <el-button
                class="w-full mt-4!"
                type="primary"
                :loading="loading"
                @click="onRegister"
              >
                初始化并进入
              </el-button>
            </Motion>
            <Motion :delay="300">
              <el-button class="w-full mt-3!" text @click="onSkipSetup">
                跳过设置（临时账号）
              </el-button>
            </Motion>
          </el-form>

          <!-- 找回密码 -->
          <el-form v-else :model="ruleForm" size="large">
            <Motion :delay="100">
              <el-form-item>
                <el-input
                  v-model="ruleForm.username"
                  clearable
                  placeholder="账号"
                  :prefix-icon="useRenderIcon(User)"
                  @blur="onLoadQuestion"
                />
              </el-form-item>
            </Motion>
            <Motion :delay="150">
              <el-form-item>
                <el-input
                  v-model="ruleForm.securityAnswer"
                  placeholder="安全问题答案"
                  :prefix-icon="useRenderIcon(Lock)"
                />
              </el-form-item>
            </Motion>
            <Motion :delay="200">
              <el-form-item>
                <el-input
                  v-model="ruleForm.newPassword"
                  show-password
                  placeholder="新密码"
                  :prefix-icon="useRenderIcon(Lock)"
                />
              </el-form-item>
            </Motion>
            <Motion :delay="250">
              <el-button
                class="w-full mt-4!"
                type="primary"
                :loading="loading"
                @click="onReset"
              >
                重置密码
              </el-button>
            </Motion>
            <Motion :delay="300">
              <el-button class="w-full mt-3!" text @click="mode = 'login'">
                返回登录
              </el-button>
            </Motion>
          </el-form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url("@/style/login.css");
</style>
