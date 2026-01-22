# Task: Metafor Visualization Implementation

**Цель:** Реализовать новый визуализатор (`infra/visualizer`) внутри монорепозитория, который заменяет старые `mesh` (Three.js) и `virtual` (Canvas 2D). Визуализатор должен слушать электромагнитные импульсы (`EM`) и отображать граф атомов, используя примитивы `web-gpu-engine`.

**Зависимости:**

- Выполненный этап `01-engine-api.md`.
- `web-gpu-engine` слинкован локально (`bun link`).

## Файлы (metafor/infra/visualizer)

- `package.json` (New Workspace)
- `index.html` (Entry HTML)
- `src/main.ts` (Entry Point)
- `src/core/Visualizer.ts` (Main Logic Class)
- `src/layout/OrbitLayout.ts` (Physics/Positioning)
- `src/utils/LabelFactory.ts` (Text rendering)

## Инструкции

### 1. Setup Workspace & Linking

- Создать директорию `infra/visualizer`.
- В `infra/visualizer/package.json`:
  - Определить имя `@metafor/visualizer`.
  - Добавить зависимости: `@metafor/atom`, `@metafor/meta`.
  - Добавить `web-gpu-engine` (через `link:` или локальный путь).
- В корневом `package.json` добавить `infra/visualizer` в workspaces.

### 2. Entry Point & HTML

- **`index.html`**:
  - Базовый шаблон.
  - `<canvas id="app-canvas"></canvas>`.
  - Подключение скрипта `src/main.ts`.
- **`src/main.ts`**:
  - Импортировать `Visualizer`.
  - Инициализировать тестовую схему (можно взять пример из `mesh/nodes/nodes.js` для генерации данных).
  - Запустить визуализатор.

### 3. Visualizer Core (`src/core/Visualizer.ts`)

Класс-мост между данными Metafor и WebGPU движком.

**Свойства:**

- `engine`: Экземпляр `Engine` (или `Renderer` + `Scene`).
- `atoms`: `Map<string, Object3D>` (Маппинг ID атома на 3D объект).
- `channel`: `BroadcastChannel` (для прослушивания "electromagnetic").

**Логика:**

1. **Init**: Инициализация движка, привязка к canvas. Запуск `requestAnimationFrame` для рендера.
2. **Listen**: Подписка на `EM.onChangeStack` (если в том же потоке) или `BroadcastChannel`.
3. **Handle Impulse**: Разбор патчей (`add`, `remove`, `replace`):
   - `add`: Вызов `createNode`.
   - `remove`: Вызов `removeNode` (используя новый API `Object3D.remove`).
   - `replace`: Обновление цвета/текста (опционально для MVP).

### 4. Geometry & Mapping Rules

В методе `createNode(id, meta, path)` реализовать логику отображения:

- **Контейнеры (Списки/Родители):**
  - Условие: Атом имеет детей или специфический тип в метаданных.
  - Геометрия: `TorusGeometry`.
  - Материал: `GlowMaterial` (цвет, зависящий от глубины вложенности).

- **Значения (Листья):**
  - Условие: Конечный узел.
  - Геометрия: `SphereGeometry`.
  - Материал: `GlowMaterial` (более яркий/контрастный цвет).

### 5. Text Labels (`src/utils/LabelFactory.ts`)

- Реализовать функцию `createTextTexture(text: string): Texture`.
  - Создает `OffscreenCanvas` (или обычный canvas).
  - Рисует текст белым цветом на прозрачном фоне.
  - Возвращает текстуру для движка.
- При создании узла добавлять дочерний `Mesh` с `PlaneGeometry` и текстурой текста, чтобы подписать атом.

### 6. Layout System (`src/layout/OrbitLayout.ts`)

Поскольку мы отказались от физического Worker'а на этом этапе, реализуем простую процедурную раскладку в Main Thread.

- **Алгоритм "Орбитали":**
  - Корневой атом в центре `(0, 0, 0)`.
  - Дети располагаются по кругу (на торе) вокруг родителя.
  - Радиус орбиты зависит от уровня вложенности (чем глубже, тем меньше радиус, или наоборот — расширяющаяся вселенная).
  - **Метод `updatePositions()`**: Рекурсивно проходить по графу сцены и обновлять локальные координаты (`position`) объектов, вращая их вокруг родительской оси Y (анимация вращения).

## Ожидаемый результат

- При запуске `infra/visualizer` открывается браузер с черным фоном.
- Отображаются 3D объекты (Торы и Сферы), представляющие структуру атомов.
- Объекты вращаются (орбитальная анимация).
- Работает добавление/удаление атомов (реакция на изменения в `metafor`).
- Отсутствует зависимость от `three.js`.

