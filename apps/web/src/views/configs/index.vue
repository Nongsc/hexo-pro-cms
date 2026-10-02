<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import {
  getConfigFiles,
  getConfigFile,
  saveConfigFile,
  getConfigSnapshots,
  rollbackConfig
} from "@/api/configs";

defineOptions({ name: "ConfigsIndex" });

const files = ref<any[]>([]);
const activeFile = ref("");
const content = ref("");
const loading = ref(false);
const saving = ref(false);
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
    content.value = res.data?.content || "";
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

async function save() {
  saving.value = true;
  try {
    await saveConfigFile(activeFile.value, content.value);
    message("配置已保存到 GitHub", { type: "success" });
    await loadSnapshots();
  } finally {
    saving.value = false;
  }
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
          <span>{{ activeFile || "配置内容" }}</span>
          <el-button type="primary" :loading="saving" @click="save">
            保存到 GitHub
          </el-button>
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
