# Подзадача: Пакетная загрузка uniform-данных в GPU

**Файл(ы)**: `src/renderer/index.ts`

**Что сделать**:

1. В классе `Renderer` добавить свойство:

   ```ts
   private perObjectDataCPU: Float32Array;
   ```

2. В методе инициализации (`init` или конструкторе) создать буфер:

   ```ts
   this.perObjectDataCPU = new Float32Array(MAX_RENDERABLES * (PER_OBJECT_DATA_SIZE / 4));
   ```

   (Убедитесь, что `MAX_RENDERABLES` и `PER_OBJECT_DATA_SIZE` определены.)
3. В методе `renderMesh` (и аналогичных для линий/текста, если есть):
   - Удалить вызов `this.device.queue.writeBuffer(...)`.
   - Записывать данные напрямую в `this.perObjectDataCPU` по с÷мещению `dynamicOffset`.
   - Для скиннинга: дописывать `boneMatrices` сразу после uniform-блока.
4. В методе `render()`:
   - После заполнения всех данных в цикле — **один раз** вызвать:

     ```ts
     this.device.queue.writeBuffer(this.perObjectUniformBuffer, 0, this.perObjectDataCPU);
     ```

   - Только **после этого** начинать `beginRenderPass`.

**Ожидаемый результат**:  
Количество вызовов `writeBuffer` сокращено с N (по числу объектов) до 1 на кадр. Снижена нагрузка на CPU и очередь GPU.
