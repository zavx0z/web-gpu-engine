# Подзадача: Консолидация Uniform-буферов

## 📌 Связанные файлы проекта
*   `src/renderer/index.ts` (основные изменения)
*   `src/renderer/shaders/mesh_static.wgsl` (изменение bind group layout)
*   `src/renderer/shaders/mesh_skinned.wgsl` (изменение bind group layout)

## 🛠 Что сделать
Объединить три отдельных uniform-буфера (`globalUniformBuffer`, `sceneUniformBuffer`, `perObjectUniformBuffer`) в один большой `GPUBuffer` для достижения формального соответствия требованию "один вызов `writeBuffer` на кадр".

### Шаг 1: Рассчитать новый layout буфера
1.  Получить `minUniformBufferOffsetAlignment` от устройства (`this.device.limits.minUniformBufferOffsetAlignment`).
2.  Определить размеры данных:
    *   `GLOBAL_DATA_SIZE = 64` (mat4 для `viewProjectionMatrix`).
    *   `SCENE_DATA_SIZE = ...` (текущий размер `sceneUniformBuffer`).
    *   `PER_OBJECT_DATA_SIZE = ...` (уже вычислен в коде).
3.  Выровнять каждый размер до ближайшего кратного `minUniformBufferOffsetAlignment`.
4.  Рассчитать смещения:
    *   `globalOffset = 0`
    *   `sceneOffset = alignedGlobalSize`
    *   `perObjectBaseOffset = sceneOffset + alignedSceneSize`

### Шаг 2: Создать единый буфер
Заменить создание трех буферов на создание одного:
```typescript
this.unifiedUniformBuffer = this.device.createBuffer({
    label: 'Unified Uniform Buffer',
    size: alignedGlobalSize + alignedSceneSize + (MAX_OBJECTS * alignedPerObjectSize),
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
```

### Шаг 3: Адаптировать bind groups
1.  Обновить layouts шейдеров (`.wgsl` файлы) для работы с одним буфером.
2.  Пересоздать `bindGroup` для глобальных и сценовых данных, используя тот же буфер, но с разными `offset` в `GPUBindGroupEntry`.
3.  Для per-object данных оставить текущую логику с динамическими смещениями, но теперь смещение будет считаться от `perObjectBaseOffset`.

### Шаг 4: Модифицировать цикл записи
1.  Объединить данные для глобальной и сценовой секций в один `Float32Array`.
2.  Выполнить один вызов `device.queue.writeBuffer` для записи всех данных:
    ```typescript
    this.device.queue.writeBuffer(
        this.unifiedUniformBuffer,
        0, // offset
        unifiedData.buffer,
        unifiedData.byteOffset,
        unifiedData.byteLength
    );
    ```

## ✅ Ожидаемый результат
*   В консоли браузера (или в логах рендерера) виден только **один** вызов `writeBuffer` для uniform-данных за кадр.
*   Рендеринг работает корректно, без визуальных артефактов.
*   Размеры и выравнивание буфера соответствуют требованиям WebGPU.