<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import {
  getInstalledThemes,
  getCurrentTheme,
  switchTheme,
  installTheme,
  getInstallStatus,
  uninstallTheme,
  getThemeConfig,
  saveThemeConfig
} from "@/api/themes";

defineOptions({ name: "ThemesIndex" });

const loading = ref(false);
const installing = ref(false);
const switching = ref<string>("");
const currentTheme = ref("");
const themes = ref<any[]>([]);
const installProgress = ref(0);
const installStatusText = ref("");

const installForm = reactive({
  url: "",
  branch: "",
  name: ""
});

const configDialog = ref(false);
const configTheme = ref("");
const configContent = ref("");
const configSaving = ref(false);

async function load() {
  loading.value = true;
  try {
    const [installed, current] = await Promise.all([
      getInstalledThemes(),
      getCurrentTheme()
    ]);
    themes.value = installed.data || [];
    currentTheme.value = current.data?.theme || "";
  } finally {
    loading.value = false;
  }
}

async function onSwitch(name: string) {
  if (name === currentTheme.value) {
    message("已是当前主题", { type: "info" });
    return;
  }
  await ElMessageBox.confirm(
    `确认将主题切换为「${name}」？会修改 _config.yml 的 theme 字段。`,
    "切换主题",
    { type: "warning", confirmButtonText: "切换", cancelButtonText: "取消" }
  );
  switching.value = name;
  try {
    await switchTheme(name);
    currentTheme.value = name;
    message("切换成功", { type: "success" });
  } finally {
    switching.value = "";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const statusTextMap: Record<string, string> = {
  pending: "排队中…",
  fetching: "拉取主题文件…",
  building: "重建文件…",
  committing: "提交中…",
  completed: "完成",
  failed: "失败"
};

async function pollInstall(jobId: string) {
  for (;;) {
    await sleep(2500);
    const s: any = await getInstallStatus(jobId);
    const job = s.data || {};
    installProgress.value = job.progress || 0;
    installStatusText.value = statusTextMap[job.status] || job.status;
    if (job.status === "completed") {
      message(`主题「${job.theme}」安装成功`, { type: "success" });
      await load();
      break;
    }
    if (job.status === "failed") {
      message(job.error || "安装失败", { type: "error" });
      break;
    }
  }
  installing.value = false;
  installProgress.value = 0;
  installStatusText.value = "";
}

async function onInstall() {
  if (!installForm.url.trim()) {
    message("请输入主题仓库 URL", { type: "warning" });
    return;
  }
  installing.value = true;
  installProgress.value = 1;
  installStatusText.value = "创建安装任务…";
  try {
    const res: any = await installTheme({
      url: installForm.url.trim(),
      branch: installForm.branch || undefined,
      name: installForm.name || undefined
    });
    installForm.url = "";
    installForm.branch = "";
    installForm.name = "";
    await pollInstall(res.data?.jobId);
  } catch (e: any) {
    installing.value = false;
    installProgress.value = 0;
    installStatusText.value = "";
    message(e?.message || "安装失败", { type: "error" });
  }
}

async function openConfig(name: string) {
  configTheme.value = name;
  const res: any = await getThemeConfig(name);
  configContent.value = res.data?.content || "";
  configDialog.value = true;
}

async function onUninstall(name: string) {
  await ElMessageBox.confirm(
    `确认卸载主题「${name}」？会从 themes/ 目录删除该主题代码。`,
    "卸载主题",
    { type: "warning", confirmButtonText: "卸载", cancelButtonText: "取消" }
  );
  await uninstallTheme(name);
  message("已卸载", { type: "success" });
  await load();
}

async function onSaveConfig() {
  configSaving.value = true;
  try {
    await saveThemeConfig(configTheme.value, configContent.value);
    message("主题配置已保存", { type: "success" });
    configDialog.value = false;
  } finally {
    configSaving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div v-loading="loading">
    <el-row :gutter="16">
      <el-col :span="16">
        <el-card shadow="never">
          <template #header>
            <span>已安装主题（当前：{{ currentTheme || "-" }}）</span>
          </template>
          <el-empty v-if="!themes.length" description="尚未安装主题" />
          <div v-else class="grid grid-cols-2 gap-4">
            <el-card
              v-for="t in themes"
              :key="t.name"
              shadow="hover"
              class="theme-card"
              :class="{ active: t.name === currentTheme }"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div class="font-medium">{{ t.name }}</div>
                  <div class="text-xs text-gray-400 mt-1">
                    {{ t.name === currentTheme ? "当前使用中" : "" }}
                  </div>
                </div>
                <div class="flex gap-1">
                  <el-button
                    v-if="t.name !== currentTheme"
                    size="small"
                    type="primary"
                    :loading="switching === t.name"
                    @click="onSwitch(t.name)"
                  >
                    启用
                  </el-button>
                  <el-tag v-else size="small" type="success">使用中</el-tag>
                  <el-button size="small" @click="openConfig(t.name)">
                    配置
                  </el-button>
                  <el-button
                    v-if="t.name !== currentTheme"
                    size="small"
                    type="danger"
                    @click="onUninstall(t.name)"
                  >
                    卸载
                  </el-button>
                </div>
              </div>
            </el-card>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card shadow="never">
          <template #header>安装新主题</template>
          <el-form :model="installForm" label-position="top">
            <el-form-item label="GitHub 仓库 URL">
              <el-input
                v-model="installForm.url"
                placeholder="https://github.com/theme-next/hexo-theme-next"
              />
            </el-form-item>
            <el-form-item label="分支（默认 master）">
              <el-input v-model="installForm.branch" placeholder="master / main" />
            </el-form-item>
            <el-form-item label="主题目录名（留空自动推断）">
              <el-input v-model="installForm.name" placeholder="如 next" />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                class="w-full"
                :loading="installing"
                @click="onInstall"
              >
                安装主题
              </el-button>
            </el-form-item>
            <div v-if="installing" class="mb-4">
              <div class="text-sm text-gray-500 mb-2">{{ installStatusText }}</div>
              <el-progress
                :percentage="installProgress"
                :stroke-width="10"
                striped
                striped-flow
              />
            </div>
          </el-form>
          <el-alert
            type="info"
            :closable="false"
            title="安装原理"
            description="后台异步安装：拉取主题仓库文件树，通过 GitHub git data API 一次性提交到 themes/ 目录（不会 npm install，如需额外依赖请用 GitHub Actions）。"
          />
        </el-card>
      </el-col>
    </el-row>

    <el-dialog
      v-model="configDialog"
      :title="`主题配置 - _config.${configTheme}.yml`"
      width="720px"
    >
      <el-input
        v-model="configContent"
        type="textarea"
        :rows="22"
        class="font-mono"
        placeholder="YAML 配置内容"
      />
      <template #footer>
        <el-button @click="configDialog = false">取消</el-button>
        <el-button type="primary" :loading="configSaving" @click="onSaveConfig">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.theme-card.active {
  border-color: var(--el-color-primary);
}
</style>
