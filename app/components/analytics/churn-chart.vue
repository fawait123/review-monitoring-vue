<script setup lang="ts">
import { computed } from "vue";
import { VChart, AXIS_COLOR, SPLIT_LINE, TOOLTIP_STYLE } from "~/utils/echarts";

const props = defineProps<{ data: { repo: string; additions: number; deletions: number }[] }>();

const ready = ref(false);
onMounted(() => requestAnimationFrame(() => (ready.value = true)));

const option = computed(() => ({
  tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, ...TOOLTIP_STYLE },
  legend: { bottom: 0, textStyle: { color: AXIS_COLOR }, itemWidth: 12, itemHeight: 8 },
  grid: { left: 180, right: 16, top: 10, bottom: 32 },
  xAxis: { type: "value", axisLabel: { color: AXIS_COLOR, fontSize: 11 }, splitLine: { lineStyle: { color: SPLIT_LINE } } },
  yAxis: {
    type: "category",
    data: props.data.map((d) => d.repo),
    axisLabel: { color: AXIS_COLOR, fontSize: 10, formatter: (v: string) => (v.length > 20 ? v.slice(0, 19) + "…" : v) },
  },
  series: [
    {
      name: "Additions",
      type: "bar",
      stack: "a",
      data: props.data.map((d) => d.additions),
      itemStyle: { color: "#10b981" },
    },
    {
      name: "Deletions",
      type: "bar",
      stack: "a",
      data: props.data.map((d) => d.deletions),
      itemStyle: { color: "#ef4444", borderRadius: [0, 4, 4, 0] },
    },
  ],
}));
</script>

<template>
  <div v-if="ready" class="h-80 w-full">
    <VChart class="h-full w-full" :option="option" autoresize />
  </div>
</template>
