# initCraft SDForm Fields Reference

This reference summarizes the builder sidebar tools and the `field.options` keys shown through the right sidebar property panels. Option keys are exact internal names.

## Builder Layout

- Left sidebar: draggable field/tool catalog.
- Center: form building canvas. Select a dropped tool to edit it.
- Right sidebar: `Property` tab for selected field and `Form Setting` tab for global form config.
- Selected fields expose action icons on canvas: select parent, move up/down, clone, add library, remove. Tables also expose insert row/column.

## Shared Common Options

Most input fields share these keys:

- Identity/layout: `name`, `label`, `labelAlign`, `columnSpan`, `size`, `labelWidth`, `labelHidden`, `customClass`.
- State: `defaultValue`, `placeholder`, `readonly`, `disabled`, `hidden`, `clearable`.
- Validation: `required`, `requiredHint`, `validation`, `validationHint`, `onValidate`.
- Label decoration: `labelIconClass`, `labelIconPosition`, `labelTooltip`, `labelColor`.
- Lifecycle events: `onCreated`, `onMounted`, `onUnmount`.
- User interaction events vary by component: commonly `onInput`, `onChange`, `onFocus`, `onBlur`, `onClear`.

Validation presets observed in the builder include: `Number`, `Mobile Phone`, `E-Mail`, `Url`, `Unique Value`, `Citizen Id`, `Variable`, `Variable (casesensitive)`, `Letter`, `Letter And Number`, `Start With Letter`, Thai-supported variants, and custom regular expressions.

## Event Notes

- `onValidate(rule, value, callback)`: use `callback()` for pass; `callback(new Error("error message"))` for fail.
- Upload events: `onBeforeUpload(file)`, `onUploadSuccess(result, file, fileList)`, `onUploadError(error, file, fileList)`, `onFileRemove(file, fileList)`.
- Data/view tools may use pre-save/navigation hooks: `onInsertBefore`, `onUpdateBefore`, `onViewBefore`, `onBeforeSave`, `onAfterDelete`.
- Sub Form row events: `onSubFormRowAdd`, `onSubFormRowInsert`, `onSubFormRowDelete`, `onSubFormRowChange`, `onSubFormRowReorder`.

## Runtime API Reference

Distilled from the Drive-hosted `SDForm API Reference` supplied by the user on 2026-07-06. Use these method names when writing Event Setting scripts.

### Field instance: `this.*`

Core value/state:

- `this.setValue(value)`: set current field value; use `null` to clear where supported.
- `this.getValue()`: get current field value.
- `this.getText()`: get display text/label for current value, useful for select/radio fields.
- `this.hide()` / `this.show()`: hide or show current field.
- `this.disabled()` / `this.enable()`: disable or enable current field.
- `this.focus()`: focus current field.
- `this.trigger()`: programmatically trigger the component, such as opening a picker.
- `this.isSubFormItem()`: true when the current field is inside a Sub Form row.
- `this.setRequired(flag, hint)`: toggle required validation with an optional custom message.
- `this.setLabel(label)`: override current field label.
- `this.addCssClass(className)` / `this.removeCssClass(className)`: change wrapper CSS classes.

References and dialogs:

- `this.refField(fieldName)`: get another field instance in the same form.
- `this.refSubField(subFormName, fieldName, rowIndex)`: get a field inside a Sub Form row.
- `this.notify(msg, type, duration)`: toast notification; `type` is `success`, `warning`, `info`, or `error`.
- `this.alert(msg, title, options)`: alert dialog, async-safe with `await`.
- `this.confirm(msg, title, options)`: confirm dialog resolving `true`/`false`.
- `this.prompt(msg, options)`: input prompt resolving string or `null`.

Option helpers for select/radio/checkbox-like fields:

- `this.loadOptions([{ label, value }])`: replace all options.
- `this.addOption({ label, value })`: append one option.
- `this.removeOption(value)`: remove by value.
- `this.clearOptions()`: remove all options.
- `this.getOptions()`: get current option array.
- `this.getOptionsModel()`: get raw internal options model.
- `this.getSelectedLabel()`: get selected option label.
- `this.disableOption(value)` / `this.enableOption(value)`: toggle one option.

Utility helpers:

- `this.showFields(["field_a", "field_b"])` / `this.hideFields([...])`: show/hide multiple fields.
- `this.copyClipboard(text)`: copy text to clipboard.
- `this.numberFormat(value, options)`: format numbers with decimal/separator/prefix/suffix options.
- `this.string2Json(str)` / `this.json2String(obj)`: JSON parse/stringify helpers.
- `this.dayjs(date)`: Day.js factory for date math and formatting.

### Form instance: `this.getFormRef().*`

Data and validation:

- `submitForm(rstat)`: submit form. `rstat = 1` saves draft/skips validation; `rstat = 2` submits with validation.
- `getFormData(needValidation)`: return form data; when `needValidation` is true, returns `null` if validation fails.
- `setFormData(formData)`: merge object values into the form model.
- `getFieldValue(fieldName)` / `setFieldValue(fieldName, value)`: read/write any field by name.
- `getSubFormValues(subFormName)`: get all rows from a Sub Form.
- `clearFormDataModel()`: reset fields to defaults.
- `validateForm(callback)`: validate all fields; callback receives `(valid, invalidFields)`.
- `resetForm()`: reset form to initial state.

Field/form state:

- `hideField(fieldName)` / `showField(fieldName)`: hide or show a field by name.
- `disableField(fieldName)` / `enableField(fieldName)`: disable or enable a field by name.
- `disableForm()` / `enableForm()`: disable or enable the whole form.
- `reloadOptionData(fieldName)`: force reload options for `select-form` or `select-sql` fields.
- `setFormModel(newFormJson)`: replace form JSON model; advanced use only.

Popup/sub-form:

- `openForm(formId, dataId, parentId, initData, options)`: open another form.
- `subFormOpen(subFormName, rowIndex)`: open a Sub Form row; omit `rowIndex` to add a row.

