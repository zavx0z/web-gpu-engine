# Подзадача: Заменить линейный поиск ключевых кадров на бинарный

**Файл(ы)**: `src/animation/AnimationAction.ts`

**Что сделать**:

1. Найти метод `findKeyframeIndex(time: number)`.
2. Заменить текущую реализацию (линейный поиск с конца) на бинарный поиск:

   ```ts
   private findKeyframeIndex(time: number): number {
     const times = this.clip.tracks[0].times; // предполагается, что все треки синхронны
     let low = 0;
     let high = times.length - 1;
     while (low < high) {
       const mid = Math.floor((low + high + 1) / 2);
       if (times[mid] <= time) {
         low = mid;
       } else {
         high = mid - 1;
       }
     }
     return low;
   }
   ```

3. Убедиться, что массив `times` отсортирован по возрастанию (он должен быть таким по спецификации).

**Ожидаемый результат**:  
Поиск ключевого кадра работает за O(log n) вместо O(n). Особенно важно для длинных анимаций (>1000 кадров).
