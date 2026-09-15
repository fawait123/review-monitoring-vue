<script setup lang="ts">
import { computed } from "vue";
import { VChart, AXIS_COLOR, SPLIT_LINE, TOOLTIP_STYLE } from "~/utils/echarts";

const props = defineProps<{ data: { author: string; commentCount: number; repoCount: number; prCount: number }[] }>();

const ready = ref(false);
onMounted(() => requestAnimationFrame(() => (ready.value = true)));

const option = computed(() => ({
  tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, ...TOOLTIP_STYLE },
  legend: { top: 0, textStyle: { color: AXIS_COLOR, fontSize: 11 } },
  grid: { left: 8, right: 16, top: 32, bottom: 70 },
  xAxis: {
    type: "category",
    data: props.data.map((d) => d.author),
    axisLabel: { color: AXIS_COLOR, fontSize: 11, interval: 0, rotate: 30 },
  },
  yAxis: { type: "value", minInterval: 1, axisLabel: { color: AXIS_COLOR, fontSize: 11 }, splitLine: { lineStyle: { color: SPLIT_LINE } } },
  series: [
    {
      name: "Total Komentar",
      type: "line",
      smooth: true,
      symbolSize: 7,
      data: props.data.map((d) => d.commentCount),
      itemStyle: { color: "#f59e0b" },
      lineStyle: { width: 2 },
    },
    {
      name: "Total Repo",
      type: "line",
      smooth: true,
      symbolSize: 7,
      data: props.data.map((d) => d.repoCount),
      itemStyle: { color: "#10b981" },
      lineStyle: { width: 2 },
    },
    {
      name: "Total PR",
      type: "line",
      smooth: true,
      symbolSize: 7,
      data: props.data.map((d) => d.prCount),
      itemStyle: { color: "#3b82f6" },
      lineStyle: { width: 2 },
    },
  ],
}));
</script>

<template>
  <div v-if="ready" class="h-65 w-full">
    <VChart class="h-full w-full" :option="option" autoresize />
  </div>
</template>