`openForm` argument pattern:

```js
this.getFormRef().openForm(formId, dataId, parentId, initData, options);
```

- `formId`: target form id.
- `dataId`: existing record `_id` for edit mode; use `null` to create.
- `parentId`: parent record id for child records.
- `initData`: pre-filled field values.
- `options.params`: read-only context available in target form as `formParams`.
- `options.readonly`: open target form read-only.
- `options.backdrop`: allow backdrop click to close.
- `options.popupType`: `dialog` or `drawer`.
- `options.drawerDirection`: `rtl`, `ltr`, `ttb`, or `btt` for drawer popups.
- `options.beforeSaveCallback(formData)`: return object to merge before save.
- `options.afterSaveCallback(data, autoSave)`: run after successful save.
- `options.cancelCallback()`: custom cancel handling.
- `options.fixApiUrl`: override target API URL.

OpenForm gotchas:

- Popup width/fullscreen is not controlled through `openForm` options; width comes from the target form `form_options.popup_size`.
- Passing `options.params` replaces the params object instead of merging with existing `formParams`.
- Custom `cancelCallback` may override default popup closing behavior; close manually if needed.
- Use `subFormOpen` for a row inside the current form; use `openForm` for another whole form.

### API connector: `this.getFormRef().userState.*`

Use `const api = this.getFormRef().userState`.

- `api.runProcess(processId, params)`: run API Process via `/v1/process/{processId}`.
- `api.crudCreate({ data, sdProvider })`: insert record.
- `api.crudUpdate({ id, data, sdProvider, upsert })`: update record.
- `api.crudDelete({ id, sdProvider })`: delete record.
- `api.crudGetAll({ sdProvider, totalEnable })`: fetch multiple records.
- `api.crudGetOne({ sdProvider })`: fetch one record.
- `api.crudCheckUnique({ dataId, fieldName, fieldValue, sdProvider })`: uniqueness check excluding current record.
- `api.apiPost(path, params)`, `api.apiGet(path, params)`, `api.apiPut(path, params)`, `api.apiDelete(path, params)`: custom HTTP calls.

### Event context variables

Common variables available in Event Setting scripts:

- `this`: current field instance.
- `this.getFormRef()`: current form instance.
- `this.getFormRef().userState`: API connector.
- `value`: current event value in value-change events.
- `data`: reactive form data model; read/write with field names.
- `parentData`: parent form data when opened through `openForm`.
- `formParams`: read-only params passed into the form.
- `customParams`: custom parameters from form config.
- `userInfo`: current logged-in user, including fields such as `_id`, `username`, `roles`, and `email`.
- `useUserState`: user state store.
- `formId`: current form id.
- `dataId`: current record `_id`, or null for a new record.
- `parentId`: parent record id when opened from a parent form.

## Basic Input

