import type { EChartsOption } from 'echarts';
import type { Ref } from 'vue';
import {
  tryOnUnmounted,
  useDebounceFn,
  useEventListener,
  unrefElement,
  MaybeElementRef,
  whenever,
} from '@vueuse/core';

import { warn } from '/@/utils/log';
import echarts from '/@/utils/lib/echarts';
import { useRootSetting } from '/@/composables/setting/useRootSetting';
// import { useContentResizeFn } from '/@/layouts/default/content/useContentResizeFn';
// import { on, off } from '/@/logics/mitt/layoutContentResize';
import { useLayoutContentResize } from '/@/logics/mitt/layoutContentResize';

type par = {
  chartRef: MaybeElementRef;
  theme?: 'light' | 'dark' | 'default';
  immediate?: boolean;
  autoResize?: boolean;
};

export function useECharts(
  { chartRef, theme = 'default', immediate = true, autoResize = false }: par,
  options: EChartsOption
) {
  let el: HTMLDivElement;
  let isRender = false;
  let resizeFn: Fn = resize;
  const { getDarkMode: getSysDarkMode } = useRootSetting();
  resizeFn = useDebounceFn(resize, 200);
  const { on } = useLayoutContentResize();
  const cacheOptions = ref({}) as Ref<EChartsOption>;
  let chartInstance: echarts.EChartsType | null = null;

  const getDarkMode = computed(() => {
    return theme === 'default' ? getSysDarkMode.value : theme;
  });
  const getChartInstance = computed(() => {
    return chartInstance;
  });

  const getOptions = computed(() => {
    if (getDarkMode.value !== 'dark') {
      return cacheOptions.value as EChartsOption;
    }
    return {
      backgroundColor: 'transparent',
      ...cacheOptions.value,
    } as EChartsOption;
  });

  function initCharts(t = theme) {
    if (!el) return;
    autoResize && useEventListener(window, 'resize', resizeFn);
    chartInstance = echarts.init(el, t);
  }

  function setOptions(options: EChartsOption, clear = true) {
    cacheOptions.value = options;
    if (!chartInstance) {
      initCharts(getDarkMode.value as 'default');
      if (!chartInstance) {
        warn('setOption must be HTMLDivElement Mounted after!');
        return;
      }
    }
    clear && chartInstance?.clear();
    if (isRender || immediate) {
      render();
    }
  }

  function resize(
    opts: echarts.ResizeOpts = {
      animation: {
        duration: 300,
        easing: 'cubicOut',
      },
    }
  ) {
    chartInstance?.resize(opts);
  }

  function render() {
    chartInstance?.setOption(unref(getOptions));
    isRender = true;
  }

  watch(
    () => getDarkMode.value,
    (theme) => {
      if (chartInstance) {
        chartInstance.dispose();
        initCharts(theme as 'default');
        setOptions(cacheOptions.value);
      }
    }
  );

  whenever(
    () => unref(chartRef),
    (MaybeEl) => {
      el = unrefElement(MaybeEl) as HTMLDivElement;
      setOptions(options);
      !autoResize && on(resize, { isPassPars: false });
    }
  );

  tryOnUnmounted(() => {
    if (!chartInstance) return;
    chartInstance.dispose();
    chartInstance = null;
  });

  return {
    echarts,
    resize,
    render,
    setOptions,
    getChartInstance,
  };
}
