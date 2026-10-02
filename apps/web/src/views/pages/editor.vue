<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { message } from "@/utils/message";
import { getPage, createPage, updatePage } from "@/api/pages";

defineOptions({ name: "PageEditor" });

const route = useRoute();
const router = useRouter();
const id = ref(route.params.id as string | undefined);
const saving = ref(false);
const loading = ref(false);

const form = reactive({
  title: "",
  slug: "",
  date: "",
  description: "",
  content: "",
  status: "published" as string
});

async function load() {
  if (!id.value) return;
  loading.value = true;
  try {
    const res: any = await getPage(id.value);
    const p = res.data;
    form.title = p.title || "";
    form.slug = p.slug || "";
    form.content = p.content || "";
    form.status = p.status || "published";
    const fm = p.frontMatter || {};
    form.date = fm.date || "";
    form.description = fm.description || "";
  } finally {
    loading.value = false;
  }
}

function onTitleInput() {
  if (!id.value && !form.slug) {
    form.slug = form.title
      .trim()
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
}

async function save() {
  if (!form.title) {
    message("请输入标题", { type: "warning" });
    return;
  }
  saving.value = true;
  try {
    const payload = {
      title: form.title,
      slug: form.slug,
      content: form.content,
      frontMatter: { date: form.date, description: form.description },
      status: form.status
    };
    if (id.value) {
      await updatePage(id.value, payload);
    } else {
      await createPage(payload);
    }
    message("保存成功", { type: "success" });
    router.push("/pages/index");
  } finally {
    saving.value = false;
  }
}

function goBack() {
  router.push("/pages/index");
}

onMounted(load);
</script>

<template>
  <div v-loading="loading">
    <el-card shadow="never">
      <template #header>
        <div class="flex items-center justify-between">
          <span>{{ id ? "编辑页面" : "新建页面" }}</span>
          <div>
            <el-button @click="goBack">返回</el-button>
            <el-button type="primary" :loading="saving" @click="save">
              保存
            </el-button>
          </div>
        </div>
      </template>

      <el-form :model="form" label-width="90px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="标题" required>
              <el-input
                v-model="form.title"
                placeholder="页面标题"
                @input="onTitleInput"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="别名 slug">
              <el-input v-model="form.slug" placeholder="留空则按标题生成" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="日期">
              <el-date-picker
                v-model="form.date"
                type="datetime"
                placeholder="选择日期时间"
                value-format="YYYY-MM-DD HH:mm:ss"
                class="w-full"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-radio-group v-model="form.status">
                <el-radio value="draft">草稿</el-radio>
                <el-radio value="published">发布</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            placeholder="页面描述（可选）"
          />
        </el-form-item>

        <el-form-item label="正文">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="20"
            placeholder="支持 Markdown 语法"
            class="font-mono"
          />
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>