- `text-input` / Text Input: `name,label,labelAlign,type,defaultValue,placeholder,columnSpan,size,labelWidth,labelHidden,readonly,disabled,hidden,clearable,showPassword,required,requiredHint,validation,validationHint,customClass,labelIconClass,labelIconPosition,labelTooltip,labelColor,minLength,maxLength,showWordLimit,prefixIcon,suffixIcon,prefixText,suffixText,appendButton,appendButtonDisabled,buttonIcon,onCreated,onMounted,onUnmount,onInput,onChange,onFocus,onBlur,onValidate,onAppendButtonClick`
- `number-input` / Number Input: `name,label,labelAlign,defaultValue,placeholder,columnSpan,size,labelWidth,labelHidden,disabled,hidden,required,requiredHint,validation,validationHint,customClass,labelIconClass,labelIconPosition,labelTooltip,labelColor,min,max,precision,step,controlsPosition,prefixIcon,suffixIcon,prefixText,suffixText,onCreated,onMounted,onUnmount,onChange,onFocus,onBlur,onValidate`
- `textarea-input` / Textarea: `name,label,labelAlign,rows,defaultValue,placeholder,columnSpan,size,labelWidth,labelHidden,readonly,disabled,hidden,autoSize,required,requiredHint,validation,validationHint,customClass,labelIconClass,labelIconPosition,labelTooltip,labelColor,minLength,maxLength,showWordLimit,onCreated,onMounted,onUnmount,onInput,onChange,onFocus,onBlur,onValidate`
- `otp-input` / OTP Input: `name,label,labelAlign,defaultValue,columnSpan,size,labelWidth,labelHidden,disabled,readonly,hidden,required,requiredHint,validation,validationHint,customClass,labelIconClass,labelIconPosition,labelTooltip,labelColor,length,type,mask,separator,onCreated,onMounted,onChange,onFocus,onBlur,onFinish,onValidate`
- `switch-input` / Switch: `name,label,labelAlign,size,defaultValue,columnSpan,labelWidth,labelHidden,disabled,hidden,customClass,labelIconClass,labelIconPosition,labelTooltip,labelColor,switchWidth,activeText,inactiveText,activeColor,inactiveColor,activeIcon,inactiveIcon,inlinePrompt,onCreated,onMounted,onUnmount,onChange,onValidate`
- `radio-input` / Radio Button: `name,label,labelAlign,defaultValue,columnSpan,size,displayStyle,buttonStyle,border,showCol,labelWidth,labelHidden,disabled,hidden,optionItems,required,requiredHint,validation,validationHint,customClass,labelIconClass,labelIconPosition,labelTooltip,labelColor,onCreated,onMounted,onUnmount,onChange,onValidate`
- `select-input` / Select Input: `name,label,labelAlign,defaultValue,placeholder,columnSpan,size,labelWidth,labelHidden,disabled,hidden,clearable,filterable,allowCreate,remote,automaticDropdown,multiple,multipleLimit,optionItems,required,requiredHint,validation,validationHint,customClass,labelIconClass,labelIconPosition,labelTooltip,labelColor,onCreated,onMounted,onUnmount,onRemoteQuery,onChange,onClear,onFocus,onBlur,onValidate`
- `checkbox-input` / Checkbox: `name,label,labelAlign,defaultValue,columnSpan,size,displayStyle,buttonStyle,showCol,border,labelWidth,labelHidden,disabled,hidden,optionItems,required,requiredHint,validation,validationHint,customClass,minCheck,maxCheck,labelIconClass,labelIconPosition,labelTooltip,labelColor,onCreated,onMounted,onUnmount,onChange,onValidate`
- `masked-input` / Masked Input: `name,label,labelAlign,defaultValue,mask,unmask,showMask,columnSpan,size,labelWidth,labelHidden,readonly,disabled,hidden,required,requiredHint,validation,validationHint,customClass,slotChar,autoClear,labelIconClass,labelIconPosition,labelTooltip,labelColor,onCreated,onMounted,onUnmount,onInput,onChange,onFocus,onBlur,onValidate`
- `date-input` / Date Time: `name,label,labelAlign,dateType,defaultValue,placeholder,columnSpan,size,autoFullWidth,labelWidth,labelHidden,readonly,disabled,hidden,clearable,editable,format,valueFormat,required,requiredHint,validation,validationHint,customClass,disabledDate,initCurrent,labelIconClass,labelIconPosition,labelTooltip,labelColor,onCreated,onMounted,onUnmount,onChange,onFocus,onBlur,onValidate`
- `date-panel-input` / Date Panel: `name,label,labelAlign,dateType,defaultValue,columnSpan,size,labelWidth,labelHidden,disabled,hidden,border,format,valueFormat,required,requiredHint,validation,validationHint,customClass,disabledDate,initCurrent,labelIconClass,labelIconPosition,labelTooltip,labelColor,onCreated,onMounted,onUnmount,onChange,onValidate`
- `date-range-input` / Date Range: `name,label,labelAlign,dateType,defaultValue,startPlaceholder,endPlaceholder,columnSpan,size,labelWidth,labelHidden,readonly,disabled,hidden,clearable,editable,format,valueFormat,required,requiredHint,validation,validationHint,customClass,disabledDate,rangeSeparator,labelIconClass,labelIconPosition,labelTooltip,labelColor,onCreated,onMounted,onUnmount,onChange,onFocus,onBlur,onValidate`
- `time-input` / Time Input: `name,label,labelAlign,defaultValue,placeholder,columnSpan,size,autoFullWidth,labelWidth,labelHidden,readonly,disabled,hidden,clearable,editable,format,required,requiredHint,validation,validationHint,customClass,arrowControl,initCurrent,labelIconClass,labelIconPosition,labelTooltip,labelColor,onCreated,onMounted,onUnmount,onChange,onFocus,onBlur,onValidate`
- `time-range-input` / Time Range: `name,label,labelAlign,defaultValue,startPlaceholder,endPlaceholder,columnSpan,size,labelWidth,labelHidden,readonly,disabled,hidden,clearable,editable,format,required,requiredHint,validation,validationHint,customClass,arrowControl,rangeSeparator,labelIconClass,labelIconPosition,labelTooltip,labelColor,onCreated,onMounted,onUnmount,onChange,onFocus,onBlur,onValidate`
- `time-select-input` / Time Select: `name,label,labelAlign,defaultValue,placeholder,columnSpan,size,autoFullWidth,labelWidth,labelHidden,readonly,disabled,hidden,clearable,editable,includeEndTime,effect,format,start,end,step,minTime,maxTime,required,requiredHint,validation,validationHint,customClass,labelIconClass,labelIconPosition,labelTooltip,labelColor,onCreated,onMounted,onUnmount,onChange,onFocus,onBlur,onValidate`
- `multiple-date` / Multiple Date: `name,label,labelAlign,dateType,defaultValue,placeholder,columnSpan,size,autoFullWidth,labelWidth,labelHidden,readonly,disabled,hidden,clearable,editable,format,valueFormat,required,requiredHint,validation,validationHint,customClass,disabledDate,labelIconClass,labelIconPosition,labelTooltip,labelColor,onCreated,onMounted,onUnmount,onChange,onFocus,onBlur,onValidate`
- `rate-input` / Rate Input: `name,label,labelAlign,defaultValue,columnSpan,size,labelWidth,labelHidden,disabled,hidden,required,requiredHint,validation,validationHint,clearable,customClass,labelIconClass,labelIconPosition,labelTooltip,labelColor,max,lowThreshold,highThreshold,allowHalf,showText,showScore,scoreTemplate,onCreated,onMounted,onUnmount,onChange,onValidate`
- `slider-input` / Slider: `name,label,labelAlign,defaultValue,columnSpan,showStops,size,labelWidth,labelHidden,disabled,hidden,required,requiredHint,validation,validationHint,customClass,labelIconClass,labelIconPosition,labelTooltip,labelColor,min,max,step,range,height,onCreated,onMounted,onUnmount,onChange,onValidate`
- `color-input` / Color Picker: `name,label,labelAlign,defaultValue,columnSpan,size,labelWidth,labelHidden,disabled,hidden,required,requiredHint,validation,validationHint,customClass,showAlpha,labelIconClass,labelIconPosition,labelTooltip,labelColor,onCreated,onMounted,onUnmount,onChange,onValidate`
- `tags-input` / Tags: `name,label,labelAlign,defaultValue,placeholder,columnSpan,size,labelWidth,labelHidden,disabled,readonly,hidden,clearable,tagType,tagEffect,trigger,draggable,multiple,format,prefixText,suffixText,prefixIcon,suffixIcon,max,maxLength,customClass,labelIconClass,labelIconPosition,labelTooltip,labelColor,onCreated,onMounted,onUnmount,onInput,onRemoveTag,onAddTag,onChange,onFocus,onBlur,onValidate`
- `objectid-input` / ObjectID Input: similar to Text Input plus object id semantics: `name,label,labelAlign,defaultValue,placeholder,columnSpan,size,labelWidth,labelHidden,readonly,disabled,hidden,clearable,required,requiredHint,validation,validationHint,customClass,labelIconClass,labelIconPosition,labelTooltip,labelColor,minLength,maxLength,showWordLimit,prefixIcon,suffixIcon,prefixText,suffixText,onCreated,onMounted,onUnmount,onInput,onChange,onFocus,onBlur,onValidate`

