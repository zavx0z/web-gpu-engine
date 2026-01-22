# Подзадача: Устранить 1-кадровую задержку анимации

**Файл(ы)**: `examples/main.ts`, `src/animation/AnimationMixer.ts`

**Что сделать**:

1. В `examples/main.ts`, в функции `animate()`:
   - Изменить порядок:

     ```ts
     if (mixer) mixer.update(delta);
     scene.updateWorldMatrix();
     gltf.scene.traverse((obj) => {
       if (obj.isSkinnedMesh) obj.skeleton.update();
     });
     renderer.render(scene, viewPoint);
     ```

2. В `src/animation/AnimationMixer.ts`:
   - Удалить вызов `object.skeleton.update()` из метода `update()`.
   - Оставить только обновление локальных матриц костей.

**Ожидаемый результат**:  
Скелетная анимация синхронизирована с текущим кадром. Нет визуального отставания.
