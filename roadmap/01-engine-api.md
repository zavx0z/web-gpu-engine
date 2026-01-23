# Task: Engine API Preparation

**Цель:** Обеспечить необходимый API для внешнего использования в `metafor`.

## Файлы (web-gpu-engine)

- `src/renderer/index.ts`
- `src/core/Object3D.ts`
- `src/geometries/PlaneGeometry.ts` (New)
- `src/geometries/SphereGeometry.ts` (New)
- `src/geometries/TorusGeometry.ts` (Existing)
- `src/materials/GlowMaterial.ts` (New)
- `src/objects/InstancedMesh.ts` (New)
- `src/renderer/shaders/mesh_instanced.wgsl` (New)
- `src/index.ts`

## Инструкции

1. ✅ **Flexible Renderer Init**
   - В `src/renderer/index.ts`: Метод `init` должен принимать опциональный параметр `canvas`. Если передан — использовать его, если нет — создавать новый.

2. **Graph Management**
   - В `src/core/Object3D.ts`: Реализовать метод `remove(child: Object3D)` для корректного удаления объектов из иерархии.

3. ✅ **Geometries**
   - `PlaneGeometry.ts`: (New) Простая плоскость (2 треугольника) с UV-координатами (для спрайтов/текста).
   - `SphereGeometry.ts`: (New) Генерация вершин сферы (для отображения значений).
   - `TorusGeometry.ts`: (Existing) Визуализация контейнеров.

4. ✅ **Effects Material**
   - `GlowMaterial.ts`: Класс материала с параметрами `color` и `intensity`. (Пока можно использовать заглушку, наследующуюся от Material, с базовым цветом, шейдер добавим позже).

5. **Instancing Support**
   - `InstancedMesh.ts`: Класс, наследуемый от `Mesh`, принимающий `geometry`, `material` и `count`. Должен управлять буфером матриц экземпляров (`instanceMatrix`).
   - `mesh_instanced.wgsl`: Шейдер, поддерживающий чтение атрибутов экземпляра (матрица трансформации) и их применение к вершинам.
   - Обновить `Renderer.ts` для поддержки отрисовки `InstancedMesh`.

6. **Public API**
   - В `src/index.ts`: Экспортировать новые классы (`PlaneGeometry`, `SphereGeometry`, `GlowMaterial`).
   - Убедиться, что `TorusGeometry` экспортирован.

## Ожидаемый результат

Движок готов к линковке и предоставляет все необходимые строительные блоки для визуализатора.