## Advanced Input

- `select-sql-input` / Select By SQL: SQL provider select. Key source options: `sqlId,limit,valueFieldSql,labelFieldSql,searchFieldSql,labelTemplateSql,optionsTemplateSql,valueObjectId,customObjectId`; events include `onChange,onClear,onFocus,onBlur,onValidate`.
- `select-form-input` / Select By Form: form-backed select. Source/filter keys: `formId,where,orderBy,limit,parentMode,defaultFilterParent,parentPath,showWhenParent,formBtnEnable,valueField,labelField,searchField,refField,labelTemplate,optionsTemplate,cloneEnableLabelField,dependEnable,dependField,valueObjectId,refreshLabel,getDataOnLoad`.
- `select-path-input` / Select By Path: path/object extraction select. Keys: `dataOptions,sourceField,sourceDynamic,sourcePath,spaceChar,prefixProp,sqlTag,groupProp,valueProp,labelProp,labelCustom,systemFieldAddon,onItemListChange`.
- `select-data-input` / Select Data List: data-list select. Keys: `valueObjectId,listId,getDataOnLoad,limit,initCurrent`.
- `cascader-form-input` / Select Hierarchy: hierarchical form select. Keys: `formId,valueField,labelField,parentField,rootValue,separator,where,orderBy,limit,multiple,checkStrictly,saveWithLabel`.
- `group-list-input` / Group List: grouped form values. Keys: `formId,groupField,where,orderBy`.
- `radio-text-input` / Radio Text: radio option plus text input. Keys: `displayStyle,showCol,optionItems`.
- `dynamic-input` / Dynamic Input: input generated from options. Keys: `inputType,inputOptions,optionItems`.
- `btn-editor-input` / Button Editor: editor for button-like option data. Keys: `inputTypeBtn,inputOptions,actionLabel`.
- `code-input` / Code Editor: `lang,minHeight,minLines,maxLines`; events include `onInput,onChange,onFocus,onBlur,onValidate`.
- `html-input` / HTML Editor: `mode,minHeight,tooltip,charCountMax`.
- `json-input` / JSON Editor: `valueType`.
- `file-upload-input` / File Upload: `uploadURL,uploadTip,withCredentials,multipleSelect,showFileList,limit,fileMaxSize,fileTypes`; upload events listed above.
- `crop-upload-input` / Crop Picture: `width,heightImg,resizeEnable,rotateEnable,flipEnable,uploadURL,onUploadError,onUploadSuccess,onFileRemove`.
- `picture-upload-input` / Picture Upload: same upload behavior as File Upload, using picture-card list.
- `autonumber-input` / Auto Number: Text Input plus `increment,prefix,suffix,digit,perDay,bySite`.
- `svg-input` / SVG Upload: upload/store SVG value.
- `icon-input` / Icon List: `allowCreate,elIcons`; events include `onChange,onClear,onFocus,onBlur,onValidate`.

## Display UI

