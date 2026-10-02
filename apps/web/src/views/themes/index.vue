<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import {
  getInstalledThemes,
  getCurrentTheme,
  switchTheme,
  installTheme,
  installNpmTheme,
  getInstallStatus,
  getPlugins,
  addPlugins,
  removePlugin,
  uninstallTheme,
  getThemeConfig,
  saveThemeConfigDraft,
  publishThemeConfig,
  discardThemeConfigDraft
} from "@/api/themes";

defineOptions({ name: "ThemesIndex" });

const loading = ref(false);
const installing = ref(false);
const switching = ref<string>("");
const currentTheme = ref("");
const themes = ref<any[]>([]);
const installProgress = ref(0);
const installStatusText = ref("");
const plugins = ref<any[]>([]);
const newPlugin = ref("");

const installForm = reactive({
  url: "",
  branch: "",
  name: "",
  package: "",
  plugins: ""
});

const installMode = ref<"git" | "npm">("git");

const configDialog = ref(false);
const configTheme = ref("");
const configContent = ref("");
const configSaving = ref(false);
const configPublishing = ref(false);
const configHasDraft = ref(false);

async function load() {
  loading.value = true;
  try {
    const [installed, current, pluginsRes] = await Promise.all([
      getInstalledThemes(),
      getCurrentTheme(),
      getPlugins()
    ]);
    themes.value = installed.data || [];
    currentTheme.value = current.data?.theme || "";
    plugins.value = pluginsRes.data || [];
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
  running: "GitHub Actions 安装中…",
  completed: "安装完成",
  failed: "安装失败"
};

async function pollInstall(runId: number) {
  for (;;) {
    await sleep(3000);
    const s: any = await getInstallStatus(runId);
    const job = s.data || {};
    installProgress.value = job.progress || 0;
    installStatusText.value = statusTextMap[job.status] || job.status;
    if (job.status === "completed") {
      message("主题安装成功", { type: "success" });
      await load();
      break;
    }
    if (job.status === "failed") {
      message("主题安装失败，请查看 GitHub Actions 运行详情", { type: "error" });
      break;
    }
  }
  installing.value = false;
  installProgress.value = 0;
  installStatusText.value = "";
}

async function onInstall() {
  if (installMode.value === "npm") {
    await onInstallNpm();
    return;
  }
  if (!installForm.url.trim()) {
    message("请输入主题仓库 URL", { type: "warning" });
    return;
  }
  installing.value = true;
  installProgress.value = 1;
  installStatusText.value = "触发安装任务…";
  try {
    const res: any = await installTheme({
      url: installForm.url.trim(),
      branch: installForm.branch || undefined,
      name: installForm.name || undefined,
      plugins: installForm.plugins || undefined
    });
    installForm.url = "";
    installForm.branch = "";
    installForm.name = "";
    installForm.plugins = "";
    if (res.data?.runId) {
      await pollInstall(res.data.runId);
    } else {
      installing.value = false;
      installProgress.value = 0;
      installStatusText.value = "";
      message("已触发安装，稍后刷新查看", { type: "success" });
      await sleep(5000);
      await load();
    }
  } catch (e: any) {
    installing.value = false;
    installProgress.value = 0;
    installStatusText.value = "";
    message(e?.message || "安装失败", { type: "error" });
  }
}

async function onInstallNpm() {
  if (!installForm.package.trim() || !installForm.name.trim()) {
    message("请输入 npm 包名和主题目录名", { type: "warning" });
    return;
  }
  installing.value = true;
  installStatusText.value = "写入 package.json 与配置…";
  try {
    const res: any = await installNpmTheme({
      package: installForm.package.trim(),
      name: installForm.name.trim(),
      plugins: installForm.plugins || undefined
    });
    installForm.package = "";
    installForm.name = "";
    installForm.plugins = "";
    message(
      `已添加主题「${res.data?.theme}」，将在下次构建时通过 npm 安装生效`,
      { type: "success" }
    );
    await load();
  } catch (e: any) {
    message(e?.message || "安装失败", { type: "error" });
  } finally {
    installing.value = false;
    installStatusText.value = "";
  }
}

async function openConfig(name: string) {
  configTheme.value = name;
  const res: any = await getThemeConfig(name);
  const d = res.data || {};
  // 有未发布草稿时优先展示草稿
  configContent.value = d.hasDraft ? d.draft ?? "" : d.content ?? "";
  configHasDraft.value = !!d.hasDraft;
  configDialog.value = true;
}

async function onAddPlugin() {
  if (!newPlugin.value.trim()) {
    message("请输入插件包名", { type: "warning" });
    return;
  }
  await addPlugins(newPlugin.value.trim());
  message("插件已添加，下次构建时 npm 安装生效", { type: "success" });
  newPlugin.value = "";
  await load();
}

async function onRemovePlugin(name: string) {
  await ElMessageBox.confirm(
    `确认移除插件「${name}」？会从 package.json 删除该依赖。`,
    "移除插件",
    { type: "warning", confirmButtonText: "移除", cancelButtonText: "取消" }
  );
  await removePlugin(name);
  message("已移除", { type: "success" });
  await load();
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

async function onSaveDraft() {
  configSaving.value = true;
  try {
    await saveThemeConfigDraft(configTheme.value, configContent.value);
    configHasDraft.value = true;
    message("草稿已保存到数据库（尚未推送到 GitHub）", { type: "success" });
  } finally {
    configSaving.value = false;
  }
}

async function onPublish() {
  configPublishing.value = true;
  try {
    await publishThemeConfig(configTheme.value);
    configHasDraft.value = false;
    message("配置已发布到 GitHub", { type: "success" });
    configDialog.value = false;
  } finally {
    configPublishing.value = false;
  }
}

async function onDiscardDraft() {
  await ElMessageBox.confirm("确认丢弃未发布的草稿？", "丢弃草稿", {
    type: "warning",
    confirmButtonText: "丢弃",
    cancelButtonText: "取消"
  });
  await discardThemeConfigDraft(configTheme.value);
  configHasDraft.value = false;
  const res: any = await getThemeConfig(configTheme.value);
  configContent.value = res.data?.content || "";
  message("草稿已丢弃", { type: "success" });
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
                  <div class="font-medium flex items-center gap-1">
                    {{ t.name }}
                    <el-tag size="small" :type="t.mode === 'npm' ? 'warning' : 'info'">
                      {{ t.mode === "npm" ? "npm" : "git" }}
                    </el-tag>
                  </div>
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
            <el-radio-group v-model="installMode" class="mb-3">
              <el-radio-button value="git">Git 克隆</el-radio-button>
              <el-radio-button value="npm">npm 安装</el-radio-button>
            </el-radio-group>

            <template v-if="installMode === 'git'">
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
              <el-form-item label="额外 npm 插件（逗号分隔，可选）">
                <el-input
                  v-model="installForm.plugins"
                  placeholder="如 hexo-word-counter,hexo-generator-feed"
                />
              </el-form-item>
            </template>

            <template v-else>
              <el-form-item label="npm 包名">
                <el-input v-model="installForm.package" placeholder="如 hexo-theme-yun" />
              </el-form-item>
              <el-form-item label="主题目录名">
                <el-input v-model="installForm.name" placeholder="如 yun" />
              </el-form-item>
              <el-form-item label="额外插件（逗号分隔，可选）">
                <el-input
                  v-model="installForm.plugins"
                  placeholder="如 hexo-renderer-inferno,hexo-word-counter"
                />
              </el-form-item>
            </template>

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
            description="通过 GitHub Actions 安装：工作流在 CI 里 git clone 主题仓库并提交到 themes/ 目录（首次会自动在仓库创建 .github/workflows/install-theme.yml）。"
          />
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="mt-4">
      <template #header>插件管理（package.json 里的 hexo-* 依赖）</template>
      <div class="flex items-center gap-2 mb-4 max-w-lg">
        <el-input
          v-model="newPlugin"
          placeholder="输入插件包名，如 hexo-generator-feed"
          @keyup.enter="onAddPlugin"
        />
        <el-button type="primary" @click="onAddPlugin">添加插件</el-button>
      </div>
      <el-empty v-if="!plugins.length" description="暂无插件" />
      <div v-else class="flex flex-wrap gap-2">
        <el-tag
          v-for="p in plugins"
          :key="p.name"
          closable
          type="info"
          @close="onRemovePlugin(p.name)"
        >
          {{ p.name }}@{{ p.version }}
        </el-tag>
      </div>
    </el-card>

    <el-dialog
      v-model="configDialog"
      :title="`主题配置 - _config.${configTheme}.yml`"
      width="720px"
    >
      <el-alert
        v-if="configHasDraft"
        type="warning"
        :closable="false"
        class="mb-3"
        title="存在未发布的草稿"
        description="当前编辑的是数据库里的草稿，尚未推送到 GitHub。"
      />
      <el-input
        v-model="configContent"
        type="textarea"
        :rows="22"
        class="font-mono"
        placeholder="YAML 配置内容"
      />
      <template #footer>
        <el-button v-if="configHasDraft" @click="onDiscardDraft">
          丢弃草稿
        </el-button>
        <el-button @click="configDialog = false">关闭</el-button>
        <el-button :loading="configSaving" @click="onSaveDraft">
          保存草稿
        </el-button>
        <el-button
          type="primary"
          :loading="configPublishing"
          @click="onPublish"
        >
          发布到 GitHub
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
