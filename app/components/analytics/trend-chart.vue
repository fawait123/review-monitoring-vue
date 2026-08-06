<script setup lang="ts">
import { computed } from "vue";
import { VChart, STATE_COLORS, STATE_LABEL, AXIS_COLOR, SPLIT_LINE, TOOLTIP_STYLE } from "~/utils/echarts";

const props = defineProps<{ data: { week: string; OPEN: number; MERGED: number; CLOSED: number }[] }>();

const ready = ref(false);
onMounted(() => requestAnimationFrame(() => (ready.value = true)));

const option = computed(() => ({
  tooltip: { trigger: "axis", ...TOOLTIP_STYLE },
  legend: { bottom: 0, textStyle: { color: AXIS_COLOR }, itemWidth: 12, itemHeight: 8 },
  grid: { left: 8, right: 16, top: 10, bottom: 32 },
  xAxis: { type: "category", data: props.data.map((d) => d.week), axisLabel: { color: AXIS_COLOR, fontSize: 10 } },
  yAxis: { type: "value", minInterval: 1, axisLabel: { color: AXIS_COLOR, fontSize: 11 }, splitLine: { lineStyle: { color: SPLIT_LINE } } },
  series: [
    { name: STATE_LABEL.OPEN, type: "line", stack: "1", data: props.data.map((d) => d.OPEN), smooth: true, showSymbol: false, lineStyle: { width: 1.5 }, areaStyle: { opacity: 0.5 }, itemStyle: { color: STATE_COLORS.OPEN } },
    { name: STATE_LABEL.MERGED, type: "line", stack: "1", data: props.data.map((d) => d.MERGED), smooth: true, showSymbol: false, lineStyle: { width: 1.5 }, areaStyle: { opacity: 0.5 }, itemStyle: { color: STATE_COLORS.MERGED } },
    { name: STATE_LABEL.CLOSED, type: "line", stack: "1", data: props.data.map((d) => d.CLOSED), smooth: true, showSymbol: false, lineStyle: { width: 1.5 }, areaStyle: { opacity: 0.5 }, itemStyle: { color: STATE_COLORS.CLOSED } },
  ],
}));
</script>

<template>
  <div v-if="ready" class="h-[300px] w-full">
    <VChart class="h-full w-full" :option="option" autoresize />
  </div>
</template>
