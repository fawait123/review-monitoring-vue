<script setup lang="ts">
import { computed } from "vue";
import { VChart, AXIS_COLOR, SPLIT_LINE, TOOLTIP_STYLE } from "~/utils/echarts";

const props = defineProps<{ data: { author: string; count: number }[] }>();

const ready = ref(false);
onMounted(() => requestAnimationFrame(() => (ready.value = true)));

const option = computed(() => ({
  tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, ...TOOLTIP_STYLE },
  grid: { left: 8, right: 16, top: 10, bottom: 64 },
  xAxis: {
    type: "category",
    data: props.data.map((d) => d.author),
    axisLabel: { color: AXIS_COLOR, fontSize: 11, interval: 0, rotate: 30 },
  },
  yAxis: { type: "value", minInterval: 1, axisLabel: { color: AXIS_COLOR, fontSize: 11 }, splitLine: { lineStyle: { color: SPLIT_LINE } } },
  series: [
    { name: "PR", type: "bar", data: props.data.map((d) => d.count), itemStyle: { color: "#10b981", borderRadius: [4, 4, 0, 0] }, barMaxWidth: 28 },
  ],
}));
</script>

<template>
  <div v-if="ready" class="h-[320px] w-full">
    <VChart class="h-full w-full" :option="option" autoresize />
  </div>
</template>