# Task: Metafor Visualization Implementation

**Цель:** Реализовать новый визуализатор (`infra/visualizer`) внутри монорепозитория, который заменяет старые `mesh` (Three.js) и `virtual` (Canvas 2D). Визуализатор должен слушать электромагнитные импульсы (`EM`) и отображать граф атомов, используя примитивы `web-gpu-engine`.

**Зависимости:**

- Выполненный этап `01-engine-api.md`.
- `web-gpu-engine` слинкован локально (`bun link`).

## Файлы (metafor/infra/visualizer)

- `package.json` (New Workspace)
- `index.html` (Entry HTML)
- `src/main.ts` (Entry Point)
- `src/core/Visualizer.ts` (Main Logic Class)
- `src/layout/OrbitLayout.ts` (Physics/Positioning)
- `src/utils/LabelFactory.ts` (Text rendering)

## Инструкции

### 1. Setup Workspace & Linking

- Создать директорию `infra/visualizer`.
- В `infra/visualizer/package.json`:
  - Определить имя `@metafor/visualizer`.
  - Добавить зависимости: `@metafor/atom`, `@metafor/meta`.
  - Добавить `web-gpu-engine` (через `link:` или локальный путь).
- В корневом `package.json` добавить `infra/visualizer` в workspaces.

### 2. Entry Point & HTML

- **`index.html`**:
  - Базовый шаблон.
  - `<canvas id="app-canvas"></canvas>`.
  - Подключение скрипта `src/main.ts`.
- **`src/main.ts`**:
  - Импортировать `Visualizer`.
  - Инициализировать тестовую схему (можно взять пример из `mesh/nodes/nodes.js` для генерации данных).
  - Запустить визуализатор.

### 3. Visualizer Core (`src/core/Visualizer.ts`)

Класс-мост между данными Metafor и WebGPU движком.

**Свойства:**

- `engine`: Экземпляр `Engine` (или `Renderer` + `Scene`).
- `atoms`: `Map<string, Object3D>` (Маппинг ID атома на 3D объект).
- `channel`: `BroadcastChannel` (для прослушивания "electromagnetic").

**Логика:**

1. **Init**: Инициализация движка, привязка к canvas. Запуск `requestAnimationFrame` для рендера.
2. **Listen**: Подписка на `EM.onChangeStack` (если в том же потоке) или `BroadcastChannel`.
3. **Handle Impulse**: Разбор патчей (`add`, `remove`, `replace`):
   - `add`: Вызов `createNode`.
   - `remove`: Вызов `removeNode` (используя новый API `Object3D.remove`).
   - `replace`: Обновление цвета/текста (опционально для MVP).

### 4. Geometry & Mapping Rules

В методе `createNode(id, meta, path)` реализовать логику отображения:

- **Контейнеры (Списки/Родители):**
  - Условие: Атом имеет детей или специфический тип в метаданных.
  - Геометрия: `TorusGeometry`.
  - Материал: `GlowMaterial` (цвет, зависящий от глубины вложенности).

- **Значения (Листья):**
  - Условие: Конечный узел.
  - Геометрия: `SphereGeometry`.
  - Материал: `GlowMaterial` (более яркий/контрастный цвет).

### 5. Text Labels (`src/utils/LabelFactory.ts`)

- Реализовать функцию `createTextTexture(text: string): Texture`.
  - Создает `OffscreenCanvas` (или обычный canvas).
  - Рисует текст белым цветом на прозрачном фоне.
  - Возвращает текстуру для движка.
- При создании узла добавлять дочерний `Mesh` с `PlaneGeometry` и текстурой текста, чтобы подписать атом.

### 6. Layout System (`src/layout/OrbitLayout.ts`)

Поскольку мы отказались от физического Worker'а на этом этапе, реализуем простую процедурную раскладку в Main Thread.

- **Алгоритм "Орбитали":**
  - Корневой атом в центре `(0, 0, 0)`.
  - Дети располагаются по кругу (на торе) вокруг родителя.
  - Радиус орбиты зависит от уровня вложенности (чем глубже, тем меньше радиус, или наоборот — расширяющаяся вселенная).
  - **Метод `updatePositions()`**: Рекурсивно проходить по графу сцены и обновлять локальные координаты (`position`) объектов, вращая их вокруг родительской оси Y (анимация вращения).

## Ожидаемый результат

- При запуске `infra/visualizer` открывается браузер с черным фоном.
- Отображаются 3D объекты (Торы и Сферы), представляющие структуру атомов.
- Объекты вращаются (орбитальная анимация).
- Работает добавление/удаление атомов (реакция на изменения в `metafor`).
- Отсутствует зависимость от `three.js`.
