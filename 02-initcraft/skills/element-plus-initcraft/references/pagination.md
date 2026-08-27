# Element Plus Pagination for initCraft

Source checked: Element Plus Pagination docs, version shown on docs page 2.14.1, `https://element-plus.org/en-US/component/pagination`.

## Core Component

Use `el-pagination` when a runtime Vue/initCraft screen has too many records for one view. Basic form:

```vue
<el-pagination
  v-model:current-page="currentPage"
  v-model:page-size="pageSize"
  :total="total"
  layout="total, sizes, prev, pager, next, jumper"
  :page-sizes="[10, 20, 30, 50, 100]"
/>
```

## Layout Tokens

`layout` is a comma-separated string. Common tokens:

- `prev`: previous page button
- `pager`: page number list
- `next`: next page button
- `jumper`: jump-to-page input
- `total`: total item count
- `sizes`: page-size selector
- `->`: push every token after it to the right

Examples:

```vue
<el-pagination layout="prev, pager, next" :total="1000" />
<el-pagination layout="total, sizes, prev, pager, next, jumper" :total="400" />
<el-pagination layout="total, prev, pager, next, ->, jumper" :total="400" />
```

## Important Props

- `total`: total item count. Set this or `page-count`; prefer `total` when using `sizes`.
- `page-count`: total page count. If both `total` and `page-count` are set, `page-count` has priority.
- `v-model:current-page`: current page number.
- `v-model:page-size`: item count per page.
- `page-sizes`: options for `sizes`, default is `[10, 20, 30, 40, 50, 100]`.
- `pager-count`: number of pager buttons before collapse; default `7`.
- `background`: use filled pager buttons.
- `size`: `default`, `large`, or `small`.
- `disabled`: disable pagination.
- `hide-on-single-page`: hide when only one page exists.
- `prev-text` / `next-text`: replace icons with text.
- `prev-icon` / `next-icon`: custom icons; lower priority than text.
- `teleported`: whether the page-size dropdown teleports to body; default `true`.

## Events and Binding Rules

Element Plus still supports these events:

- `@size-change`
- `@current-change`
- `@change`
- `@prev-click`
- `@next-click`

Prefer `v-model:current-page` and `v-model:page-size` for two-way binding. If using one-way `:current-page` or `:page-size`, also listen for the corresponding `@update:current-page` or `@update:page-size`; otherwise the UI can appear stuck.

## initCraft Runtime Pattern

Use this pattern in `vue-ui` or custom Vue templates when paging data manually:

```vue
<template>
  <div class="pager-row">
    <el-pagination
      v-model:current-page="page.current"
      v-model:page-size="page.size"
      :page-sizes="[10, 20, 30, 50]"
      :total="page.total"
      background
      layout="total, sizes, prev, pager, next, jumper"
      @change="loadRows"
    />
  </div>
</template>
```

Expected model shape:

```js
page: {
  current: 1,
  size: 20,
  total: 0
}
```

When page or size changes, reload data with offset/limit or provider params:

```js
async function loadRows() {
  const limit = this.page.size
  const skip = (this.page.current - 1) * this.page.size
  // Call initCraft API/provider here, then set this.page.total and rows.
}
```

## Practical initCraft Guidance

- If an initCraft `list-ui` or `datagrid` already has built-in paging, use its native settings first.
- Add custom `el-pagination` when building a custom `vue-ui` list, table, or dashboard.
- Reset `currentPage` to `1` when search filters change.
- Use `size="small"` for dense side panels and dashboards.
- Use `hide-on-single-page` for compact embedded widgets.
- Avoid Element Plus pagination in Report Factory PDFs; use static HTML or Report Factory table output instead.
