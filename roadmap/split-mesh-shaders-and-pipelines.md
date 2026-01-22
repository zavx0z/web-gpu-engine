# Подзадача: Разделить шейдер меша и создать отдельные рендер-конвейеры

**Файл(ы)**:

- Создать: `src/renderer/shaders/mesh_static.wgsl`
- Создать: `src/renderer/shaders/mesh_skinned.wgsl`
- Удалить: `src/renderer/shaders/mesh.wgsl`
- Изменить: `src/renderer/index.ts`

**Что сделать**:

### 1. Создание специализированных шейдеров

1. Скопировать содержимое `mesh.wgsl` в два новых файла.
2. В `mesh_static.wgsl`:
   - Удалить все, связанное со скиннингом: `isSkinned`, `skinIndex`, `skinWeight`, `boneMatrices`.
   - Удалить условие `if (perObject.isSkinned == 1u)`.
   - Оставить только базовую трансформацию вершин.
3. В `mesh_skinned.wgsl`:
   - Удалить ветку `else`.
   - Оставить только логику скиннинга.
   - Убрать проверку `isSkinned` — она больше не нужна.
4. Убедиться, что оба шейдера используют одинаковый layout bind group.

### 2. Создание отдельных рендер-конвейеров

1. В `Renderer.init()`:
   - Загрузить и скомпилировать два шейдера:

     ```ts
     const staticShaderModule = device.createShaderModule({ code: meshStaticWGSL });
     const skinnedShaderModule = device.createShaderModule({ code: meshSkinnedWGSL });
     ```

   - Создать два пайплайна:

     ```ts
     this.staticMeshPipeline = this.createRenderPipeline(staticShaderModule, ...);
     this.skinnedMeshPipeline = this.createRenderPipeline(skinnedShaderModule, ...);
     ```

2. В методе `render()`:
   - Разделить `renderList` на два списка:
     - `staticMeshes`: все `Mesh`, не являющиеся `SkinnedMesh`.
     - `skinnedMeshes`: все `SkinnedMesh`.
   - Сначала отрендерить `staticMeshes` с `staticMeshPipeline`.
   - Затем — `skinnedMeshes` с `skinnedMeshPipeline`.
3. Убедиться, что `renderMesh` принимает pipeline как параметр или вызывается отдельно для каждого типа.

**Ожидаемый результат**:  
Два специализированных шейдера без ветвления и соответствующие им рендер-конвейеры. GPU выполняет однородные вызовы без расхождения потоков. Максимальная эффективность шейдеров.
