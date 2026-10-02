<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from "vue";
import { message } from "@/utils/message";
import {
  getDeployConfig,
  saveDeployConfig,
  executeDeploy,
  getDeployStatus,
  resetDeployStatus
} from "@/api/deploy";

defineOptions({ name: "DeployIndex" });

const form = reactive({
  workflowId: "",
  ref: "",
  autoTrigger: false
});
const saving = ref(false);
const deploying = ref(false);
const status = ref<any>({});
let timer: any = null;

async function loadConfig() {
  const res: any = await getDeployConfig();
  const c = res.data || {};
  form.workflowId = c.workflowId || "";
  form.ref = c.ref || "";
  form.autoTrigger = !!c.autoTrigger;
}

async function save() {
  saving.value = true;
  try {
    await saveDeployConfig({
      workflowId: form.workflowId,
      ref: form.ref,
      autoTrigger: form.autoTrigger
    });
    message("部署配置已保存", { type: "success" });
  } finally {
    saving.value = false;
  }
}

async function refreshStatus() {
  const res: any = await getDeployStatus();
  status.value = res.data || {};
}

async function onDeploy() {
  if (!form.workflowId) {
    message("请先配置 GitHub Actions 工作流", { type: "warning" });
    return;
  }
  deploying.value = true;
  try {
    await executeDeploy();
    message("已触发部署", { type: "success" });
    await refreshStatus();
  } finally {
    deploying.value = false;
  }
}

async function onReset() {
  await resetDeployStatus();
  await refreshStatus();
}

function openRun() {
  if (status.value?.runUrl) window.open(status.value.runUrl, "_blank");
}

const stageText: Record<string, string> = {
  idle: "空闲",
  triggering: "触发中",
  running: "运行中",
  success: "成功",
  failed: "失败"
};

onMounted(async () => {
  await loadConfig();
  await refreshStatus();
  timer = setInterval(refreshStatus, 8000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <div class="grid grid-cols-12 gap-4">
    <el-card class="col-span-7" shadow="never">
      <template #header>部署配置（GitHub Actions）</template>
      <el-form :model="form" label-width="140px">
        <el-form-item label="工作流 ID">
          <el-input
            v-model="form.workflowId"
            placeholder="如 deploy.yml 或工作流文件名"
          />
        </el-form-item>
        <el-form-item label="分支 ref">
          <el-input v-model="form.ref" placeholder="留空则使用仓库默认分支" />
        </el-form-item>
        <el-form-item label="内容变更后自动部署">
          <el-switch v-model="form.autoTrigger" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="save">
            保存配置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="col-span-5" shadow="never">
      <template #header>部署状态</template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="状态">
          <el-tag
            :type="
              status.stage === 'success'
                ? 'success'
                : status.stage === 'failed'
                  ? 'danger'
                  : 'info'
            "
          >
            {{ stageText[status.stage] || status.stage || "空闲" }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="进度">
          <el-progress :percentage="status.progress || 0" />
        </el-descriptions-item>
        <el-descriptions-item label="最近部署">
          {{
            status.lastDeployTime
              ? new Date(status.lastDeployTime).toLocaleString()
              : "-"
          }}
        </el-descriptions-item>
        <el-descriptions-item v-if="status.error" label="错误">
          <span class="text-red-500">{{ status.error }}</span>
        </el-descriptions-item>
      </el-descriptions>

      <div class="flex gap-2 mt-4">
        <el-button type="primary" :loading="deploying" @click="onDeploy">
          立即部署
        </el-button>
        <el-button @click="onReset">重置状态</el-button>
        <el-button
          v-if="status.runUrl"
          link
          type="primary"
          @click="openRun"
        >
          查看 GitHub 运行详情
        </el-button>
      </div>
    </el-card>
  </div>
</template>
