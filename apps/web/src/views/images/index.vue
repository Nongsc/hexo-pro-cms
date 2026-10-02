<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import {
  getImages,
  presignImage,
  confirmImage,
  deleteImage,
  deleteImagesBatch,
  renameImage,
  moveImages,
  getImageFolders,
  getUnusedImages,
  cleanupUnusedImages
} from "@/api/images";

defineOptions({ name: "ImagesList" });

const loading = ref(false);
const uploading = ref(false);
const list = ref<any[]>([]);
const total = ref(0);
const folders = ref<string[]>([]);
const activeFolder = ref("");
const selected = ref<any[]>([]);
const query = reactive({ page: 1, pageSize: 24 });

async function loadFolders() {
  const res: any = await getImageFolders();
  folders.value = res.data || [];
}

async function load() {
  loading.value = true;
  try {
    const res: any = await getImages({
      page: query.page,
      pageSize: query.pageSize,
      folder: activeFolder.value || undefined
    });
    list.value = res.data?.list || [];
    total.value = res.data?.total || 0;
  } finally {
    loading.value = false;
  }
}

function onPageChange(p: number) {
  query.page = p;
  load();
}

function toggleSelect(img: any) {
  const idx = selected.value.findIndex(s => s.id === img.id);
  if (idx >= 0) selected.value.splice(idx, 1);
  else selected.value.push(img);
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp"
  };
  return map[mime] || "png";
}

function filenameFor(file: File): string {
  const name = (file.name || "").trim();
  if (name && name.includes(".")) return name;
  return `image-${Date.now()}.${extFromMime(file.type)}`;
}

async function putFileToCos(uploadUrl: string, file: File) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: file.type ? { "Content-Type": file.type } : {}
  });
  if (!res.ok) {
    throw new Error(`上传到 COS 失败 (HTTP ${res.status})`);
  }
}

async function doUpload(file: File) {
  uploading.value = true;
  try {
    // 1) 后端签发预签名 PUT URL
    const presignRes: any = await presignImage({
      filename: filenameFor(file),
      contentType: file.type || "application/octet-stream",
      folder: activeFolder.value || undefined
    });
    const { key, uploadUrl, filename } = presignRes.data;
    // 2) 浏览器直传 COS
    await putFileToCos(uploadUrl, file);
    // 3) 确认入库
    await confirmImage({
      key,
      filename,
      contentType: file.type || null,
      size: file.size,
      folder: activeFolder.value || ""
    });
    message("上传成功", { type: "success" });
    await Promise.all([load(), loadFolders()]);
  } catch (e: any) {
    message(e?.message || "上传失败", { type: "error" });
  } finally {
    uploading.value = false;
  }
}

async function onFileChange(file: any) {
  // el-upload 的 http-request 回调参数是 UploadRequestOptions，原始文件在 options.file
  const raw = (file?.file || file?.raw) as File;
  if (!raw) return;
  await doUpload(raw);
}

async function onPaste(e: ClipboardEvent) {
  const items = Array.from(e.clipboardData?.items || []);
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) await doUpload(file);
    }
  }
}

async function copyUrl(url: string) {
  await navigator.clipboard.writeText(url);
  message("已复制图片链接", { type: "success" });
}

async function onDelete(row: any) {
  await deleteImage(row.id);
  message("已删除", { type: "success" });
  load();
}

async function onRename(row: any) {
  const { value } = await ElMessageBox.prompt("请输入新文件名", "重命名", {
    inputValue: row.filename,
    confirmButtonText: "确定",
    cancelButtonText: "取消"
  });
  if (value) {
    await renameImage(row.id, value);
    message("已重命名", { type: "success" });
    load();
  }
}

async function onBatchDelete() {
  if (!selected.value.length) return;
  await deleteImagesBatch(selected.value.map(i => i.id));
  message("已批量删除", { type: "success" });
  load();
}

async function onMove(folder: string) {
  if (!selected.value.length) return;
  await moveImages(
    selected.value.map(i => i.id),
    folder
  );
  message("已移动", { type: "success" });
  load();
}

async function onCleanupUnused() {
  const res: any = await getUnusedImages();
  const unused = res.data?.list || [];
  if (!unused.length) {
    message("没有未引用的图片", { type: "info" });
    return;
  }
  await ElMessageBox.confirm(
    `发现 ${unused.length} 张未被文章/页面引用的图片，确认清理？`,
    "清理未引用图片",
    { type: "warning", confirmButtonText: "清理", cancelButtonText: "取消" }
  );
  const r: any = await cleanupUnusedImages();
  message(`已清理 ${r.data?.count ?? 0} 张图片`, { type: "success" });
  load();
}

onMounted(async () => {
  await Promise.all([loadFolders(), load()]);
});
</script>

<template>
  <div>
    <el-card shadow="never">
      <div class="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div class="flex items-center gap-2">
          <el-select
            v-model="activeFolder"
            placeholder="全部文件夹"
            clearable
            class="w-48"
            @change="load"
          >
            <el-option
              v-for="f in folders"
              :key="f"
              :label="f || '(根目录)'"
              :value="f"
            />
          </el-select>
          <el-button type="primary" :loading="uploading" @click="onCleanupUnused">
            清理未引用图片
          </el-button>
        </div>
        <div class="flex items-center gap-2">
          <el-button
            type="danger"
            :disabled="!selected.length"
            @click="onBatchDelete"
          >
            批量删除
          </el-button>
          <el-popover placement="bottom" width="220" trigger="click">
            <template #reference>
              <el-button :disabled="!selected.length">移动到…</el-button>
            </template>
            <div>
              <el-button
                link
                @click="onMove('')"
              >
                根目录
              </el-button>
              <el-button
                v-for="f in folders"
                :key="f"
                link
                @click="onMove(f)"
              >
                {{ f }}
              </el-button>
            </div>
          </el-popover>
          <el-upload
            :show-file-list="false"
            :http-request="onFileChange"
            accept="image/*"
          >
            <el-button type="primary">上传图片</el-button>
          </el-upload>
        </div>
      </div>

      <div class="text-gray-400 text-sm mb-2">
        提示：可直接在页面上粘贴图片（Ctrl+V）上传
      </div>

      <div
        v-loading="loading"
        class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4"
        @paste="onPaste"
      >
        <el-card
          v-for="img in list"
          :key="img.id"
          shadow="hover"
          class="image-card"
          :class="{ selected: selected.some(s => s.id === img.id) }"
          @click="toggleSelect(img)"
        >
          <el-image
            :src="img.url"
            fit="cover"
            class="w-full h-24 rounded"
            :preview-src-list="[img.url]"
            preview-teleported
          />
          <div class="mt-2 text-xs truncate">{{ img.filename }}</div>
          <div class="mt-2 flex justify-between">
            <el-button link size="small" type="primary" @click.stop="copyUrl(img.url)">
              复制
            </el-button>
            <el-button link size="small" @click.stop="onRename(img)">
              重命名
            </el-button>
            <el-button link size="small" type="danger" @click.stop="onDelete(img)">
              删除
            </el-button>
          </div>
        </el-card>
      </div>

      <div class="flex justify-end mt-4">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[24, 48, 96]"
          layout="total, prev, pager, next"
          @current-change="onPageChange"
          @size-change="load"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.image-card {
  cursor: pointer;
}
.image-card.selected {
  border-color: var(--el-color-primary);
}
</style>
