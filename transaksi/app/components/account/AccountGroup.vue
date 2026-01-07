<script setup lang="ts">
import draggable from 'vuedraggable';
import AccountTreeItem from './AccountTreeItem.vue';

defineProps<{
  title: string;
  color: string;
  list: any[];
  groupName: string;
  icon: string;
}>();

const emit = defineEmits(['edit', 'remove', 'change', 'move']);

const onRootChange = (event: any, groupName: string) => {
  if (event.added) {
    emit('move', {
      item: event.added.element,
      newParentUuid: null,
      newCategory: groupName
    });
  }
};
</script>

<template>
  <div class="bg-surface-0 rounded-xl border border-surface-200 shadow-sm flex flex-col h-full overflow-hidden transition-all hover:shadow-md hover:border-gray-300">
    
    <div :class="`bg-${color}-50 border-b border-${color}-100 px-3 py-2.5 flex justify-between items-center`">
      <div class="flex items-center gap-2.5">
        <div :class="`w-6 h-6 flex items-center justify-center rounded-md bg-${color}-100 text-${color}-600 shadow-sm`">
          <i :class="`pi ${icon} text-xs font-bold`"></i>
        </div>
        <span :class="`font-bold text-${color}-900 text-xs uppercase tracking-wide`">{{ title }}</span>
      </div>
      <span class="text-[10px] font-mono bg-surface-0 px-2 py-0.5 rounded border border-surface-200 text-gray-500">
        {{ list.length }}
      </span>
    </div>
    
    <div class="p-2 bg-surface-0 flex-1 min-h-[100px] relative">
      <draggable 
        :list="list" 
        group="accounts" 
        item-key="uuid"
        @change="onRootChange($event, groupName)"
        class="h-full space-y-1 pb-4" 
        ghost-class="sortable-ghost"
        drag-class="sortable-drag"
        animation="200"
      >
        <template #item="{ element }">
          <AccountTreeItem 
            :element="element" 
            :color="color"
            @edit="$emit('edit', $event)"
            @remove="$emit('remove', $event)"
            @move="$emit('move', $event)"
          />
        </template>
      </draggable>

      <div v-if="list.length === 0" class="absolute inset-0 flex flex-col items-center justify-center text-gray-300 pointer-events-none">
        <i class="pi pi-inbox text-xl mb-1 opacity-50"></i>
        <span class="text-[10px] font-medium opacity-60">Kosong</span>
      </div>
    </div>
  </div>
</template>

<style>
/* Global styles for drag states needed by vuedraggable */
.sortable-ghost {
  opacity: 0.5;
  background-color: #f8fafc;
  border: 1px dashed #94a3b8;
  transform: scale(0.98);
}
.sortable-drag {
  cursor: grabbing;
  opacity: 1 !important;
  background: white;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  border-radius: 0.5rem;
  z-index: 9999;
}
</style>