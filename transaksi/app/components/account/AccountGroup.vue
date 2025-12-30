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
  <div class="bg-surface-0 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden flex flex-col h-full transition-all hover:shadow-lg">
    <div :class="`bg-${color}-50/50 border-b border-${color}-100/50 p-4 flex justify-between items-center backdrop-blur-sm`">
      <div class="flex items-center gap-3">
        <div :class="`p-1.5 rounded-lg bg-${color}-100 text-${color}-600`">
          <i :class="`pi ${icon} text-sm`"></i>
        </div>
        <span :class="`font-bold text-${color}-900 text-sm tracking-wide`">{{ title }}</span>
      </div>
      <span class="text-[10px] font-mono font-medium bg-white px-2.5 py-1 rounded-md text-gray-500 border border-gray-200/60 shadow-sm">
        {{ list.length }} Item
      </span>
    </div>
    
    <div class="p-3 bg-white min-h-[150px] h-full relative">
      <draggable 
        :list="list" 
        group="accounts" 
        item-key="uuid"
        @change="onRootChange($event, groupName)"
        class="space-y-2 min-h-[140px] h-full"
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
        <div class="bg-gray-50 p-4 rounded-full mb-2">
          <i class="pi pi-inbox text-2xl"></i>
        </div>
        <span class="text-xs font-medium">Belum ada akun</span>
      </div>
    </div>
  </div>
</template>

<style>
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
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  transform: rotate(1deg);
}
</style>