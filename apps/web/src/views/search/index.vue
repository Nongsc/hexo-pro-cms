<script setup lang="ts">
import { ref } from "vue";
import { searchPosts } from "@/api/posts";

defineOptions({ name: "SearchIndex" });

const q = ref("");
const loading = ref(false);
const results = ref<any[]>([]);

async function onSearch() {
  if (!q.value.trim()) return;
  loading.value = true;
  try {
    const res: any = await searchPosts(q.value.trim());
    results.value = res.data || [];
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <el-card shadow="never">
      <div class="flex items-center gap-2 mb-4">
        <el-input
          v-model="q"
          placeholder="输入关键词搜索文章标题与内容"
          clearable
          class="max-w-xl"
          @keyup.enter="onSearch"
        />
        <el-button type="primary" @click="onSearch">搜索</el-button>
      </div>

      <div v-loading="loading">
        <el-empty v-if="!loading && !results.length" description="暂无结果" />
        <div
          v-for="r in results"
          :key="r.id"
          class="p-4 mb-3 border rounded hover:shadow cursor-pointer"
          @click="$router.push(`/posts/editor/${r.id}`)"
        >
          <div class="flex items-center gap-2 mb-1">
            <span class="font-medium">{{ r.title }}</span>
            <el-tag size="small" :type="r.status === 'published' ? 'success' : 'info'">
              {{ r.status === "published" ? "已发布" : "草稿" }}
            </el-tag>
          </div>
          <div class="text-sm text-gray-500" v-html="r.context" />
        </div>
      </div>
    </el-card>
  </div>
</template>
