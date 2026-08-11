<script setup lang="ts">
import { computed } from "vue";
import { VChart, STATE_COLORS, STATE_LABEL, TOOLTIP_STYLE } from "~/utils/echarts";

const props = defineProps<{ data: { state: string; count: number }[] }>();

const ready = ref(false);
onMounted(() => requestAnimationFrame(() => (ready.value = true)));

const option = computed(() => ({
  tooltip: {
    trigger: "item",
    ...TOOLTIP_STYLE,
    formatter: (p: any) => `${STATE_LABEL[p.name] ?? p.name}: ${p.value} (${p.percent}%)`,
  },
  legend: { bottom: 0, textStyle: { color: "#94a3b8" }, itemWidth: 12, itemHeight: 8 },
  series: [
    {
      type: "pie",
      radius: ["55%", "80%"],
      padAngle: 3,
      avoidLabelOverlap: true,
      label: { show: false },
      data: props.data.map((d) => ({
        name: d.state,
        value: d.count,
        itemStyle: { color: STATE_COLORS[d.state] ?? "#64748b" },
      })),
    },
  ],
}));
</script>

<template>
  <div v-if="ready" class="h-65 w-full">
    <VChart class="h-full w-full" :option="option" autoresize />
  </div>
</template>
