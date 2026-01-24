### Анализ Интеграции Yoga-Layout: Проблемы и Рекомендации

---

### 1. Обзор и Анализ Сайта `https://www.yogalayout.dev/`

Официальный сайт `yogalayout.dev` является ключевым ресурсом для понимания библиотеки . Он содержит документацию, блог с анонсами обновлений и интерактивную "песочницу" для тестирования раскладок .

**Ключевые моменты с сайта:**

* **Блог и Версии:** В блоге анонсируются важные изменения [[1]](https://www.npmjs.com/package/yoga-layout) . Например, анонс **Yoga 3.0** является критически важным, так как он ввел несколько "ломающих" (breaking) изменений, в первую очередь связанных с переходом на WebAssembly (WASM) [[2]](https://www.kodeco.com/530-yoga-tutorial-using-a-cross-platform-layout-engine) .
* **Переход на ES Modules:** Начиная с версии 3.0, JavaScript-биндинги для Yoga распространяются как ES-модули . Это означает, что старые подходы с `require()` могут не работать в современных окружениях без соответствующей настройки сборщика [[3]](https://www.yogalayout.dev/blog) .
* **Асинхронная загрузка:** Для использования WebAssembly-версии библиотеки (которая значительно быстрее) требуется асинхронная загрузка и компиляция модуля [[4]][https://www.yogalayout.dev/docs/getting-started/laying-out-a-tree]([5)](https://www.yogalayout.dev/docs/styling/position) . Это меняет способ инициализации библиотеки [[4]](https://www.yogalayout.dev/docs/getting-started/laying-out-a-tree) . Существует и синхронный вариант (`yoga-layout/sync`), но он не рекомендуется для новых проектов и не поддерживает WebAssembly в браузерах [[6]](https://www.yogalayout.dev/docs/styling/) .
* **Соответствие веб-стандартам:** Разработчики стремятся к максимальному соответствию спецификации Flexbox, что иногда приводит к изменениям в поведении от версии к версии [[5]](https://www.yogalayout.dev/docs/styling/position) .

Анализ сайта показывает, что он является основным источником правды, и многие проблемы интеграции могут быть решены путем внимательного изучения документации и анонсов в блоге [[1]](https://www.npmjs.com/package/yoga-layout) .

---

### 2. Основные Концепции Yoga-Layout

Yoga — это кроссплатформенный движок для верстки, разработанный Meta, который предоставляет единый способ описания макетов на разных платформах (iOS, Android, Web) с использованием принципов Flexbox [[7]](https://www.yogalayout.dev/docs/styling/layout-direction) .

* **Основа на Flexbox:** Yoga реализует алгоритм Flexbox, что позволяет разработчикам, знакомым с веб-версткой, легко адаптироваться [[5]](https://www.yogalayout.dev/docs/styling/position) .
* **Производительность:** Движок написан на C++ и компилируется в WebAssembly для JavaScript-окружений, что обеспечивает высокую производительность вычислений, особенно важную на мобильных устройствах [[8]](https://github.com/facebook/yoga/issues/783) .
* **Использование в React Native:** Yoga является основой системы верстки в React Native . Однако стоит помнить, что некоторые значения по умолчанию в React Native и в самой Yoga отличаются от веб-стандартов. Например, `flexDirection` по умолчанию имеет значение `column`, а не `row` [[9]](https://github.com/facebook/yoga/issues/1119) .
* **Единицы измерения:** Yoga оперирует абстрактными "точками" (points), а не пикселями, что делает ее независимой от платформы [[10]][https://www.yogalayout.dev/blog/announcing-yoga-3.0]([11)](https://discourse.threejs.org/t/get-position-of-object-in-scene/8300) .

---

### 3. Распространенные Проблемы Интеграции и их Решение

На основе анализа официальной документации, обсуждений на GitHub и Stack Overflow можно выделить несколько типичных проблем, с которыми сталкиваются разработчики.

#### **Проблема 1: Ошибки сборки и инициализации модуля (Yoga v3+)**

Наиболее частая проблема после обновления до v3+ — ошибки сборки, такие как `Module not found` или ошибки, связанные с асинхронной загрузкой [[2]](https://www.kodeco.com/530-yoga-tutorial-using-a-cross-platform-layout-engine) .

* **Причина:** Это вызвано переходом на ES-модули и необходимостью асинхронной загрузки и компиляции WASM-модуля в браузере [[3]][https://www.yogalayout.dev/blog]([4)][https://www.yogalayout.dev/docs/getting-started/laying-out-a-tree]([5)](https://www.yogalayout.dev/docs/styling/position) . Старые конфигурации сборщиков и синхронный код инициализации перестают работать [[3]](https://www.yogalayout.dev/blog) .
* **Решение: Реализация отказоустойчивого сервиса-синглтона**

    Для управления сложной асинхронной загрузкой лучшим архитектурным решением является комбинация паттернов **Singleton** и **"Singleton Promise"** [[1]](https://www.npmjs.com/package/yoga-layout) . Этот подход гарантирует, что процесс загрузки WASM-модуля будет запущен только один раз, а все последующие вызовы будут безопасно ожидать его завершения, что исключает гонку состояний [[6]](https://www.yogalayout.dev/docs/styling/) .

    **Шаг 1: Создание `YogaService.ts`**

    Создадим сервис, который инкапсулирует всю логику загрузки, управления состоянием и предоставления типобезопасного доступа к API Yoga [[2]](https://www.kodeco.com/530-yoga-tutorial-using-a-cross-platform-layout-engine) .

    ```typescript
    // src/services/YogaService.ts
    import { loadYoga, Align, Justify, FlexDirection, Edge, Display, Overflow } from 'yoga-layout';
    import type { Yoga as YogaModule } from 'yoga-layout';

    // 1. Определяем состояния жизненного цикла для отладки и условной логики
    export enum YogaLoadingState {
      PENDING, // Загрузка не начиналась
      LOADING, // Идет процесс загрузки
      READY,   // Модуль готов к использованию
      ERROR,   // Произошла ошибка
    }

    /**
     * Сервис-синглтон для управления жизненным циклом yoga-layout.
     * Инкапсулирует асинхронную загрузку WASM и предоставляет безопасный доступ к API.
     */
    export class YogaService {
      // 2. Реализация паттерна Singleton
      private static _instance: YogaService;
      public static get instance(): YogaService {
        if (!YogaService._instance) {
          YogaService._instance = new YogaService();
        }
        return YogaService._instance;
      }

      // 3. Управление состоянием и "Singleton Promise"
      private _state: YogaLoadingState = YogaLoadingState.PENDING;
      private _yoga: YogaModule | null = null;
      private initializationPromise: Promise<YogaModule> | null = null;

      private constructor() {} // Приватный конструктор

      public get state(): YogaLoadingState {
        return this._state;
      }

      /**
       * Инициирует загрузку WASM-модуля Yoga. Безопасен для многократного вызова.
       * @returns {Promise<YogaModule>} Промис, который разрешается с загруженным модулем.
       */
      public initialize(): Promise<YogaModule> {
        // Если промис уже существует, возвращаем его, избегая повторной загрузки [[6]](https://www.yogalayout.dev/docs/styling/) 
        if (this.initializationPromise) {
          return this.initializationPromise;
        }

        this._state = YogaLoadingState.LOADING;
        console.log('Запуск загрузки WASM-модуля Yoga...');

        // Сохраняем сам промис, чтобы все параллельные вызовы его ожидали [[6]](https://www.yogalayout.dev/docs/styling/) 
        this.initializationPromise = loadYoga()
          .then((yoga) => {
            this._yoga = yoga;
            this._state = YogaLoadingState.READY;
            console.log('WASM-модуль Yoga успешно загружен.');
            return yoga;
          })
          .catch((error) => {
            this._state = YogaLoadingState.ERROR;
            console.error('Ошибка при загрузке WASM-модуля Yoga:', error);
            // Обнуляем промис, чтобы можно было попробовать загрузить снова
            this.initializationPromise = null;
            throw error; // Перебрасываем ошибку для обработки выше
          });

        return this.initializationPromise;
      }

      /**
       * Предоставляет безопасный доступ к загруженному модулю Yoga.
       * @throws {Error} Если модуль еще не готов.
       */
      public get yoga(): YogaModule {
        if (this._state !== YogaLoadingState.READY || !this._yoga) {
          throw new Error(
            'Сервис Yoga не готов. Вызовите и дождитесь `initialize()` перед доступом к модулю.'
          );
        }
        return this._yoga;
      }

      // 4. Удобные геттеры для доступа к API
      public get Node(): YogaModule['Node'] {
        return this.yoga.Node;
      }

      // 5. Предоставление доступа к перечислениям (enums)
      public readonly Align = Align;
      public readonly Justify = Justify;
      public readonly FlexDirection = FlexDirection;
      public readonly Edge = Edge;
      public readonly Display = Display;
      public readonly Overflow = Overflow;
    }
    ```

    **Шаг 2: Использование сервиса в приложении**

    Любая часть приложения, которой нужен Yoga, теперь может безопасно его получить через сервис.

    ```typescript
    // src/core/LayoutManager.ts
    import { YogaService, YogaLoadingState } from '../services/YogaService';

    class LayoutManager {
      private yogaService: YogaService;

      constructor() {
        // Получаем единственный экземпляр сервиса [[4]](https://www.yogalayout.dev/docs/getting-started/laying-out-a-tree) 
        this.yogaService = YogaService.instance;
        this.setupLayout();
      }

      private async setupLayout(): Promise<void> {
        try {
          // Запрашиваем инициализацию. Сервис сам позаботится о том,
          // чтобы загрузка произошла только один раз.
          await this.yogaService.initialize();
          
          // Теперь мы можем безопасно работать с API Yoga
          this.createLayout();

        } catch (error) {
          console.error("LayoutManager не смог инициализироваться, так как Yoga не загрузилась.");
        }
      }

      public createLayout(): void {
        if (this.yogaService.state !== YogaLoadingState.READY) {
          console.warn("Попытка создать layout, но модуль Yoga еще не загружен.");
          return;
        }

        // Безопасный доступ к Node и enums через сервис
        const { Node, Justify, Align, Edge } = this.yogaService;

        const root = Node.create();
        root.setWidth(500);
        root.setHeight(300);
        root.setJustifyContent(Justify.Center);
        root.setAlignItems(Align.Center);
        
        // ...
        
        root.freeRecursive(); // Не забываем про очистку памяти!
      }
    }
    ```

#### **Проблема 2: Утечки памяти из-за ручного управления**

Это одна из самых неочевидных, но критически важных проблем для JavaScript-разработчиков [[6]](https://www.yogalayout.dev/docs/styling/) .

* **Причина:** Объекты, созданные через `Yoga.Node.create()`, выделяют память в среде WebAssembly/C++ [[6]][https://www.yogalayout.dev/docs/styling/]([12)](https://www.geeksforgeeks.org/typescript/how-to-map-enum-tuple-to-object-in-typescript/) . Сборщик мусора JavaScript не управляет этой памятью, и если ее не освобождать вручную, это приведет к **утечкам памяти** [[6]][https://www.yogalayout.dev/docs/styling/]([8)](https://github.com/facebook/yoga/issues/783) .
* **Решение: Обязательное освобождение памяти**

    Необходимо вручную освобождать память, когда узел и его дочерние элементы больше не нужны .

  * `node.free()`: Освобождает память только для одного узла .
  * `node.freeRecursive()`: Освобождает память для узла и всех его дочерних узлов рекурсивно [[8]](https://github.com/facebook/yoga/issues/783) . Это наиболее частый и безопасный способ очистки целого дерева макета.

    **Лучшая практика:** Используйте блок `try...finally`, чтобы гарантировать освобождение памяти даже в случае ошибок [[13]](https://github.com/vincentriemer/yoga-js/blob/master/API.md) .

    ```javascript
    const root = YogaService.instance.Node.create();
    try {
      // ... создание дочерних узлов, применение стилей, расчет макета ...
      root.calculateLayout(500, 300, YogaService.instance.Direction.LTR);
      const layout = root.getComputedLayout();
      console.log(layout);
    } finally {
      // Этот блок выполнится всегда, обеспечивая очистку памяти
      root.freeRecursive();
    }
    ```

#### **Проблема 3: Некорректное использование API и получение результата**

Многие ошибки возникают из-за непонимания полного цикла работы с библиотекой: создание дерева, стилизация, расчет и получение результата [[14]](https://www.yogalayout.dev/docs/getting-started/configuring-yoga) .

* **Причина:** Пропуск одного из шагов или неправильное применение API.
* **Решение: Следуйте полному циклу работы**

    1. **Создание иерархии узлов:** Создайте корневой и дочерние узлы с помощью `Yoga.Node.create()` и свяжите их методом `insertChild(child, index)` [[4]][https://www.yogalayout.dev/docs/getting-started/laying-out-a-tree]([12)](https://www.geeksforgeeks.org/typescript/how-to-map-enum-tuple-to-object-in-typescript/) .
    2. **Применение Flexbox-свойств:** Используйте `set*` методы для стилизации узлов. Для значений свойств (например, `center`, `row`) используйте перечисления, импортированные из пакета (`Justify`, `FlexDirection`, `Edge` и т.д.) [[15]](https://github.com/facebook/yoga/issues/787) .
    3. **Расчет макета:** Вызовите `calculateLayout()` **на корневом узле**. Метод принимает `(ширина, высота, направление)` [[16]](https://discoverthreejs.com/book/first-steps/transformations/) . Направление (`Direction.LTR` или `Direction.RTL`) критически важно для правильной работы логических свойств, таких как `margin-start` (`Edge.Start`) [[17]](https://discourse.threejs.org/t/convert-from-one-coordinate-system-to-another/13240) .
    4. **Получение результата:** После расчета используйте `getComputedLayout()` на любом узле, чтобы получить его вычисленную геометрию: `{ left, top, width, height }` [[18]](https://discourse.threejs.org/t/units-in-three-js/1174) . Помните, что Yoga только вычисляет макет, но не занимается его рендерингом [[19]](https://github.com/pmndrs/react-three-flex) .

#### **Проблема 4: Конфликты версий в зависимостях**

Библиотеки, такие как `react-pdf`, используют `yoga-layout` под капотом. Когда такая зависимость обновляется до Yoga v3+, это может сломать ваш проект, если он не готов к "ломающим" изменениям .

* **Симптомы:** Ошибки вида `TypeError: undefined is not an object (evaluating 'Yoga__namespace.Overflow.Hidden')` или пустые сгенерированные PDF-файлы [[20]](https://reactnative.dev/docs/flexbox) .
* **Решение:**
  * **Фиксация версий:** Временно зафиксируйте версию проблемного пакета в `package.json`. Например, можно откатить `@react-pdf/layout` до версии, которая использовала Yoga v2, с помощью `resolutions` (для Yarn) или `overrides` (для npm) [[21]](https://medium.com/@alexbates39/an-overview-of-the-three-js-coordinate-system-07f75ee76e64) .
  * **Адаптация проекта:** Лучшим долгосрочным решением является адаптация вашего проекта к новой версии Yoga, как описано в Проблеме 1 [[1]](https://www.npmjs.com/package/yoga-layout) .
  * **Проверка журналов изменений:** При обновлении зависимостей всегда проверяйте их changelogs на предмет "ломающих" изменений [[20]](https://reactnative.dev/docs/flexbox) .

#### **Проблема 5: Интеграция 2D-макета в 3D-пространство (Three.js, WebGPU)**

Это продвинутый, но реальный сценарий интеграции, например, при создании UI в VR/AR или использовании библиотек вроде `react-three-flex` [[22]](https://stackoverflow.com/questions/51383187/positioning-a-3d-object-in-the-corners-of-the-canvas-three-js) .

##### **5.1. Основные сложности: Различия в системах координат**

* **Начало координат:** У `yoga-layout` оно находится в **верхнем левом углу** родителя . В 3D-движках (например, Three.js) позиция объекта (`0,0,0`) по умолчанию соответствует его **геометрическому центру** [[23]](https://discourse.threejs.org/t/position-of-object/9343) .
* **Ось Y:** В Yoga направлена **вниз**, а в 3D — **вверх** [[24]](https://discourse.threejs.org/t/how-to-use-the-rotation-matrix-correctly/20766) .
* **Единицы:** Yoga использует абстрактные "точки", а 3D-сцены — "мировые единицы" [[11]](https://discourse.threejs.org/t/get-position-of-object-in-scene/8300) .

##### **5.2. Решение: Паттерн рекурсивного построения и применения макета**

Для решения этих проблем используется паттерн, состоящий из нескольких шагов: рекурсивное построение параллельного дерева узлов Yoga на основе иерархии 3D-объектов, расчет макета и последующее применение вычисленных координат и размеров обратно к 3D-объектам с необходимой трансформацией [[25]][https://discourse.threejs.org/t/extending-object3d-typescript/40130]([3)](https://www.yogalayout.dev/blog) .

**Шаг 1: Хранение данных о компоновке в `userData`**

Удобно хранить CSS-подобные правила компоновки прямо в 3D-объектах, используя свойство `userData` [[26]](https://codeworkshop.dev/blog/2020-09-09-3d-flexbox-layouts-with-react-three-flex) .

**Шаг 2: Создание надежного маппера стилей**

Yoga ожидает числовые значения из своих перечислений (enums), а не строки типа `'row'` [[3]](https://www.yogalayout.dev/blog) . Для этого создается функция-маппер, которая преобразует строки в нужные числовые константы с помощью таблиц сопоставления [[6]](https://www.yogalayout.dev/docs/styling/) .

**Шаг 3: Рекурсивное построение дерева Yoga**

Создается рекурсивная функция, которая обходит иерархию 3D-объектов и строит для нее параллельное дерево узлов Yoga [[25]](https://discourse.threejs.org/t/extending-object3d-typescript/40130) .

**Шаг 4: Расчет и применение компоновки**

После построения дерева вызывается `calculateLayout()` [[16]](https://discoverthreejs.com/book/first-steps/transformations/) . Затем другая рекурсивная функция обходит 3D-объекты, получает вычисленные параметры из узлов Yoga и применяет их к 3D-объектам, выполняя трансформацию координат [[3]](https://www.yogalayout.dev/blog) .

---

### Краткое резюме

Поскольку конкретный код не был предоставлен, данный анализ сосредоточен на общих проблемах интеграции `yoga-layout`, выявленных на основе официального сайта и обсуждений в сообществе.

Большинство проблем при интеграции `yoga-layout` (особенно версии 3.0 и новее) связаны со следующими аспектами:

1. **"Ломающие" изменения в v3+:** Переход на ES-модули и WebAssembly требует обязательной асинхронной загрузки [[2]][https://www.kodeco.com/530-yoga-tutorial-using-a-cross-platform-layout-engine]([3)][https://www.yogalayout.dev/blog]([4)](https://www.yogalayout.dev/docs/getting-started/laying-out-a-tree) . Лучшим решением является создание **сервиса-синглтона**, который инкапсулирует логику загрузки и предотвращает гонку состояний с помощью паттерна "Singleton Promise" [[1]][https://www.npmjs.com/package/yoga-layout]([6)](https://www.yogalayout.dev/docs/styling/) .
2. **Ручное управление памятью:** Необходимость вызывать `freeRecursive()` для созданных узлов является критически важным аспектом, который легко упустить, что приводит к утечкам памяти в WASM [[6]][https://www.yogalayout.dev/docs/styling/]([8)](https://github.com/facebook/yoga/issues/783) .
3. **Неполное понимание API:** Пропуск шагов, таких как вызов `calculateLayout()` на корневом узле или неправильное использование API для стилизации, приводит к некорректным результатам [[14]][https://www.yogalayout.dev/docs/getting-started/configuring-yoga]([16)](https://discoverthreejs.com/book/first-steps/transformations/) .
4. **Конфликты зависимостей:** Библиотеки, использующие Yoga (например, `react-pdf`), могут вызывать сбои при обновлении, если ваш проект не адаптирован к новой версии Yoga [[20]](https://reactnative.dev/docs/flexbox) .
5. **Рендеринг в 3D:** Продвинутый сценарий, требующий согласования 2D-системы координат Yoga (ось Y вниз, начало вверху слева) с 3D-системами (ось Y вверх, начало в центре) [[23]][https://discourse.threejs.org/t/position-of-object/9343]([24)](https://discourse.threejs.org/t/how-to-use-the-rotation-matrix-correctly/20766) .

Для успешной интеграции `yoga-layout` рекомендуется внимательно следить за версиями, изучать официальную документацию на `yogalayout.dev`, реализовать надежный механизм асинхронной инициализации, уделять особое внимание управлению памятью и тщательно тестировать верстку, следуя полному циклу работы с API [[1]](https://www.npmjs.com/package/yoga-layout) .
