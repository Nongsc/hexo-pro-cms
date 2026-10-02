<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  getDashboardStats,
  getDashboardCategories,
  getDashboardTags,
  getRecentPosts,
  getSystemInfo,
  getTodos,
  addTodo,
  toggleTodo,
  deleteTodo
} from "@/api/dashboard";

defineOptions({ name: "Welcome" });

const router = useRouter();
const stats = ref<any>({});
const categories = ref<any[]>([]);
const tags = ref<any[]>([]);
const recent = ref<any[]>([]);
const todos = ref<any[]>([]);
const system = ref<any>({});
const newTodo = ref("");
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const [s, c, t, r, sys, td] = await Promise.all([
      getDashboardStats(),
      getDashboardCategories(),
      getDashboardTags(),
      getRecentPosts(5),
      getSystemInfo(),
      getTodos()
    ]);
    stats.value = s.data || {};
    categories.value = c.data || [];
    tags.value = t.data || [];
    recent.value = r.data || [];
    system.value = sys.data || {};
    todos.value = td.data || [];
  } finally {
    loading.value = false;
  }
}

async function onAddTodo() {
  if (!newTodo.value.trim()) return;
  await addTodo(newTodo.value.trim());
  newTodo.value = "";
  const res: any = await getTodos();
  todos.value = res.data || [];
}

async function onToggle(todo: any) {
  await toggleTodo(todo.id);
  const res: any = await getTodos();
  todos.value = res.data || [];
}

async function onDeleteTodo(todo: any) {
  await deleteTodo(todo.id);
  const res: any = await getTodos();
  todos.value = res.data || [];
}

function goPosts() {
  router.push("/posts/index");
}

onMounted(load);
</script>

<template>
  <div v-loading="loading">
    <el-row :gutter="16">
      <el-col v-for="card in [
        { label: '已发布文章', value: stats.published || 0, type: 'success' },
        { label: '草稿', value: stats.draft || 0, type: 'info' },
        { label: '页面', value: stats.pages || 0, type: 'primary' },
        { label: '回收站', value: stats.discarded || 0, type: 'warning' }
      ]" :key="card.label" :span="6">
        <el-card shadow="hover" class="mb-4">
          <div class="text-gray-500 text-sm">{{ card.label }}</div>
          <div class="text-3xl font-bold mt-2">{{ card.value }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="14">
        <el-card shadow="never" class="mb-4">
          <template #header>
            <div class="flex justify-between items-center">
              <span>最近文章</span>
              <el-button link type="primary" @click="goPosts">查看全部</el-button>
            </div>
          </template>
          <el-table :data="recent" size="small">
            <el-table-column prop="title" label="标题" min-width="200">
              <template #default="{ row }">
                <el-link type="primary" @click="$router.push(`/posts/editor/${row.id}`)">
                  {{ row.title }}
                </el-link>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag size="small" :type="row.status === 'published' ? 'success' : 'info'">
                  {{ row.status === "published" ? "已发布" : "草稿" }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="更新时间" width="170">
              <template #default="{ row }">
                {{ row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "-" }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card shadow="never">
          <template #header>分类 / 标签</template>
          <div class="mb-2">
            <span class="text-gray-500 text-sm mr-2">分类</span>
            <el-tag
              v-for="c in categories.slice(0, 12)"
              :key="c.name"
              type="warning"
              size="small"
              class="mr-1 mb-1"
            >
              {{ c.name }} ({{ c.count }})
            </el-tag>
          </div>
          <div>
            <span class="text-gray-500 text-sm mr-2">标签</span>
            <el-tag
              v-for="t in tags.slice(0, 20)"
              :key="t.name"
              type="info"
              size="small"
              class="mr-1 mb-1"
            >
              {{ t.name }} ({{ t.count }})
            </el-tag>
          </div>
        </el-card>
      </el-col>

      <el-col :span="10">
        <el-card shadow="never" class="mb-4">
          <template #header>待办事项</template>
          <div class="flex gap-2 mb-3">
            <el-input
              v-model="newTodo"
              placeholder="添加待办…"
              @keyup.enter="onAddTodo"
            />
            <el-button type="primary" @click="onAddTodo">添加</el-button>
          </div>
          <div
            v-for="t in todos"
            :key="t.id"
            class="flex items-center justify-between py-1 border-b last:border-0"
          >
            <div class="flex items-center gap-2">
              <el-checkbox :model-value="t.done" @change="onToggle(t)" />
              <span :class="{ 'line-through text-gray-400': t.done }">
                {{ t.content }}
              </span>
            </div>
            <el-button link type="danger" size="small" @click="onDeleteTodo(t)">
              删除
            </el-button>
          </div>
        </el-card>

        <el-card shadow="never">
          <template #header>系统状态</template>
          <el-descriptions :column="1" size="small">
            <el-descriptions-item label="GitHub 连接">
              <el-tag :type="system.github?.token ? 'success' : 'danger'" size="small">
                {{ system.github?.token ? "已连接" : "未配置" }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="COS 图床">
              <el-tag :type="system.cos?.secretId ? 'success' : 'danger'" size="small">
                {{ system.cos?.secretId ? "已配置" : "未配置" }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="仓库">
              {{ system.github?.owner }}/{{ system.github?.repo || "-" }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>