- `text-ui` / Static Text: `name,columnSpan,hidden,content,template,textAlign,fontSize,italic,bold,underline,fontColor,marginBottom,paragraph,wrapText,customClass,labelIconClass,labelIconPosition,labelTooltip,onCreated,onMounted,onUnmount`
- `html-ui` / Content: `name,columnSpan,hidden,content,template,customClass,onCreated,onMounted,onUnmount`
- `link-ui` / Link Text: `href,target,content,template,italic,bold,underline,linkType,textAlign,fontSize,marginBottom,paragraph`.
- `vue-ui` / Components: custom Vue content in `content`.
- `divider-ui` / Divider: `label,direction,contentPosition`.
- `progress-ui` / Progress Bar: `textAlign,type,strokeLinecap,status,percentage,strokeWidth,duration,width,textInside,indeterminate,showText,striped,stripedFlow,colors,format`.
- `avatar-ui` / Avatar: `textAlign,clearIcon,src,sizeImg,shape,fit,onError`.
- `alert-ui` / Alert Block: `title,content,template,alertType,effect,showIcon,center,closable,closeText,onClose`.
- `image-ui` / Image: `src,loading,lazy,fit,width,heightImg,zoomRate,minScale,maxScale,previewSrcList,infinite,closeOnPressEscape,initialIndex,zIndex`.
- `statistic-ui` / Statistic: `displayType,headerType,valueNum,title,footer,width,groupSeparator,decimalSeparator,formatter,precision,prefixText,suffixText,prefixIcon,suffixIcon`.
- `scan-code-ui` / Scan Code: `preset,target,minLength,avgTimeByChar,extendedCharset,singleScanQty,suffixKeyCodes,indicator,indicatorCorner,indicatorTimeout,indicatorScanOnly,onScan,onScanError`.
- `button-ui` / Buttons: `textAlign,size,disabled,buttonGroup,marginBottom,data,buttons`.
- `smart-card-ui` / Smart Card: `host,port,token,secure,reconnect,indicator...`; events: `onCardRead,onCardRemoved,onReaderConnected,onReaderDisconnected,onConnected,onDisconnected`.
- `liff-ui` / LINE LIFF: `liffId,autoLogin,indicator,indicatorCorner`; events: `onReady,onProfile,onToken,onError`.
- `tour-ui` / Tour: `label,prefixIcon,suffixIcon,linkType,tourType,maskTour,plain,round,circle,open,indicators,zIndex,steps,onFinish`.
- `dropdown-ui` / Menu List: `label,prefixIcon,tagType,menuType,maxHeight,disabled,placement,triggerMenu,menuList,onCommand`.
- `segmented-ui` / Segmented: `block,direction,tabField,segmentedList,onUiChange`.
- `step-ui` / Steps: `direction,processStatus,finishStatus,alignCenter,simple,space,valField,stepList`.
- `svg-ui` / SVG icon: `textAlign,marginBottom,paragraph,sizeClass,svgData,svgValue`.
- `qrcode-ui` / QR Code: `textAlign,marginBottom,paragraph,textValue,width`.
- `record-ui` / Record View: form record card/block view. Key options: `formId,parentId,dataId,params,initData,titleEnable,titleName,blockUiFields,where,customContentEnable,buttonsRow,reportList,actionEnable,addBtnEnable,viewBtnEnable,updateBtnEnable,delBtnEnable,reloadBtnEnable,allowDeleteFunc,lastRecord,providerType`; events include insert/update/view/before-save/after-delete hooks.
- `tree-ui` / Tree View: `formId,parentId,params,valueField,labelField,parentField,rootValue,searchField,searchMode,where,orderBy,limitRow,height,itemSize,defaultExpandAll,add/view/update/delete/reload buttons,buttonsRow,reportList,clickEvent`; events include CRUD hooks plus `onselect,onunselect`.
- `list-ui` / List View: list/timeline/thumbnail/icon list. Keys include `formId,parentId,params,where,orderBy,searchField,limitRow,actionEnable,buttonsRow,reportList,listType,iconField,titleContent,titleField,detailContent,statusContent,statusField,colorField,groupField,listColumn,totalEnable,clickEvent,customValue`.
- `datagrid-sql-ui` / Data Grid SQL: SQL data grid. Keys: `sqlId,params,displayFieldsSql,searchFieldSql,limitRow,infiniteScroll,orderBy,maxHeight,height,buttonsBar,buttonsRow,reportList,resizable,indexColumn,actionEnable,actionLabel,actionWidth,keyId,rowKey,providerType`.
- `datagrid-form-ui` / Data Grid Form: form data grid. Keys include `formId,parentId,params,displayFields,searchField,editColumn,limitRow,where,buttonsBar,buttonsRow,reportList,resizable,indexColumn,systemColumn,rawdataBtnEnable,exportBtnEnable,addBtnEnable,groupKey,aggrColumn,sumColumn,totalInline,providerType,allowDeleteFunc,allowCloneFunc`.
- `side-menu-ui` / Side Menu: form-backed menu. Keys: `formId,parentId,params,where,orderBy,limitRow,viewTrigger,iconField,labelOneField,pathField,roleField,subMenuField,defaultActive,classInteraction,menuWidth,fixedEnable,uniqueOpened,expandEnable,clickEvent,customValue`.
- `carousel-ui` / Carousel: form-backed carousel. Keys: `formId,parentId,params,where,orderBy,limitRow,height,verticalEnable,iconField,titleContent,titleField,detailContent,indicatorPosition,viewTrigger,interval,typeCard,motionBlur,autoplay,clickEvent,customValue`.
- `chart-ui` / ChartJS: `sqlId,params,width,heightImg,title,chartType,titleDisplay,legendDisplay,legendCustom,scalesXDisplay,scalesXLabel,scalesXCustom,xField,xType,scalesYDisplay,scalesYLabel,scalesYCustom,yDataset,customOptions,gridDisplay`.
- `apexchart-ui` / ApexChart: `sqlId,params,width,heightImg,title,achartType,titleDisplay,legendDisplay,legendCustom,scalesXDisplay,scalesXLabel,scalesXCustom,xField,xacType,scalesYDisplay,scalesYLabel,scalesYCustom,yDatasetApex,customOptions,gridDisplay,gridCustom,dataLabelsShow,toolbarShow,zoomEnable,tooltipShow`.
- `report-ui` / Report: `name,columnSpan,hidden,label,reportList,size,marginEnable,params,customClass,onCreated,onMounted,onUnmount`. Use for report buttons/links configured through Report Factory.

## Containers

- `grid` / Layout: `name,hidden,gutter,colHeight,customClass`; contains grid columns/fields.
- `grid-col` / Grid Col: `name,hidden,span,offset,push,pull,responsive,md,sm,xs,bgColor,customClass`.
- `card` / Card: `name,label,subLabel,hidden,folded,bgbody,showFold,headerDisable,headerType,headerEffect,labelColor,cardWidth,themes,shadow,customClass,labelIconText,labelIconClass,labelIconPosition,labelTooltip`.
- `table` / Table: `name,hidden,border,customClass`; canvas action can insert rows/columns.
- `table-cell` / Table Cell: `name,cellWidth,cellHeight,colspan,rowspan,bgColor,customClass`.
- `tab` / Tab: `name,hidden,displayType,tabPosition,customClass`.
- `tab-pane` / Tab Pane: `name,label,hidden,active,disabled,customClass`.
- `affix` / Affix: `name,hidden,customClass,offsetAffix,vPosition,target,zIndex,disableOnMobile`.
- `collapse` / Collapse: `name,hidden,customClass,accordion`.
- `collapse-item` / Collapse Item: `name,label,hidden,active,disabled,customClass`.
- `scrollbar` / Scrollbar: `name,hidden,autoHeigth,height,maxHeight,native,customClass,wrapClass,viewClass,noresize,always,tagHtml,minSize`.
- `space` / Space: `name,hidden,wrap,fill,fillRatio,contentPosition,size,alignment,direction,customClass,prefixCls,spacer`.
- `sub-form` / Sub Form: `name,label,showBlankRow,showRowNumber,showRowInsertButton,rowDraggable,size,labelAlign,hidden,actionPosition,customClass,onSubFormRowAdd,onSubFormRowInsert,onSubFormRowDelete,onSubFormRowChange,onSubFormRowReorder`.
- `object-group` / Object Group: `name,label,hidden,customClass,onCreated,onMounted,onUnmount`.

## Date/Time Values

