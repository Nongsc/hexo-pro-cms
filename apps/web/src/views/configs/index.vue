<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import {
  getConfigFiles,
  getConfigFile,
  saveConfigDraft,
  publishConfig,
  discardConfigDraft,
  getConfigSnapshots,
  rollbackConfig
} from "@/api/configs";

defineOptions({ name: "ConfigsIndex" });

const files = ref<any[]>([]);
const activeFile = ref("");
const content = ref("");
const loading = ref(false);
const saving = ref(false);
const publishing = ref(false);
const hasDraft = ref(false);
const snapshots = ref<any[]>([]);
const snapshotsLoading = ref(false);

async function loadFiles() {
  const res: any = await getConfigFiles();
  files.value = res.data || [];
  if (!activeFile.value && files.value.length) {
    activeFile.value = files.value[0].path;
  }
  if (activeFile.value) await openFile();
}

async function openFile() {
  if (!activeFile.value) return;
  loading.value = true;
  try {
    const res: any = await getConfigFile(activeFile.value);
    const d = res.data || {};
    // 有未发布草稿时优先展示草稿
    content.value = d.hasDraft ? d.draft ?? "" : d.content ?? "";
    hasDraft.value = !!d.hasDraft;
    await loadSnapshots();
  } finally {
    loading.value = false;
  }
}

async function loadSnapshots() {
  snapshotsLoading.value = true;
  try {
    const res: any = await getConfigSnapshots(`file:${activeFile.value}`);
    snapshots.value = res.data || [];
  } finally {
    snapshotsLoading.value = false;
  }
}

async function onSaveDraft() {
  saving.value = true;
  try {
    await saveConfigDraft(activeFile.value, content.value);
    hasDraft.value = true;
    message("草稿已保存到数据库（尚未推送到 GitHub）", { type: "success" });
  } finally {
    saving.value = false;
  }
}

async function onPublish() {
  publishing.value = true;
  try {
    await publishConfig(activeFile.value);
    hasDraft.value = false;
    message("配置已发布到 GitHub", { type: "success" });
    await loadSnapshots();
  } finally {
    publishing.value = false;
  }
}

async function onDiscardDraft() {
  await ElMessageBox.confirm("确认丢弃未发布的草稿？", "丢弃草稿", {
    type: "warning",
    confirmButtonText: "丢弃",
    cancelButtonText: "取消"
  });
  await discardConfigDraft(activeFile.value);
  hasDraft.value = false;
  const res: any = await getConfigFile(activeFile.value);
  content.value = res.data?.content || "";
  message("草稿已丢弃", { type: "success" });
}

async function onRollback(snap: any) {
  await ElMessageBox.confirm(
    `确认回滚到 ${new Date(snap.createdAt).toLocaleString()} 的快照？当前内容将被覆盖。`,
    "回滚配置",
    { type: "warning", confirmButtonText: "回滚", cancelButtonText: "取消" }
  );
  await rollbackConfig(snap.id);
  message("已回滚", { type: "success" });
  await openFile();
}

onMounted(loadFiles);
</script>

<template>
  <div class="grid grid-cols-12 gap-4">
    <el-card class="col-span-3" shadow="never">
      <template #header>配置文件</template>
      <el-menu
        :default-active="activeFile"
        @select="
          v => {
            activeFile = v;
            openFile();
          }
        "
      >
        <el-menu-item v-for="f in files" :key="f.path" :index="f.path">
          {{ f.name }}
        </el-menu-item>
      </el-menu>
      <el-empty v-if="!files.length" description="未找到 _config*.yml 文件" />
    </el-card>

    <el-card class="col-span-9" shadow="never" v-loading="loading">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="flex items-center gap-2">
            {{ activeFile || "配置内容" }}
            <el-tag v-if="hasDraft" type="warning" size="small">
              有未发布草稿
            </el-tag>
          </span>
          <div class="flex gap-2">
            <el-button v-if="hasDraft" @click="onDiscardDraft">
              丢弃草稿
            </el-button>
            <el-button :loading="saving" @click="onSaveDraft">
              保存草稿
            </el-button>
            <el-button type="primary" :loading="publishing" @click="onPublish">
              发布到 GitHub
            </el-button>
          </div>
        </div>
      </template>
      <el-input
        v-model="content"
        type="textarea"
        :rows="24"
        class="font-mono"
        placeholder="YAML 配置内容"
      />
    </el-card>

    <el-card
      v-if="snapshots.length"
      class="col-span-12"
      shadow="never"
      v-loading="snapshotsLoading"
    >
      <template #header>配置快照（保存前自动记录）</template>
      <el-table :data="snapshots" size="small">
        <el-table-column label="时间" width="200">
          <template #default="{ row }">
            {{ new Date(row.createdAt).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column prop="note" label="备注" min-width="200" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="warning" @click="onRollback(row)">
              回滚
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
