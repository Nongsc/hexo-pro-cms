<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import {
  getRecycleList,
  getRecycleStats,
  restoreRecycle,
  deleteRecycle,
  emptyRecycle
} from "@/api/recycle";

defineOptions({ name: "RecycleIndex" });

const loading = ref(false);
const list = ref<any[]>([]);
const stats = ref<any>({});

async function load() {
  loading.value = true;
  try {
    const [l, s] = await Promise.all([getRecycleList(), getRecycleStats()]);
    list.value = l.data || [];
    stats.value = s.data || {};
  } finally {
    loading.value = false;
  }
}

async function onRestore(row: any) {
  await restoreRecycle(row.id);
  message("已恢复", { type: "success" });
  load();
}

async function onDelete(row: any) {
  await deleteRecycle(row.id);
  message("已彻底删除", { type: "success" });
  load();
}

async function onEmpty() {
  await ElMessageBox.confirm("确认清空回收站？此操作不可恢复。", "清空回收站", {
    type: "warning",
    confirmButtonText: "清空",
    cancelButtonText: "取消"
  });
  await emptyRecycle();
  message("回收站已清空", { type: "success" });
  load();
}

onMounted(load);
</script>

<template>
  <div>
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span>
            回收站（文章 {{ stats.post || 0 }} · 页面 {{ stats.page || 0 }}）
          </span>
          <el-button
            type="danger"
            :disabled="!list.length"
            @click="onEmpty"
          >
            清空回收站
          </el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.type === 'post' ? 'primary' : 'success'" size="small">
              {{ row.type === "post" ? "文章" : "页面" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="220" />
        <el-table-column prop="githubPath" label="仓库路径" min-width="220" />
        <el-table-column label="删除时间" width="180">
          <template #default="{ row }">
            {{ new Date(row.deletedAt).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="onRestore(row)">
              恢复
            </el-button>
            <el-button link type="danger" @click="onDelete(row)">
              彻底删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && !list.length" description="回收站为空" />
    </el-card>
  </div>
</template>