Common visible date formats include:

- `DD/MM/YYYY HH:mm:ss`, `DD/MM/BBBB HH:mm:ss (BE)`, `DD/MM/YYYY`, `DD/MM/BBBB (BE)`, `MM/YYYY`, `YYYY`, Thai Buddhist Era formats, English month formats, `HH:mm:ss`, `HH:mm`, `YYYY-MM-DD HH:mm:ss`, `YYYY-MM-DD`, `YYYY-MM`, `YYYY`.

Use `format` for display and `valueFormat` for stored value when the field exposes both.

## Practical Configuration Rules

- Set `name` before writing events; autocomplete and `this.refField(name)` depend on it.
- Use unique `name` values across fields. Inside Sub Form, runtime refs include row suffixes.
- Use `hidden` to remove from display; `disabled` to show but block editing; `readonly` for read-only text-like controls.
- For select-like fields, distinguish static `optionItems` from provider-backed options such as SQL, Form, Path, or Data List.
- For form-backed/list/grid tools, pair `formId` with `valueField`, `labelField`, `where`, `orderBy`, `limitRow`, and parent filter keys as needed.
- For upload fields, validate `fileTypes`, `fileMaxSize`, and `limit`; use upload events for custom result mapping.
- For report/data-grid/list buttons, keep `params` explicit and test event handlers with a small result set first.

## Practice: Button Filter For List View Status

Use this pattern when a `button-ui` or button group should filter a `list-ui` by a status field such as approval status, booking status, or meeting request status.

Required names/values before writing scripts:

- Hidden state field name: a hidden `text-input` such as `filter_booking_status` or `filter_meeting_status`.
- List View field name: the `name` of the `list-ui`, such as `vehicle_booking_list` or `list_ui43430`.
- Data status field name: the actual field key stored in the List View source form, such as `booking_status`, `request_status`, or `xrstatx`. Do not assume it matches the visible label.
- Stored status values: use the real stored values, not button labels. Example: `pending_requests` / `approved_requests` / `cancelled_requests`, or numeric values such as `1` / `2` / `3`.

Important runtime detail: changing only `list.field.options.where` or `list.setFieldOption("where", where)` may not refresh an already-mounted List View. For `list-ui`, also set `editor.defaultWhere`, set `editor.dpFormData.options.where`, then call `editor.handleRefresh()`.

Status button template:

```js
this.refField("FILTER_FIELD_NAME").setValue("STATUS_VALUE");

const status = this.refField("FILTER_FIELD_NAME").getValue();
const list = this.refField("LIST_VIEW_NAME");
const editor = list.getFieldEditor();

const where = "STATUS_FIELD_NAME = '" + status + "'";

list.setFieldOption("where", where);

if (!editor.dpFormData.options) {
  editor.dpFormData.options = {};
}

editor.defaultWhere = where;
editor.dpFormData.options.where = where;

editor.handleRefresh();
```

All button template:

```js
this.refField("FILTER_FIELD_NAME").setValue("");

const list = this.refField("LIST_VIEW_NAME");
const editor = list.getFieldEditor();

list.setFieldOption("where", "");

if (!editor.dpFormData.options) {
  editor.dpFormData.options = {};
}

editor.defaultWhere = "";
editor.dpFormData.options.where = "";

editor.handleRefresh();
```

When one status must never appear, keep a base filter in every button script. Do not clear `where` to `""` in the "All" button, because that removes the base filter and hidden statuses will return.

Example: show every vehicle booking except draft, and let status buttons layer on top of that rule:

```js
const baseWhere = "booking_status != 'draft'";
```

All button with base filter:

```js
this.refField("filter_booking_status").setValue("");

const list = this.refField("vehicle_booking_list");
const editor = list.getFieldEditor();
const where = "booking_status != 'draft'";

list.setFieldOption("where", where);

if (!editor.dpFormData.options) {
  editor.dpFormData.options = {};
}

editor.defaultWhere = where;
editor.dpFormData.options.where = where;

editor.handleRefresh();
```

Specific status button with base filter:

```js
this.refField("filter_booking_status").setValue("approved");

const status = this.refField("filter_booking_status").getValue();
const list = this.refField("vehicle_booking_list");
const editor = list.getFieldEditor();

const baseWhere = "booking_status != 'draft'";
const where = baseWhere + " AND booking_status = '" + status + "'";

list.setFieldOption("where", where);

if (!editor.dpFormData.options) {
  editor.dpFormData.options = {};
}

editor.defaultWhere = where;
editor.dpFormData.options.where = where;

editor.handleRefresh();
```

If the initial List View is blank but status buttons work, the initial `where` was not applied to the live editor. Prefer setting `Filters ( WHERE SQL )` to the base filter if it works. If not, set and refresh the mounted list once:

```js
setTimeout(() => {
  const editor = this.getFieldEditor();
  const where = "booking_status != 'draft'";

  this.setFieldOption("where", where);

  if (!editor.dpFormData.options) {
    editor.dpFormData.options = {};
  }

  editor.defaultWhere = where;
  editor.dpFormData.options.where = where;

  editor.handleRefresh();
}, 50);
```

Debug field/value mismatches with the List View editor data after clearing filters:

```js
const list = this.refField("LIST_VIEW_NAME");
const editor = list.getFieldEditor();

console.log("list field options =", list.field.options);
console.log("editor formId =", editor.formId);
console.log("editor dpFormData =", editor.dpFormData);
console.log("rawData length =", editor.rawData.length);
console.log("first row =", editor.rawData[0]);

if (editor.rawData[0]) {
  console.log("row keys =", Object.keys(editor.rawData[0]));
}

const schema = editor.sdformModel.form_db.schema;
console.log("schema keys =", Object.keys(schema));
console.log("status-like schema keys =", Object.keys(schema).filter(k =>
  k.toLowerCase().includes("status") ||
  k.toLowerCase().includes("state") ||
  k.toLowerCase().includes("approve") ||
  k.toLowerCase().includes("request") ||
  k.toLowerCase().includes("rstat")
));
```

