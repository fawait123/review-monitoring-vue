<script setup lang="ts">
import { GitPullRequestIcon, LayoutDashboardIcon, MoonIcon, SettingsIcon, SunIcon } from "@lucide/vue";
import GhStatusButton from "~/components/GhStatusButton.vue";

const route = useRoute();
const colorMode = useColorMode();

const isActive = (path: string) => route.path === path || route.path.startsWith(path + "/");

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboardIcon, exact: true },
  { to: "/pull-request", label: "Pull Request", icon: GitPullRequestIcon },
  { to: "/model", label: "Model", icon: SettingsIcon },
];

const toggleTheme = () => {
  colorMode.preference = colorMode.preference === "dark" ? "light" : "dark";
};
</script>

<template>
  <SidebarProvider>
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" as-child>
              <NuxtLink to="/" class="gap-3">
                <div
                  class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <GitPullRequestIcon class="size-4" />
                </div>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-semibold">Review Monitor</span>
                  <span class="truncate text-xs text-muted-foreground">PR + Pi agent</span>
                </div>
              </NuxtLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in nav" :key="item.to" class="mb-1">
              <SidebarMenuButton as-child :is-active="isActive(item.to)" :tooltip="item.label" class="py-6 px-4">
                <NuxtLink :to="item.to">
                  <component :is="item.icon" v-if="typeof item.icon !== 'string'" class="size-4" />
                  <span v-else>{{ item.icon }}</span>
                  <span>{{ item.label }}</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ClientOnly>
              <SidebarMenuButton :tooltip="colorMode.preference === 'dark' ? 'Mode terang' : 'Mode gelap'"
                @click="toggleTheme" class="py-6 px-4">
                <SunIcon v-if="colorMode.preference === 'dark'" class="size-4" />
                <MoonIcon v-else class="size-4" />
                <span>{{ colorMode.preference === "dark" ? "Mode terang" : "Mode gelap" }}</span>
              </SidebarMenuButton>
            </ClientOnly>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>

    <SidebarInset>
      <header
        class="flex h-14 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <SidebarTrigger class="-ml-1" />
        <Separator orientation="vertical" class="mr-2 h-4" />
        <span class="text-sm font-medium">{{ route.meta.title ?? "Review Monitoring" }}</span>
        <span class="ml-auto flex items-center gap-2">
          <GhStatusButton />
        </span>
      </header>
      <main class="p-6">
        <slot />
      </main>
    </SidebarInset>
  </SidebarProvider>
</template>
