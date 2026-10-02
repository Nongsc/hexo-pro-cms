<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";
import {
  getPosts,
  deletePost,
  publishPost,
  unpublishPost,
  syncPosts
} from "@/api/posts";

defineOptions({ name: "PostsList" });

const router = useRouter();
const loading = ref(false);
const syncing = ref(false);
const list = ref<any[]>([]);
const total = ref(0);
const activeStatus = ref("all");
const keyword = ref("");

const query = reactive({ page: 1, pageSize: 12 });

const statusMap: Record<string, { label: string; type: any }> = {
  published: { label: "已发布", type: "success" },
  draft: { label: "草稿", type: "info" },
  discarded: { label: "已删除", type: "danger" }
};

async function load() {
  loading.value = true;
  try {
    const res: any = await getPosts({
      status: activeStatus.value,
      page: query.page,
      pageSize: query.pageSize,
      keyword: keyword.value || undefined
    });
    list.value = res.data?.list || [];
    total.value = res.data?.total || 0;
  } finally {
    loading.value = false;
  }
}

function search() {
  query.page = 1;
  load();
}

function switchStatus(s: string) {
  activeStatus.value = s;
  query.page = 1;
  load();
}

function onPageChange(p: number) {
  query.page = p;
  load();
}

function goCreate() {
  router.push("/posts/editor");
}

function goEdit(id: string) {
  router.push(`/posts/editor/${id}`);
}

async function onPublish(row: any) {
  await publishPost(row.id);
  message("已发布", { type: "success" });
  load();
}

async function onUnpublish(row: any) {
  await unpublishPost(row.id);
  message("已转为草稿", { type: "success" });
  load();
}

async function onDelete(row: any) {
  await deletePost(row.id);
  message("已移入回收站", { type: "success" });
  load();
}

async function onSync() {
  syncing.value = true;
  try {
    const res: any = await syncPosts();
    message(`已从 GitHub 同步 ${res.data?.imported ?? 0} 篇文章`, {
      type: "success"
    });
    load();
  } finally {
    syncing.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <el-card shadow="never">
      <div class="flex items-center justify-between flex-wrap gap-3 mb-4">
        <el-radio-group
          v-model="activeStatus"
          @change="switchStatus(activeStatus)"
        >
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="published">已发布</el-radio-button>
          <el-radio-button value="draft">草稿</el-radio-button>
        </el-radio-group>

        <div class="flex items-center gap-2">
          <el-input
            v-model="keyword"
            placeholder="搜索标题/内容"
            clearable
            class="w-56"
            @keyup.enter="search"
            @clear="search"
          />
          <el-button type="primary" @click="search">搜索</el-button>
          <el-button :loading="syncing" @click="onSync">从 GitHub 同步</el-button>
          <el-button type="primary" @click="goCreate">新建文章</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" stripe>
        <el-table-column prop="title" label="标题" min-width="220">
          <template #default="{ row }">
            <el-link type="primary" @click="goEdit(row.id)">{{
              row.title
            }}</el-link>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusMap[row.status]?.type" size="small">
              {{ statusMap[row.status]?.label || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="分类" width="180">
          <template #default="{ row }">
            <el-tag
              v-for="c in row.categories"
              :key="c"
              size="small"
              type="warning"
              class="mr-1"
            >
              {{ c }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="标签" min-width="180">
          <template #default="{ row }">
            <el-tag
              v-for="t in row.tags"
              :key="t"
              size="small"
              type="info"
              class="mr-1"
            >
              {{ t }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="180">
          <template #default="{ row }">
            {{ row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "-" }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="goEdit(row.id)">
              编辑
            </el-button>
            <el-button
              v-if="row.status === 'draft'"
              link
              type="success"
              @click="onPublish(row)"
            >
              发布
            </el-button>
            <el-button
              v-else-if="row.status === 'published'"
              link
              type="warning"
              @click="onUnpublish(row)"
            >
              转为草稿
            </el-button>
            <el-button link type="danger" @click="onDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="flex justify-end mt-4">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[12, 24, 48]"
          layout="total, sizes, prev, pager, next"
          @current-change="onPageChange"
          @size-change="load"
        />
      </div>
    </el-card>
  </div>
</template>
