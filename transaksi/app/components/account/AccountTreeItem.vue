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
  <div class="relative font-sans text-gray-700">
    <div 
      class="group relative bg-surface-0 border border-surface-200/60 rounded-lg hover:border-indigo-400 hover:shadow-sm transition-all duration-200 cursor-move flex items-center justify-between mb-1 py-1.5 px-2"
    >
      <div class="flex items-center gap-2 overflow-hidden flex-1">
        <button 
          v-if="hasChildren" 
          @click.stop="isOpen = !isOpen" 
          class="w-4 h-4 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors shrink-0"
        >
          <i :class="isOpen ? 'pi pi-angle-down' : 'pi pi-angle-right'" class="text-[10px] font-bold"></i>
        </button>
        <div v-else class="w-4 shrink-0"></div> 

        <div :class="`h-6 w-1 rounded-full bg-${color}-500/80 shrink-0`"></div>
        
        <div class="truncate flex items-center gap-2">
           <span class="font-mono text-[10px] font-bold text-gray-600 bg-gray-100/80 px-1.5 py-0.5 rounded border border-surface-200 tracking-tight shrink-0">
              {{ element.code }}
            </span>
            <span class="font-medium text-xs truncate group-hover:text-indigo-700 transition-colors" :title="element.name">
              {{ element.name }}
            </span>
            <span v-if="element.isSystem" class="text-[8px] uppercase tracking-wider bg-gray-800 text-white px-1 py-px rounded font-bold shadow-sm shrink-0">
              SYS
            </span>
        </div>
      </div>

      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute right-1 bg-surface-0 pl-2 backdrop-blur-[2px] shadow-[-8px_0_12px_rgba(255,255,255,1)]">
        <button @click.stop="$emit('edit', element)" class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Edit">
          <i class="pi pi-pencil text-[10px]"></i>
        </button>
        <button v-if="!element.isSystem" @click.stop="$emit('remove', element.uuid)" class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Hapus">
          <i class="pi pi-trash text-[10px]"></i>
        </button>
        <div class="w-5 h-6 flex items-center justify-center text-gray-300 cursor-move">
          <i class="pi pi-bars text-[10px]"></i>
        </div>
      </div>
    </div>

    <div v-if="isOpen && hasChildren" class="pl-3 ml-2.5 border-l border-dashed border-gray-200">
      <draggable
        :list="element.children"
        group="accounts"
        item-key="uuid"
        class="min-h-[5px] space-y-1 pt-1"
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

<style scoped>
/* Scoped style agar tidak bocor */
.sortable-ghost {
  opacity: 0.4;
  background-color: #f1f5f9; /* Slate-100 */
  border: 1px dashed #cbd5e1;
}
</style>