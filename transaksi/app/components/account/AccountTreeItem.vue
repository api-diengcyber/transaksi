<script setup lang="ts">
import { computed, ref } from 'vue';
import draggable from 'vuedraggable';

const props = defineProps<{
  element: any;
  color: string;
  parentId?: string;
}>();

const emit = defineEmits(['edit', 'remove', 'move']);
const isOpen = ref(true); 
const hasChildren = computed(() => props.element.children && props.element.children.length > 0);

const onChildChange = (event: any) => {
  if (event.added) {
    emit('move', {
      item: event.added.element,
      newParentUuid: props.element.uuid,
      newCategory: props.element.category 
    });
  }
};
</script>

<template>
  <div class="relative">
    <div 
      class="group relative bg-surface-0 border border-gray-100 hover:border-indigo-300 rounded-xl p-2.5 transition-all duration-200 hover:shadow-md cursor-move flex items-center justify-between mb-2"
    >
      <div class="flex items-center gap-3 overflow-hidden flex-1">
        <button 
          v-if="hasChildren" 
          @click.stop="isOpen = !isOpen" 
          class="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <i :class="isOpen ? 'pi pi-angle-down' : 'pi pi-angle-right'" class="text-xs font-bold"></i>
        </button>
        <div v-else class="w-5"></div> 

        <div :class="`h-8 w-1.5 rounded-full bg-${color}-500/80 shrink-0`"></div>
        
        <div class="truncate flex flex-col">
          <div class="flex items-center gap-2">
            <span class="font-mono text-[10px] font-bold text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 tracking-tight">
              {{ element.code }}
            </span>
            <span v-if="element.isSystem" class="text-[9px] bg-gray-800 text-white px-1.5 py-0.5 rounded-md font-bold shadow-sm">SYS</span>
          </div>
          <div class="font-semibold text-gray-700 text-sm mt-0.5 truncate group-hover:text-indigo-700 transition-colors">
            {{ element.name }}
          </div>
        </div>
      </div>

      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 absolute right-2 bg-surface-0/90 pl-2 backdrop-blur-[1px] shadow-[-8px_0_12px_rgba(255,255,255,1)]">
        <button @click.stop="$emit('edit', element)" class="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
          <i class="pi pi-pencil text-xs"></i>
        </button>
        <button v-if="!element.isSystem" @click.stop="$emit('remove', element.uuid)" class="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
          <i class="pi pi-trash text-xs"></i>
        </button>
        <div class="w-7 h-7 flex items-center justify-center text-gray-300 cursor-move">
          <i class="pi pi-bars text-xs"></i>
        </div>
      </div>
    </div>

    <div v-if="isOpen" class="pl-4 ml-3 border-l-2 border-dashed border-gray-100">
      <draggable
        :list="element.children"
        group="accounts"
        item-key="uuid"
        class="min-h-[10px] space-y-2 py-1"
        ghost-class="sortable-ghost"
        @change="onChildChange"
      >
        <template #item="{ element: child }">
          <AccountTreeItem 
            :element="child" 
            :color="color" 
            :parent-id="element.uuid"
            @edit="$emit('edit', $event)"
            @remove="$emit('remove', $event)"
            @move="$emit('move', $event)"
          />
        </template>
      </draggable>
    </div>
  </div>
</template>