## Practice: List View Custom Values For Status

Use `customValue` when list row templates need derived display fields such as Thai status text, tag background color, or tag text color. Match keys to the stored value, not the label shown in the option editor.

Vehicle booking status example:

```js
({pending:"รออนุมัติ", assigned:"จัดรถแล้ว", completed:"เสร็จสิ้น", cancelled:"ยกเลิก", draft:"บันทึกร่าง", approved:"อนุมัติ", returned:"ตีกลับ"})[row.booking_status] || row.booking_status
```

Background color example:

```js
({pending:"#fdf6ec", assigned:"#ecf5ff", completed:"#f0f9eb", cancelled:"#fef0f0", draft:"#f4f4f5", approved:"#f0f9eb", returned:"#fff7ed"})[row.booking_status] || "#f4f4f5"
```

Text color example:

```js
({pending:"#e6a23c", assigned:"#409eff", completed:"#67c23a", cancelled:"#f56c6c", draft:"#909399", approved:"#67c23a", returned:"#c2410c"})[row.booking_status] || "#909399"
```

For `detailContent`, keep the HTML valid and avoid `<style>` tags if the renderer breaks. If conditional row UI is needed, prefer a `customValue` that returns either an HTML string or `""`, then place `{{custom_field_name}}` in the template.

## Practice: Dashboard Counts From Process API

For count cards, make the hidden/input variable names match the template variables, not the component label. Example: a card template using `{{ approved_count || 0 }}` must be populated with:

```js
f.setFieldValue("approved_count", counts.approved_requests || 0);
```

When a process returns status counts, include every stored status key that the form uses:

```js
const counts = {
  total_requests: 0,
  pending_requests: 0,
  approved_requests: 0,
  assigned_requests: 0,
  completed_requests: 0,
  cancelled_requests: 0,
  draft_requests: 0,
  returned_requests: 0
};

for (const row of rows) {
  const status = String(row.booking_status || "").trim();

  if (status !== "draft") counts.total_requests++;
  if (status === "pending") counts.pending_requests++;
  if (status === "approved") counts.approved_requests++;
  if (status === "assigned") counts.assigned_requests++;
  if (status === "completed") counts.completed_requests++;
  if (status === "cancelled") counts.cancelled_requests++;
  if (status === "draft") counts.draft_requests++;
  if (status === "returned") counts.returned_requests++;
}
```

Use fallback values in `onMounted`:

```js
f.setFieldValue("total_count", counts.total_requests || 0);
f.setFieldValue("pending_count", counts.pending_requests || 0);
f.setFieldValue("approved_count", counts.approved_requests || 0);
f.setFieldValue("assigned_count", counts.assigned_requests || 0);
f.setFieldValue("completed_count", counts.completed_requests || 0);
f.setFieldValue("cancelled_count", counts.cancelled_requests || 0);
f.setFieldValue("draft_count", counts.draft_requests || 0);
f.setFieldValue("returned_count", counts.returned_requests || 0);
```

## Practice: Row File Buttons

`list-ui` Buttons Row settings may only expose static button styling/options such as type, icon, tag, loading, and disabled. If there is no per-row show/visible condition, the button cannot be hidden for only rows where a file field is empty.

Use Buttons Row only when it is acceptable for every row to show the button and have the click handler no-op or alert when no file exists:

```js
if (!row.file_upload_car) {
  this.alert("ไม่มีเอกสารแนบ", "warning");
  return;
}
```

When the button must disappear on rows with no file, use `customValue` plus `detailContent` instead. Example for a file field that may store either a URL string or upload JSON:

```js
(() => {
  if (!row.file_upload_car) return "";

  let file = row.file_upload_car;

  if (typeof file === "string") {
    try {
      file = JSON.parse(file);
    } catch (e) {
      return '<a href="' + row.file_upload_car + '" target="_blank" style="display:inline-block; padding:4px 10px; border:1px solid #93c5fd; color:#2563eb; border-radius:999px; font-size:12px; text-decoration:none;">ดูเอกสารแนบ</a>';
    }
  }

  const url = Array.isArray(file) ? file[0]?.url : file?.url;
  if (!url) return "";

  return '<a href="' + url + '" target="_blank" style="display:inline-block; padding:4px 10px; border:1px solid #93c5fd; color:#2563eb; border-radius:999px; font-size:12px; text-decoration:none;">ดูเอกสารแนบ</a>';
})()
```

## Practice: Conditional File Links In List View

Use this pattern when a `list-ui` row should show an attachment link only when a row file field has data. This is better than `Buttons Row` when the button must disappear for rows where the file field is empty.

1. Add a `customValue` item, for example `fieldName: file_upload_button`.
2. Put `{{file_upload_button}}` in `detailContent`.
3. Keep the generated HTML small and avoid `<style>` tags.

Use a no-`try/catch` expression because some `customValue` editors report `SyntaxError: Unexpected token 'catch'`:

```js
(() => {
  const files = row.file_upload_car;

  if (!files || files.length === 0) return "";

  const file = Array.isArray(files) ? files[0] : files;

  let url = "";

  if (typeof file === "string") {
    const match = file.match(/https?:\/\/[^"'\]\s]+/);
    url = match ? match[0] : file;
  } else if (file) {
    url = file.url || file.path || file.file_url || file.fileUrl || "";
  }

  if (!url) return "";

  return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" style="display:inline-block; padding:4px 10px; border:1px solid #93c5fd; color:#2563eb; border-radius:6px; font-size:12px; font-weight:500; line-height:1.4; text-decoration:none !important; cursor:pointer;">เอกสารแนบ</a>';
})()
```

Important limitations learned from `vehicle_booking_list`:

- `target="_blank"` in `customValue` may still replace the current tab if the list row click handler intercepts the click.
- Inline `onclick="window.open(...)"` may be sanitized or ignored inside `detailContent`.
- For guaranteed `window.open(url, "_blank")`, use `Buttons Row onClick`; the tradeoff is that `Buttons Row` may show on every row when there is no per-row visibility option.
- `<a download>` does not guarantee PDF download. Browsers may render PDFs inline when the server sends `Content-Disposition: inline` or the file is cross-origin. A guaranteed PDF download requires a server/download endpoint that sends `Content-Disposition: attachment`.

For status chips and inline buttons in `detailContent`, do not split CSS property names across lines. Broken strings such as `border-\nradius`, `font-\nsize`, or `text-\ndecoration` are invalid CSS. Prefer one-line style attributes or a CSS class in `formConfig.cssCode`.

Recommended status chip:

```html
<span class="status-pill" style="background:{{status_bg}}; color:{{status_color}};">{{status_text}}</span>
```

```css
.status-pill {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px !important;
  overflow: hidden;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
}
```

## Practice: Prompt Then Run Process API

Some initCraft button/list-row handlers use the callback-style `this.prompt(message, callback, options)` instead of the promise-style prompt documented above. This pattern is useful when a row action needs an optional comment before calling a process API.

Observed approval/status action pattern:

```js
this.prompt("เพิ่มความคิดเห็น (ถ้ามี):", async (comment) => {
  const api = this.getFormRef().userState;

  const res = await globalThis.fetch("https://apierp.softmax-one.com/api/v1/process/PROCESS_ID", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + api.user.token
    },
    body: JSON.stringify({
      params: {
        id: dataRow._id,
        newStatus: "pending_facility",
        approverField: "approved_by_supervisor",
        comment
      }
    })
  });

  console.log("approve result", await res.json());
}, { title: "อนุมัติคำขอ" });
```

Notes:

- Use `this.getFormRef().userState.user.token` for the bearer token in current ERP runtime contexts.
- Use `dataRow._id` when the handler is attached to a row action, such as a list/grid row button.
- Keep process parameters explicit: `id`, target status, approver field, and optional comment.
- Prefer `globalThis.fetch` in event scripts when direct `fetch` availability is uncertain.

## Practice: Dynamic Card Clone Preserves Data

When a button clones a card and calls `formRef.setFormModel(newFormJson)`, the form is rebuilt and live field values can disappear. Capture a deep snapshot before `setFormModel()`, preferably from `globalModel` when sub-form calculated values are maintained there, then restore after the rebuild. A single `setTimeout(..., 50)` may be too early in the builder/runtime; use a small restore helper and run it more than once if needed.

Pattern:

```js
const currentData = JSON.parse(JSON.stringify(this.globalModel || f.getFormData(false) || {}));

f.setFormModel(formJson);

function restoreData() {
  f.setFormData(JSON.parse(JSON.stringify(currentData)));
}

setTimeout(restoreData, 100);
setTimeout(restoreData, 300);
```

For sub-form row calculations, avoid `setFormData()` inside every input `onChange` if it causes flicker. Prefer updating the row path on `globalModel` and then updating the specific rendered input/field instance when possible.

## Practice: Sub Form Row Calculation Without Flicker

For simple row math such as `quantity * rate = amount`, prefer child field `onChange` handlers over `onSubFormRowChange` when the latter flickers or repeatedly re-renders the table.

Runtime lessons from a budget sub-form:

- `this.refSubField(...)` may not exist in some current SDForm runtimes.
- `data` may be undefined in child field/sub-form event contexts.
- `f.setFormData(patch)` inside every input `onChange` can make Sub Form rows flicker and may trigger Element Plus form errors.
- `this.getPropName()` can return a row path such as `activity_budget_items_1.0.budget_item_rate_1`; split it into sub-form name, row index, and field name.
- The current changed value may be available as `value` or `this.getValue()`, while the other field in the row may not yet be synced to `globalModel`.
- Use a row-keyed cache such as `globalThis.__budgetCalc[rowKey]` to combine current quantity/rate values reliably.
- `this.setObjectByPath(this.globalModel, amountPath, amount)` can store the calculated value without full form refresh.
- `getFieldInput("field_name")` may return an array of rendered field/input wrappers, not a DOM element; do not call DOM methods like `dispatchEvent` unless you have confirmed the returned item is an actual element.

Skeleton for the quantity/rate child field `onChange` handlers:

```js
const propName = this.getPropName();
const parts = propName.split(".");

const subFormName = parts[0];
const rowIndex = parts[1];
const fieldName = parts[2];
const rowKey = subFormName + "." + rowIndex;

globalThis.__budgetCalc = globalThis.__budgetCalc || {};
globalThis.__budgetCalc[rowKey] = globalThis.__budgetCalc[rowKey] || {
  qty: 0,
  rate: 0
};

const currentValue = typeof value !== "undefined" ? value : this.getValue();
const num = Number(String(currentValue || "0").replace(/,/g, ""));

if (fieldName === "budget_item_qty_1") {
  globalThis.__budgetCalc[rowKey].qty = num;
}

if (fieldName === "budget_item_rate_1") {
  globalThis.__budgetCalc[rowKey].rate = num;
}

const qty = globalThis.__budgetCalc[rowKey].qty || 0;
const rate = globalThis.__budgetCalc[rowKey].rate || 0;
const amount = qty * rate;

const amountPath = rowKey + ".budget_item_amount_1";

this.setObjectByPath(this.globalModel, amountPath, amount);
```

If the model value updates but a readonly Text Input does not display the calculated amount, inspect the rendered wrappers before guessing a setter:

```js
const inputs = this.getFormRef().getFieldInput("budget_item_amount_1") || [];

console.table(inputs.map((item, i) => ({
  i,
  keys: Object.keys(item || {}).join(", "),
  name: item?.field?.options?.name,
  optionName: item?.options?.name,
  propName: item?.propName,
  prop: item?.prop,
  getPropName: typeof item?.getPropName === "function" ? item.getPropName() : null
})));
```
